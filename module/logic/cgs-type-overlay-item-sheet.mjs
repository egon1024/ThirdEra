/**
 * Pure helpers for item-sheet UI over `system.cgsGrants.grants` creature type / subtype overlay rows (Phase 5f).
 *
 * @see .cursor/plans/cgs-phased-implementation.md (Phase 5f)
 */

/**
 * @param {unknown[]} grants
 * @returns {Array<{ grantIndex: number, typeUuid: string }>}
 */
export function buildCreatureTypeOverlaySheetRowsFromGrants(grants) {
    const rows = [];
    if (!Array.isArray(grants)) return rows;
    for (let i = 0; i < grants.length; i++) {
        const g = grants[i];
        if (!g || typeof g !== "object" || g.category !== "creatureTypeOverlay") continue;
        const typeUuid = typeof g.typeUuid === "string" ? g.typeUuid.trim() : "";
        rows.push({ grantIndex: i, typeUuid });
    }
    return rows;
}

/**
 * @param {unknown[]} grants
 * @returns {Array<{ grantIndex: number, subtypeUuid: string }>}
 */
export function buildSubtypeOverlaySheetRowsFromGrants(grants) {
    const rows = [];
    if (!Array.isArray(grants)) return rows;
    for (let i = 0; i < grants.length; i++) {
        const g = grants[i];
        if (!g || typeof g !== "object" || g.category !== "subtypeOverlay") continue;
        const subtypeUuid = typeof g.subtypeUuid === "string" ? g.subtypeUuid.trim() : "";
        rows.push({ grantIndex: i, subtypeUuid });
    }
    return rows;
}
