/**
 * CGS contributions from embedded race, feat, and equipped armor/equipment/weapon (Phase 5b).
 * Apply rules mirror {@link itemsModifierProvider} in modifier-aggregation.mjs.
 *
 * Items expose optional `system.cgsGrants.grants` (same discriminated shape as conditions).
 * Races also resolve `system.cgsGrants.senses` and stock `race-*` compendium defaults when grants are empty.
 *
 * @see .cursor/plans/cgs-phased-implementation.md (Phase 5b)
 */

import { getEffectiveRaceCgsGrants } from "./cgs-stock-race-grants.mjs";

/**
 * @param {unknown} item
 * @param {string} defaultLabel
 * @param {unknown[]} grants
 * @returns {{ label: string, grants: unknown[], sourceRef: Record<string, unknown> } | null}
 */
function cgsContributionFromGrants(item, defaultLabel, grants) {
    if (!item || typeof item !== "object") return null;
    if (!Array.isArray(grants) || grants.length === 0) return null;
    const uuid = typeof item.uuid === "string" ? item.uuid.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const label = name || defaultLabel;
    return {
        label,
        grants,
        sourceRef: {
            kind: "item",
            ...(uuid ? { uuid } : {})
        }
    };
}

/**
 * @param {unknown} item
 * @param {string} defaultLabel
 * @returns {{ label: string, grants: unknown[], sourceRef: Record<string, unknown> } | null}
 */
export function cgsContributionFromOwnedItem(item, defaultLabel) {
    const sys = item?.system;
    const grants = sys?.cgsGrants?.grants;
    return cgsContributionFromGrants(item, defaultLabel, Array.isArray(grants) ? grants : []);
}

/**
 * Race item: explicit grants, then senses rows, then stock defaults for `race-*` compendium ids.
 * @param {unknown} item
 * @returns {{ label: string, grants: unknown[], sourceRef: Record<string, unknown> } | null}
 */
export function cgsContributionFromRaceItem(item) {
    const grants = getEffectiveRaceCgsGrants(item);
    return cgsContributionFromGrants(item, "Race", grants);
}

/**
 * @param {unknown} actor
 * @returns {Array<{ label: string, grants: unknown[], sourceRef: Record<string, unknown> }>}
 */
export function cgsEmbeddedItemGrantsProvider(actor) {
    const items = actor?.items;
    if (!items) return [];
    const list =
        Array.isArray(items) ? items : typeof items[Symbol.iterator] === "function" ? Array.from(items) : [];
    /** @type {Array<{ label: string, grants: unknown[], sourceRef: Record<string, unknown> }>} */
    const out = [];
    for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const type = item.type;
        if (type === "race") {
            const c = cgsContributionFromRaceItem(item);
            if (c) out.push(c);
            continue;
        }
        if (type === "feat") {
            const c = cgsContributionFromOwnedItem(item, "Feat");
            if (c) out.push(c);
            continue;
        }
        if (type === "armor" || type === "equipment") {
            if (item.system?.equipped !== "true") continue;
            const c = cgsContributionFromOwnedItem(item, type === "armor" ? "Armor" : "Equipment");
            if (c) out.push(c);
            continue;
        }
        if (type === "weapon") {
            const eq = item.system?.equipped;
            if (eq !== "primary" && eq !== "offhand") continue;
            const c = cgsContributionFromOwnedItem(item, "Weapon");
            if (c) out.push(c);
        }
    }
    return out;
}
