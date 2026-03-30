/**
 * Resolve effective CGS grant payloads for owned items (feat, armor, equipment, weapon).
 * Precedence: non-empty `system.cgsGrants.grants` → rows in `system.cgsGrants.senses` mapped to sense grants.
 * No stock fallback (races use {@link ./cgs-stock-race-grants.mjs}).
 *
 * @see .cursor/plans/cgs-phased-implementation.md (Phase 5b)
 */

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
 * @param {unknown} item - Item-like (feat, armor, equipment, weapon)
 * @returns {Array<Record<string, unknown>>}
 */
export function getEffectiveOwnedItemCgsGrants(item) {
    if (!item || typeof item !== "object") return [];
    const sys = /** @type {{ cgsGrants?: { grants?: unknown, senses?: unknown } }} */ (item).system ?? {};
    const cg = sys.cgsGrants ?? {};
    const rawGrants = cg.grants;
    if (Array.isArray(rawGrants) && rawGrants.length > 0) {
        return rawGrants.slice();
    }
    return mapCgsSensesRowsToSenseGrants(cg.senses);
}
