/**
 * Resolve effective CGS grant payloads for owned items (feat, creatureFeature, class feature, armor, equipment, weapon).
 * Precedence: merged effective `cgsGrants` shape (template resolution + {@link ./cgs-grant-template-merge.mjs} overrides),
 * then non-empty `.grants` → rows in `.senses` mapped to sense grants.
 * No stock fallback (races use {@link ./cgs-stock-race-grants.mjs}).
 *
 * @see .cursor/plans/cgs-phased-implementation.md (Phase 5b)
 */

import { getEffectiveCgsGrantShapeForOwnedItem } from "./cgs-grant-template-merge.mjs";

/**
 * @param {unknown} senses
 * @returns {Array<{ category: string, senseType: string, range: string }>}
 */
export function mapCgsSensesRowsToSenseGrants(senses) {
    if (!Array.isArray(senses) || senses.length === 0) return [];
    /** @type {Array<{ category: string, senseType: string, range: string }>} */
    const out = [];
    for (const s of senses) {
        if (!s || typeof s !== "object") continue;
        const st = typeof /** @type {{ type?: string }} */ (s).type === "string" ? s.type.trim() : "";
        if (!st) continue;
        const range = typeof /** @type {{ range?: string }} */ (s).range === "string" ? s.range : "";
        out.push({ category: "sense", senseType: st, range });
    }
    return out;
}

/**
 * @param {unknown} item - Item-like (feat, creatureFeature, armor, equipment, weapon)
 * @param {{ fromUuidSync?: (uuid: string) => unknown, _resolvedCache?: Map<string, unknown> }} [deps] - inject for unit tests / perf cache within one derivation pass
 * @returns {Array<Record<string, unknown>>}
 */
export function getEffectiveOwnedItemCgsGrants(item, deps) {
    if (!item || typeof item !== "object") return [];
    const merged = getEffectiveCgsGrantShapeForOwnedItem(item, deps ?? {});
    const rawGrants = merged.grants;
    if (Array.isArray(rawGrants) && rawGrants.length > 0) {
        return rawGrants.slice();
    }
    return mapCgsSensesRowsToSenseGrants(merged.senses);
}
