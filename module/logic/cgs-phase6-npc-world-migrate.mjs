/**
 * GM-only world/compendium persistence for Phase 6 NPC stat-block sense migration.
 * Complements `NPCData.migrateData` (in-memory on load) by writing merged CGS senses to the database.
 */

import { buildNpcPhase6StatBlockSenseMigrationUpdate } from "./cgs-phase6-npc-statblock-migrate.mjs";

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

    let worldUpdated = 0;
    for (const actor of game.actors ?? []) {
        if (actor.type !== "npc") continue;
        const r = await applyNpcPhase6StatBlockSenseMigrationToActor(actor);
        if (r === "updated") worldUpdated++;
    }

    let compendiumUpdated = 0;
    const pack = game.packs?.get?.("thirdera.thirdera_monsters");
    if (pack) {
        const docs = await pack.getDocuments();
        for (const doc of docs) {
            if (doc.type !== "npc") continue;
            const r = await applyNpcPhase6StatBlockSenseMigrationToActor(doc);
            if (r === "updated") compendiumUpdated++;
        }
    }

    return { skipped: false, worldUpdated, compendiumUpdated };
}
