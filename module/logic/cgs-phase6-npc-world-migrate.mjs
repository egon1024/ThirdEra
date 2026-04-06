/**
 * GM-only world/compendium persistence for Phase 6 NPC stat-block sense migration.
 * Complements `NPCData.migrateData` (in-memory on load) by writing merged CGS senses to the database.
 */

import { buildNpcPhase6StatBlockSenseMigrationUpdate } from "./cgs-phase6-npc-statblock-migrate.mjs";
import { runWithConcurrencyLimit, yieldToMain } from "./client-main-thread-cooperation.mjs";

/** Bounded parallel updates during ready (Phase 6 migration). */
const NPC_PHASE6_MIGRATION_CONCURRENCY = 5;

/** World NPC actors processed per slice so the UI can paint between slices. */
const NPC_PHASE6_WORLD_SLICE = 25;

/**
 * Compendium NPC documents loaded per `getDocuments({ _id__in })` batch (index already has `type`).
 * Smaller than race migrations on purpose: each doc is a full Actor instance + possible update I/O.
 */
const NPC_PHASE6_COMPENDIUM_ID_CHUNK = 35;

/**
 * @param {Actor} actor
 * @returns {Promise<"skipped" | "updated" | "unchanged">}
 */
export async function applyNpcPhase6StatBlockSenseMigrationToActor(actor) {
    if (!actor || actor.type !== "npc") return "skipped";
    const flat = buildNpcPhase6StatBlockSenseMigrationUpdate(actor.system);
    if (!flat) return "skipped";
    try {
        await actor.update(flat);
        return "updated";
    } catch (e) {
        console.warn(`Third Era | Phase 6 NPC CGS sense migration failed for "${actor.name}":`, e);
        return "skipped";
    }
}

/**
 * @param {object} deps
 * @param {Game} deps.game
 * @returns {Promise<{ skipped: boolean, reason?: string, worldUpdated: number, compendiumUpdated: number }>}
 */
export async function migrateAllNpcPhase6StatBlockSenses(deps) {
    const game = deps?.game;
    const user = game?.user;
    if (!user?.isGM) {
        return { skipped: true, reason: "not-gm", worldUpdated: 0, compendiumUpdated: 0 };
    }

    await yieldToMain();
    const worldNpcs = [...(game.actors ?? [])].filter((a) => a.type === "npc");
    let worldUpdated = 0;
    for (let i = 0; i < worldNpcs.length; i += NPC_PHASE6_WORLD_SLICE) {
        await yieldToMain();
        const slice = worldNpcs.slice(i, i + NPC_PHASE6_WORLD_SLICE);
        const worldResults = await runWithConcurrencyLimit(
            slice,
            NPC_PHASE6_MIGRATION_CONCURRENCY,
            (actor) => applyNpcPhase6StatBlockSenseMigrationToActor(actor)
        );
        worldUpdated += worldResults.filter((r) => r === "updated").length;
    }

    let compendiumUpdated = 0;
    const pack = game.packs?.get?.("thirdera.thirdera_monsters");
    if (pack) {
        await yieldToMain();
        await pack.getIndex();
        const npcIds = pack.index.filter((e) => e.type === "npc").map((e) => e._id);
        for (let i = 0; i < npcIds.length; i += NPC_PHASE6_COMPENDIUM_ID_CHUNK) {
            await yieldToMain();
            const idSlice = npcIds.slice(i, i + NPC_PHASE6_COMPENDIUM_ID_CHUNK);
            const docs = await pack.getDocuments({ _id__in: idSlice });
            const compResults = await runWithConcurrencyLimit(
                docs,
                NPC_PHASE6_MIGRATION_CONCURRENCY,
                (doc) => applyNpcPhase6StatBlockSenseMigrationToActor(doc)
            );
            compendiumUpdated += compResults.filter((r) => r === "updated").length;
        }
    }

    return { skipped: false, worldUpdated, compendiumUpdated };
}
