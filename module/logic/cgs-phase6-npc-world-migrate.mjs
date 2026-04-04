/**
 * GM-only world/compendium persistence for Phase 6 NPC stat-block sense migration.
 * Complements `NPCData.migrateData` (in-memory on load) by writing merged CGS senses to the database.
 */

import { buildNpcPhase6StatBlockSenseMigrationUpdate } from "./cgs-phase6-npc-statblock-migrate.mjs";
import { runWithConcurrencyLimit } from "./client-main-thread-cooperation.mjs";

/** Bounded parallel updates during ready (Phase 6 migration). */
const NPC_PHASE6_MIGRATION_CONCURRENCY = 5;

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

    const worldNpcs = [...(game.actors ?? [])].filter((a) => a.type === "npc");
    const worldResults = await runWithConcurrencyLimit(
        worldNpcs,
        NPC_PHASE6_MIGRATION_CONCURRENCY,
        (actor) => applyNpcPhase6StatBlockSenseMigrationToActor(actor)
    );
    let worldUpdated = worldResults.filter((r) => r === "updated").length;

    let compendiumUpdated = 0;
    const pack = game.packs?.get?.("thirdera.thirdera_monsters");
    if (pack) {
        const docs = await pack.getDocuments();
        const npcDocs = docs.filter((d) => d.type === "npc");
        const compResults = await runWithConcurrencyLimit(
            npcDocs,
            NPC_PHASE6_MIGRATION_CONCURRENCY,
            (doc) => applyNpcPhase6StatBlockSenseMigrationToActor(doc)
        );
        compendiumUpdated = compResults.filter((r) => r === "updated").length;
    }

    return { skipped: false, worldUpdated, compendiumUpdated };
}
