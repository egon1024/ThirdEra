/**
 * Actor-persisted cast counts for CGS spell grants (SLA-style), keyed by merged grant `spellUuid`.
 * Separate from embedded spell `system.cast` (class slots / preparation).
 */

/**
 * @param {unknown} actorSystem — `actor.system`
 * @param {string} spellUuid — merged row `spellUuid`
 * @returns {number}
 */
export function getCgsSpellGrantCastTotal(actorSystem, spellUuid) {
    const u = typeof spellUuid === "string" ? spellUuid.trim() : "";
    if (!u) return 0;
    const m = actorSystem?.cgsSpellGrantCasts;
    if (!m || typeof m !== "object") return 0;
    return Number(/** @type {Record<string, unknown>} */ (m)[u]) || 0;
}

/**
 * @param {Record<string, number>} [existing]
 * @param {string} spellUuid
 * @returns {Record<string, number>}
 */
export function incrementCgsSpellGrantCastsMap(existing, spellUuid) {
    const k = typeof spellUuid === "string" ? spellUuid.trim() : "";
    if (!k) return existing && typeof existing === "object" ? { ...existing } : {};
    const base = existing && typeof existing === "object" ? { ...existing } : {};
    base[k] = (Number(base[k]) || 0) + 1;
    return base;
}
