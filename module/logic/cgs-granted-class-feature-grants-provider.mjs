/**
 * CGS from class-feature rows on embedded *class* items (Phase 5c).
 * Resolves world `feature` documents by `featItemId` when the PC has enough levels in that class.
 * Skips when the actor already owns an embedded `feature` item tied to the same world document
 * (`sourceId` or same `id`), so {@link cgsEmbeddedItemGrantsProvider} does not double-count.
 *
 * @see .cursor/plans/cgs-phased-implementation.md (Phase 5c)
 */

import { getEffectiveOwnedItemCgsGrants } from "./cgs-owned-item-grants.mjs";

/**
 * @param {unknown} actor
 * @returns {unknown[]}
 */
function getActorOwnedItems(actor) {
    const items = actor?.items;
    if (!items) return [];
    if (Array.isArray(items)) return items;
    try {
        if (typeof items[Symbol.iterator] === "function") return Array.from(items);
        if (typeof items.contents !== "undefined" && Array.isArray(items.contents)) return items.contents;
        if (typeof items.values === "function") return Array.from(items.values());
        if (typeof items.get === "function" && typeof items.keys === "function") {
            const out = [];
            for (const id of items.keys()) out.push(items.get(id));
            return out.filter(Boolean);
        }
    } catch (_) {
        /* ignore */
    }
    return [];
}

/**
 * @param {unknown} actor
 * @param {unknown} worldItem - Resolved Item from `game.items.get(featItemId)`
 * @returns {boolean}
 */
export function actorHasEmbeddedFeatureMatchingWorldItem(actor, worldItem) {
    if (!actor || !worldItem || typeof worldItem !== "object") return false;
    const wUuid = typeof worldItem.uuid === "string" ? worldItem.uuid.trim() : "";
    const wId = typeof worldItem.id === "string" ? worldItem.id.trim() : "";
    if (!wUuid && !wId) return false;
    for (const item of getActorOwnedItems(actor)) {
        if (!item || item.type !== "feature") continue;
        const sid = typeof item.sourceId === "string" ? item.sourceId.trim() : "";
        if (wUuid && sid === wUuid) return true;
        const iid = typeof item.id === "string" ? item.id.trim() : "";
        if (wId && iid === wId) return true;
    }
    return false;
}

/**
 * @typedef {{ getItem?: (id: string) => unknown }} CgsClassFeatureDeps
 */

/**
 * @param {unknown} actor
 * @param {CgsClassFeatureDeps} [deps]
 * @returns {Array<{ label: string, grants: unknown[], sourceRef: Record<string, unknown> }>}
 */
export function cgsGrantedClassFeatureGrantsProvider(actor, deps = {}) {
    try {
        return cgsGrantedClassFeatureGrantsProviderImpl(actor, deps);
    } catch (e) {
        console.warn?.("ThirdEra | cgsGrantedClassFeatureGrantsProvider failed:", e);
        return [];
    }
}

/**
 * @param {unknown} actor
 * @param {CgsClassFeatureDeps} [deps]
 * @returns {Array<{ label: string, grants: unknown[], sourceRef: Record<string, unknown> }>}
 */
function cgsGrantedClassFeatureGrantsProviderImpl(actor, deps = {}) {
    const getItem =
        typeof deps.getItem === "function"
            ? deps.getItem
            : (id) => globalThis.game?.items?.get?.(id);

    if (!actor || typeof actor !== "object" || actor.type !== "character") return [];

    const levelHistory = actor.system?.levelHistory;
    if (!Array.isArray(levelHistory) || levelHistory.length === 0) return [];

    /** @type {Map<string, number>} */
    const classLevelCounts = new Map();
    for (const entry of levelHistory) {
        if (!entry || typeof entry !== "object") continue;
        const cid = typeof entry.classItemId === "string" ? entry.classItemId.trim() : "";
        if (!cid) continue;
        classLevelCounts.set(cid, (classLevelCounts.get(cid) ?? 0) + 1);
    }

    const owned = getActorOwnedItems(actor);
    const classItems = owned.filter((i) => i?.type === "class");
    if (classItems.length === 0) return [];

    /** @type {Array<{ label: string, grants: unknown[], sourceRef: Record<string, unknown> }>} */
    const out = [];

    for (const cls of classItems) {
        const cid = typeof cls.id === "string" ? cls.id : "";
        const lvl = cid ? classLevelCounts.get(cid) ?? 0 : 0;
        if (lvl <= 0) continue;

        const features = cls.system?.features;
        if (!Array.isArray(features)) continue;

        for (const feature of features) {
            if (!feature || typeof feature !== "object") continue;
            const grantLevel = feature.level;
            if (typeof grantLevel !== "number" || grantLevel > lvl) continue;

            const featItemId = typeof feature.featItemId === "string" ? feature.featItemId.trim() : "";
            if (!featItemId) continue;

            const worldItem = getItem(featItemId);
            if (!worldItem || typeof worldItem !== "object" || worldItem.type !== "feature") continue;

            if (actorHasEmbeddedFeatureMatchingWorldItem(actor, worldItem)) continue;

            const grants = getEffectiveOwnedItemCgsGrants(worldItem);
            if (!grants.length) continue;

            const featName = typeof feature.featName === "string" ? feature.featName.trim() : "";
            const wname = typeof worldItem.name === "string" ? worldItem.name.trim() : "";
            const label = featName || wname || "Class feature";

            const uuid = typeof worldItem.uuid === "string" ? worldItem.uuid.trim() : "";
            const id = typeof worldItem.id === "string" ? worldItem.id.trim() : "";

            out.push({
                label,
                grants,
                sourceRef: {
                    kind: "item",
                    ...(uuid ? { uuid } : {}),
                    ...(id ? { id } : {})
                }
            });
        }
    }

    return out;
}

