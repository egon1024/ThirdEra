/**
 * World migration gate for CGS canonical templates + per-owned-item overrides (Option 1).
 * Idempotent: bumps a world setting revision once; future revisions may apply manifest-driven transforms.
 */

import { yieldToMain } from "./client-main-thread-cooperation.mjs";

/** Bump when a new automatic pass is added (manifest transforms, schema repair, etc.). */
export const CGS_GRANT_OVERRIDES_WORLD_MIGRATION_REVISION = 1;

/**
 * @param {{ game?: { user?: { isGM?: boolean }, actors?: unknown, settings?: { get?: Function, set?: Function } } }} deps
 * @returns {Promise<{ skipped: boolean, reason?: string, actorsScanned: number, embeddedItemsChecked: number }>}
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

    await game.settings.set("thirdera", key, CGS_GRANT_OVERRIDES_WORLD_MIGRATION_REVISION);
    console.log(
        `Third Era | CGS grant overrides / template scaffold (revision ${CGS_GRANT_OVERRIDES_WORLD_MIGRATION_REVISION}): ` +
            `scanned ${actors.length} actors, ${embeddedItemsChecked} embedded CGS-capable items (no destructive rewrite).`
    );
    return { skipped: false, actorsScanned: actors.length, embeddedItemsChecked };
}
