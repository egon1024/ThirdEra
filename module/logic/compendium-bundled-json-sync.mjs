/**
 * World migration: re-apply selected compendium packs from bundled `packs/*.json` when the
 * shipped {@link BUNDLED_COMPENDIUM_SYNC_MIGRATION_REVISION} advances (existing worlds skip
 * {@link CompendiumLoader.loadPackFromJSON} when the pack index is non-empty).
 *
 * **Future (manual sync):** Call {@link syncBundledCompendiumJsonForCollections} with the same
 * `deps` shape and an explicit list of `pack.collection` ids — no world revision bookkeeping required.
 */
import { CompendiumLoader } from "./compendium-loader.mjs";
import { yieldToMain } from "./client-main-thread-cooperation.mjs";

/** World setting key (registered in `thirdera.mjs`). Last applied {@link BUNDLED_COMPENDIUM_SYNC_MIGRATION_REVISION}. */
export const BUNDLED_COMPENDIUM_SYNC_WORLD_SETTING = "bundledCompendiumSyncMigrationRevision";

/**
 * Bump when bundled JSON for any pack in {@link BUNDLED_COMPENDIUM_SYNC_PACK_COLLECTIONS} should be
 * re-applied to worlds that already have a non-empty compendium index.
 */
export const BUNDLED_COMPENDIUM_SYNC_MIGRATION_REVISION = 3;

/** `pack.collection` ids to refresh from disk when the migration revision advances. */
export const BUNDLED_COMPENDIUM_SYNC_PACK_COLLECTIONS = Object.freeze(["thirdera.thirdera_creature_features"]);

/**
 * @param {unknown} appliedRevision - stored world setting value
 * @param {number} [targetRevision] - defaults to {@link BUNDLED_COMPENDIUM_SYNC_MIGRATION_REVISION}
 */
export function isBundledCompendiumMigrationPending(appliedRevision, targetRevision = BUNDLED_COMPENDIUM_SYNC_MIGRATION_REVISION) {
    const applied = Number(appliedRevision);
    const target = Number(targetRevision);
    if (!Number.isFinite(applied) || applied < 0) return true;
    if (!Number.isFinite(target) || target < 0) return false;
    return applied < target;
}

/**
 * @typedef {object} BundledCompendiumJsonSyncDeps
 * @property {Game} game
 * @property {typeof CompendiumLoader} CompendiumLoader
 * @property {Record<string, string[]>} fileMappings - typically `CompendiumLoader.FILE_MAPPINGS`
 * @property {() => Promise<void>} [yieldToMain] - optional cooperative yield between packs
 */

/**
 * Core sync: apply bundled JSON to the given compendium collections, bypassing the “empty pack only” gate.
 * Does **not** read or write world migration settings.
 *
 * @param {BundledCompendiumJsonSyncDeps} deps
 * @param {readonly string[]} collectionIds - `pack.collection` values (e.g. `thirdera.thirdera_creature_features`)
 * @returns {Promise<{ results: Array<{ collection: string, skipped: boolean, reason?: string, created: number, updated: number }>, totalCreated: number, totalUpdated: number }>}
 */
export async function syncBundledCompendiumJsonForCollections(deps, collectionIds) {
    const { game, CompendiumLoader: Loader, fileMappings } = deps;
    const yieldFn = deps.yieldToMain ?? yieldToMain;

    /** @type {Array<{ collection: string, skipped: boolean, reason?: string, created: number, updated: number }>} */
    const results = [];
    let totalCreated = 0;
    let totalUpdated = 0;

    for (const collection of collectionIds) {
        const fileList = fileMappings[collection];
        if (!Array.isArray(fileList) || fileList.length === 0) {
            results.push({ collection, skipped: true, reason: "no-file-mapping", created: 0, updated: 0 });
            continue;
        }
        const pack = game.packs.get(collection);
        if (!pack) {
            results.push({ collection, skipped: true, reason: "pack-not-found", created: 0, updated: 0 });
            console.warn(`Third Era | Bundled compendium sync: pack not found: ${collection}`);
            continue;
        }
        const res = await Loader.loadPackFromJSON(pack, fileList, { bypassPopulationGate: true });
        if (res.gateSkipped) {
            results.push({ collection, skipped: true, reason: "gate-skipped", created: 0, updated: 0 });
            continue;
        }
        totalCreated += res.created;
        totalUpdated += res.updated;
        results.push({ collection, skipped: false, created: res.created, updated: res.updated });
        await yieldFn();
    }

    return { results, totalCreated, totalUpdated };
}

/**
 * @param {BundledCompendiumJsonSyncDeps & {
 *   getAppliedRevision: () => number | Promise<number>,
 *   setAppliedRevision: (rev: number) => void | Promise<void>,
 *   localize: (key: string, data?: Record<string, string | number>) => string,
 *   notifyInfo: (message: string) => void,
 *   notifyWarn?: (message: string) => void
 * }} deps
 * @returns {Promise<{ ran: false, reason: string } | { ran: true, totalCreated: number, totalUpdated: number, packLabels: string }>}
 */
export async function runBundledCompendiumJsonWorldMigrationIfNeeded(deps) {
    if (!deps.game?.user?.isGM) {
        return { ran: false, reason: "not-gm" };
    }

    const applied = await Promise.resolve(deps.getAppliedRevision());
    if (!isBundledCompendiumMigrationPending(applied)) {
        return { ran: false, reason: "already-current" };
    }

    for (const collection of BUNDLED_COMPENDIUM_SYNC_PACK_COLLECTIONS) {
        const fileList = deps.fileMappings[collection];
        if (!Array.isArray(fileList) || fileList.length === 0) {
            const msg = deps.localize("THIRDERA.Notifications.BundledCompendiumSyncMissingFileMapping", { pack: collection });
            (deps.notifyWarn ?? deps.notifyInfo)(msg);
            return { ran: false, reason: "no-file-mapping" };
        }
        if (!deps.game.packs.get(collection)) {
            const msg = deps.localize("THIRDERA.Notifications.BundledCompendiumSyncMissingPacks", { packs: collection });
            (deps.notifyWarn ?? deps.notifyInfo)(msg);
            return { ran: false, reason: "pack-missing" };
        }
    }

    try {
        const { results, totalCreated, totalUpdated } = await syncBundledCompendiumJsonForCollections(
            deps,
            BUNDLED_COMPENDIUM_SYNC_PACK_COLLECTIONS
        );

        const missing = results.filter((r) => r.skipped && r.reason === "pack-not-found");
        if (missing.length > 0) {
            const msg = deps.localize("THIRDERA.Notifications.BundledCompendiumSyncMissingPacks", {
                packs: missing.map((m) => m.collection).join(", ")
            });
            (deps.notifyWarn ?? deps.notifyInfo)(msg);
            return { ran: false, reason: "pack-missing" };
        }

        await Promise.resolve(deps.setAppliedRevision(BUNDLED_COMPENDIUM_SYNC_MIGRATION_REVISION));

        const labels = results
            .filter((r) => !r.skipped)
            .map((r) => {
                const pack = deps.game.packs.get(r.collection);
                return pack?.metadata?.label ?? r.collection;
            })
            .join(", ");

        const message = deps.localize("THIRDERA.Notifications.BundledCompendiumSyncDone", {
            packs: labels || BUNDLED_COMPENDIUM_SYNC_PACK_COLLECTIONS.join(", "),
            created: totalCreated,
            updated: totalUpdated
        });
        deps.notifyInfo(message);

        console.log(
            `Third Era | Bundled compendium migration revision ${BUNDLED_COMPENDIUM_SYNC_MIGRATION_REVISION} applied ` +
                `(${totalCreated} created, ${totalUpdated} updated).`
        );

        return { ran: true, totalCreated, totalUpdated, packLabels: labels };
    } catch (err) {
        console.error("Third Era | Bundled compendium migration failed:", err);
        const failMsg = deps.localize("THIRDERA.Notifications.BundledCompendiumSyncFailed");
        (deps.notifyWarn ?? deps.notifyInfo)(failMsg);
        return { ran: false, reason: "error" };
    }
}

/**
 * Default deps for {@link syncBundledCompendiumJsonForCollections} / manual triggers (GM client).
 * @returns {BundledCompendiumJsonSyncDeps}
 */
export function createDefaultBundledCompendiumJsonSyncDeps() {
    return {
        game: globalThis.game,
        CompendiumLoader,
        fileMappings: CompendiumLoader.FILE_MAPPINGS,
        yieldToMain
    };
}
