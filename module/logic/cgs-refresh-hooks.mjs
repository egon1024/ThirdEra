/**
 * CGS propagation: after items or compendium docs change, re-run actor preparation,
 * re-render Third Era actor sheets, and refresh canvas tokens for affected actors.
 * Handlers use injectable deps for unit tests (no Foundry globals required in pure helpers).
 */

/** @typedef {{ getGame: () => object|undefined, getFoundry: () => object|undefined, getCanvas: () => object|undefined, getSystemId: () => string|undefined }} CgsRefreshDeps */

/**
 * Hook names registered by {@link registerCgsCapabilityRefreshHooks}.
 * @type {readonly string[]}
 */
export const CGS_CAPABILITY_REFRESH_HOOK_NAMES = Object.freeze(["updateCompendium", "updateActor"]);

/**
 * @param {object} [env]
 * @returns {CgsRefreshDeps}
 */
export function createDefaultCgsRefreshDeps(env = globalThis) {
    return {
        getGame: () => env.game,
        getFoundry: () => env.foundry,
        getCanvas: () => env.canvas,
        getSystemId: () => env.game?.system?.id
    };
}

/**
 * @param {Actor} actor
 * @returns {object[]}
 */
export function getActorEmbeddedItemsArray(actor) {
    const c = actor?.items;
    if (!c) return [];
    if (Array.isArray(c)) return c;
    try {
        if (typeof c.contents !== "undefined" && Array.isArray(c.contents)) return c.contents;
        if (typeof c[Symbol.iterator] === "function") return Array.from(c);
        if (typeof c.values === "function") return Array.from(c.values());
        if (typeof c.get === "function" && typeof c.keys === "function") {
            const out = [];
            for (const id of c.keys()) out.push(c.get(id));
            return out.filter(Boolean);
        }
        return [];
    } catch (_) {
        return [];
    }
}

/**
 * World actors plus actors on the active scene's tokens (mirrors equipment refresh scan).
 * @param {CgsRefreshDeps} deps
 * @returns {Actor[]}
 */
export function gatherActorsForCgsScan(deps) {
    const game = deps.getGame();
    const out = [];
    const seen = new Set();
    const add = (a) => {
        if (a?.id && !seen.has(a.id)) {
            seen.add(a.id);
            out.push(a);
        }
    };
    const list = game?.actors?.contents ?? game?.actors ?? [];
    for (const a of list) add(a);
    const canvas = deps.getCanvas?.();
    if (canvas?.scene?.tokens) {
        for (const token of canvas.scene.tokens) add(token.actor);
    }
    return out;
}

/**
 * @param {string} compendiumItemUuid
 * @param {Iterable<Actor>} actors
 * @returns {Actor[]}
 */
export function collectActorsReferencingCompendiumItemUuid(compendiumItemUuid, actors) {
    if (!compendiumItemUuid) return [];
    const hits = [];
    const seen = new Set();
    for (const actor of actors) {
        if (!actor?.id || seen.has(actor.id)) continue;
        const items = getActorEmbeddedItemsArray(actor);
        const match = items.some((it) => it?.sourceId === compendiumItemUuid);
        if (match) {
            seen.add(actor.id);
            hits.push(actor);
        }
    }
    return hits;
}

/**
 * @param {string} worldItemId
 * @param {Iterable<Actor>} actors
 * @returns {Actor[]}
 */
export function collectActorsWithEmbeddedItemId(worldItemId, actors) {
    if (!worldItemId) return [];
    const hits = [];
    const seen = new Set();
    for (const actor of actors) {
        if (!actor?.id || seen.has(actor.id)) continue;
        if (actor.items?.get?.(worldItemId)) {
            seen.add(actor.id);
            hits.push(actor);
        }
    }
    return hits;
}

/**
 * PCs whose embedded class items list this world feature id in `system.features[].featItemId` (Phase 5c CGS).
 *
 * @param {string} featureWorldId - World Item id (as stored on class feature rows)
 * @param {Iterable<Actor>} actors
 * @returns {Actor[]}
 */
export function collectActorsReferencingWorldFeatureItemId(featureWorldId, actors) {
    if (!featureWorldId) return [];
    const hits = [];
    const seen = new Set();
    for (const actor of actors) {
        if (actor?.type !== "character" || !actor.id || seen.has(actor.id)) continue;
        const items = getActorEmbeddedItemsArray(actor);
        const hasClassRef = items.some((it) => {
            if (it?.type !== "class") return false;
            const feats = it.system?.features;
            if (!Array.isArray(feats)) return false;
            return feats.some((f) => {
                const id = typeof f?.featItemId === "string" ? f.featItemId.trim() : "";
                return id === featureWorldId;
            });
        });
        if (hasClassRef) {
            seen.add(actor.id);
            hits.push(actor);
        }
    }
    return hits;
}

/**
 * When a world (sidebar) class-feature Item is updated, refresh PCs that grant it via a class table row.
 *
 * @param {Item} itemDoc
 * @param {CgsRefreshDeps} deps
 */
export async function refreshCapabilityGrantDependentsFromWorldFeatureItem(itemDoc, deps) {
    if (itemDoc?.type !== "feature" || itemDoc.isEmbedded || !itemDoc.id) return;
    const actors = gatherActorsForCgsScan(deps);
    const targets = collectActorsReferencingWorldFeatureItemId(itemDoc.id, actors);
    for (const a of targets) {
        await refreshCapabilityGrantsForActor(a, deps);
    }
}

/**
 * @param {object} flatChanges from flattenObject(changes)
 * @returns {boolean}
 */
export function actorUpdateTouchesCgsStoredFields(flatChanges) {
    return Object.keys(flatChanges).some(
        (k) => k.startsWith("system.cgsGrants") || k.startsWith("system.statBlock.senses")
    );
}

/**
 * Resolve owning actor for an embedded item (parent, UUID parse, fromUuid).
 *
 * @param {Item} itemDoc
 * @param {CgsRefreshDeps} deps
 * @returns {Promise<Actor|null>}
 */
export async function resolveParentActorForItem(itemDoc, deps) {
    let actor = itemDoc?.parent ?? itemDoc?.actor ?? itemDoc?.collection?.parent ?? null;
    const game = deps.getGame();
    const foundry = deps.getFoundry();
    if (!actor && itemDoc?.uuid && game?.actors) {
        const parts = String(itemDoc.uuid).split(".");
        if (parts[0] === "Actor" && parts[1]) {
            actor = game.actors.get(parts[1]) ?? null;
        }
        if (!actor && typeof foundry?.utils?.fromUuid === "function") {
            try {
                const resolved = await foundry.utils.fromUuid(itemDoc.uuid);
                actor = resolved?.parent ?? resolved?.actor ?? null;
            } catch (_) {
                /* ignore */
            }
        }
    }
    return actor ?? null;
}

/**
 * @param {string} actorId
 * @param {CgsRefreshDeps} deps
 */
export async function rerenderThirderaActorSheetsForActor(actorId, deps) {
    const foundry = deps.getFoundry();
    const instances = foundry?.applications?.instances;
    if (!instances) return;
    const sys = deps.getSystemId?.() ?? deps.getGame?.()?.system?.id;
    for (const app of instances.values()) {
        const doc = app.document;
        const appActor = app.actor ?? doc;
        if (appActor?.id !== actorId) continue;
        if (doc?.documentName === "Actor" && sys === "thirdera" && app.rendered) {
            // Do not use render({ force: true }): ApplicationV2 schedules bringToFront and steals z-order
            // from overlapping windows (e.g. world item sheet editing CGS while actor sheet is open).
            await app.render();
        }
    }
}

/**
 * @param {string} actorId
 * @param {CgsRefreshDeps} deps
 */
export function refreshCanvasTokensForActor(actorId, deps) {
    const canvas = deps.getCanvas?.();
    const placeables = canvas?.tokens?.placeables;
    if (!placeables?.length) return;
    for (const t of placeables) {
        if (t.actor?.id === actorId && typeof t.refresh === "function") {
            t.refresh();
        }
    }
}

/**
 * Re-run derived data and UI that consume CGS (sheets, tokens).
 *
 * @param {Actor} actor
 * @param {CgsRefreshDeps} deps
 * @param {{ skipPrepareData?: boolean }} [options]
 */
export async function refreshCapabilityGrantsForActor(actor, deps, options = {}) {
    if (!actor?.id) return;
    const { skipPrepareData = false } = options;
    if (!skipPrepareData && typeof actor.prepareData === "function") {
        await actor.prepareData();
    }
    await rerenderThirderaActorSheetsForActor(actor.id, deps);
    refreshCanvasTokensForActor(actor.id, deps);
}

/**
 * Phase 3 entry: item document updated — refresh parent actor or actors holding a copy by id.
 *
 * @param {Item} itemDoc
 * @param {CgsRefreshDeps} deps
 */
export async function refreshCapabilityGrantDependentsFromItem(itemDoc, deps) {
    const parent = await resolveParentActorForItem(itemDoc, deps);
    if (parent) {
        await refreshCapabilityGrantsForActor(parent, deps);
        return;
    }
    if (itemDoc?.id) {
        const actors = gatherActorsForCgsScan(deps);
        const targets = collectActorsWithEmbeddedItemId(itemDoc.id, actors);
        for (const a of targets) {
            await refreshCapabilityGrantsForActor(a, deps);
        }
    }
}

/**
 * @param {CompendiumCollection} _pack
 * @param {Document[]} documents
 * @param {object} _operation
 * @param {string} _userId
 * @param {CgsRefreshDeps} deps
 */
export async function handleUpdateCompendiumForCgs(_pack, documents, _operation, _userId, deps) {
    if (!documents?.length) return;
    const actors = gatherActorsForCgsScan(deps);
    const toRefresh = new Map();
    for (const doc of documents) {
        if (doc?.documentName !== "Item") continue;
        const compUuid = doc?.uuid;
        if (!compUuid) continue;
        for (const actor of collectActorsReferencingCompendiumItemUuid(compUuid, actors)) {
            toRefresh.set(actor.id, actor);
        }
    }
    for (const actor of toRefresh.values()) {
        await refreshCapabilityGrantsForActor(actor, deps);
    }
}

/**
 * @param {Actor} document
 * @param {object} changes
 * @param {CgsRefreshDeps} deps
 */
export async function handleUpdateActorForCgs(document, changes, deps) {
    const foundry = deps.getFoundry();
    if (!foundry?.utils?.flattenObject) return;
    const flat = foundry.utils.flattenObject(changes);
    if (!actorUpdateTouchesCgsStoredFields(flat)) return;
    await refreshCapabilityGrantsForActor(document, deps, { skipPrepareData: true });
}

/**
 * @param {object} [hooks]  Object with `.on(name, fn)` — defaults to globalThis.Hooks
 * @param {CgsRefreshDeps|null} [deps]
 */
export function registerCgsCapabilityRefreshHooks(hooks = globalThis.Hooks, deps = null) {
    const d = deps ?? createDefaultCgsRefreshDeps();

    hooks.on("updateCompendium", async (pack, documents, operation, userId) => {
        await handleUpdateCompendiumForCgs(pack, documents, operation, userId, d);
    });

    hooks.on("updateActor", async (document, changes, _options, _userId) => {
        await handleUpdateActorForCgs(document, changes, d);
    });
}
