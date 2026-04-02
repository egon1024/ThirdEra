/**
 * Pure helpers for item-sheet UI over `system.cgsGrants.grants` typed defense rows (Phase 5e).
 * Categories: immunity, energyResistance, damageReduction.
 *
 * @see .cursor/plans/cgs-phased-implementation.md (Phase 5e)
 */

/**
 * @param {unknown[]} grants
 * @returns {Array<{ grantIndex: number, tag: string }>}
 */
export function buildImmunitySheetRowsFromGrants(grants) {
    const rows = [];
    if (!Array.isArray(grants)) return rows;
    for (let i = 0; i < grants.length; i++) {
        const g = grants[i];
        if (!g || typeof g !== "object" || g.category !== "immunity") continue;
        const tag = typeof g.tag === "string" ? g.tag.trim() : "";
        rows.push({ grantIndex: i, tag });
    }
    return rows;
}

/**
 * @param {unknown[]} grants
 * @returns {Array<{ grantIndex: number, energyType: string, amount: string }>}
 */
export function buildEnergyResistanceSheetRowsFromGrants(grants) {
    const rows = [];
    if (!Array.isArray(grants)) return rows;
    for (let i = 0; i < grants.length; i++) {
        const g = grants[i];
        if (!g || typeof g !== "object" || g.category !== "energyResistance") continue;
        const energyType = typeof g.energyType === "string" ? g.energyType.trim() : "";
        const amt = g.amount;
        const amount = typeof amt === "number" && Number.isFinite(amt) ? String(amt) : "";
        rows.push({ grantIndex: i, energyType, amount });
    }
    return rows;
}

/**
 * @param {unknown[]} grants
 * @returns {Array<{ grantIndex: number, value: string, bypass: string }>}
 */
export function buildDamageReductionSheetRowsFromGrants(grants) {
    const rows = [];
    if (!Array.isArray(grants)) return rows;
    for (let i = 0; i < grants.length; i++) {
        const g = grants[i];
        if (!g || typeof g !== "object" || g.category !== "damageReduction") continue;
        const val = g.value;
        const value = typeof val === "number" && Number.isFinite(val) ? String(val) : "";
        const bypass = typeof g.bypass === "string" ? g.bypass.trim() : "";
        rows.push({ grantIndex: i, value, bypass });
    }
    return rows;
}
