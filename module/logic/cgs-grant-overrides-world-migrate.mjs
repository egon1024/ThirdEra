/**
 * World migration gate for CGS canonical templates + per-owned-item overrides (Option 1).
 * Idempotent: bumps `cgsGrantOverridesWorldMigrationRevision` when new passes are added.
 */

import { yieldToMain } from "./client-main-thread-cooperation.mjs";
import {
    getLegacyCreatureFeatureKeysForConsolidation,
    transformCreatureFeatureItemIfLegacy
} from "./cgs-creature-feature-consolidation.mjs";

/** Bump when a new automatic pass is added (manifest transforms, schema repair, etc.). */
export const CGS_GRANT_OVERRIDES_WORLD_MIGRATION_REVISION = 2;

/**
 * @param {{ game?: { user?: { isGM?: boolean }, actors?: unknown, settings?: { get?: Function, set?: Function } } }} deps
 * @returns {Promise<{
 *   skipped: boolean,
 *   reason?: string,
 *   actorsScanned: number,
 *   embeddedItemsChecked: number,
 *   creatureFeaturesMigrated?: number
 * }>}
 */
export async function runCgsGrantOverridesWorldMigrationIfNeeded(deps) {
    const game = deps?.game;
    const user = game?.user;
    if (!user?.isGM) {
        return { skipped: true, reason: "not-gm", actorsScanned: 0, embeddedItemsChecked: 0 };
    }

    const key = "cgsGrantOverridesWorldMigrationRevision";
    const current = Number(game.settings?.get?.("thirdera", key)) || 0;
    if (current >= CGS_GRANT_OVERRIDES_WORLD_MIGRATION_REVISION) {
        return { skipped: true, reason: "already-applied", actorsScanned: 0, embeddedItemsChecked: 0 };
    }

    await yieldToMain();

    const types = new Set(["feat", "feature", "creatureFeature", "armor", "weapon", "equipment"]);
    let embeddedItemsChecked = 0;
    const actors = [...(game.actors?.values?.() ?? game.actors?.contents ?? [])];
    for (const actor of actors) {
        const items = actor?.items?.contents ?? (typeof actor?.items?.values === "function" ? Array.from(actor.items.values()) : []);
        for (const it of items) {
            if (types.has(it?.type)) embeddedItemsChecked++;
        }
    }

    const legacyKeys = new Set(getLegacyCreatureFeatureKeysForConsolidation());
    let creatureFeaturesMigrated = 0;

    for (const actor of actors) {
        const items = actor?.items?.contents ?? (typeof actor?.items?.values === "function" ? Array.from(actor.items.values()) : []);
        for (const item of items) {
            if (!item || item.type !== "creatureFeature") continue;
            const k = typeof item.system?.key === "string" ? item.system.key.trim() : "";
            if (!legacyKeys.has(k)) continue;
            const raw = typeof item.toObject === "function" ? item.toObject(false) : item;
            const out = transformCreatureFeatureItemIfLegacy(raw);
            if (!out?.changed) continue;
            if (typeof item.update === "function") {
                await item.update({
                    name: /** @type {{ name?: string }} */ (out.item).name,
                    img: /** @type {{ img?: string }} */ (out.item).img,
                    system: /** @type {{ system?: Record<string, unknown> }} */ (out.item).system
                });
                creatureFeaturesMigrated++;
            }
        }
        await yieldToMain();
    }

    await game.settings.set("thirdera", key, CGS_GRANT_OVERRIDES_WORLD_MIGRATION_REVISION);
    console.log(
        `Third Era | CGS grant overrides / creature-feature consolidation (revision ${CGS_GRANT_OVERRIDES_WORLD_MIGRATION_REVISION}): ` +
            `scanned ${actors.length} actors, ${embeddedItemsChecked} embedded CGS-capable items, ` +
            `migrated ${creatureFeaturesMigrated} legacy creature feature embed(s).`
    );
    return {
        skipped: false,
        actorsScanned: actors.length,
        embeddedItemsChecked,
        creatureFeaturesMigrated
    };
}
