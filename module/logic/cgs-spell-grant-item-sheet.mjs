/**
 * Pure helpers for item-sheet UI over `system.cgsGrants.grants` spellGrant rows (Phase 5d item authoring).
 *
 * @param {unknown[]} grants
 * @param {{ spellNameForUuid?: (uuid: string) => string }} [deps]
 * @returns {Array<{
 *   grantIndex: number,
 *   spellUuid: string,
 *   displayName: string,
 *   usesPerDayValue: string,
 *   atWill: boolean,
 *   casterLevelValue: string,
 *   classItemId: string,
 *   label: string
 * }>}
 */
export function buildSpellGrantSheetRowsFromGrants(grants, deps = {}) {
    const spellNameForUuid = typeof deps.spellNameForUuid === "function" ? deps.spellNameForUuid : () => "";
    const rows = [];
    if (!Array.isArray(grants)) return rows;
    for (let i = 0; i < grants.length; i++) {
        const g = grants[i];
        if (!g || typeof g !== "object" || g.category !== "spellGrant") continue;
        const spellUuid = typeof g.spellUuid === "string" ? g.spellUuid.trim() : "";
        const resolved = spellUuid ? spellNameForUuid(spellUuid) : "";
        const displayName = (resolved && String(resolved).trim()) || spellUuid || "—";
        const ud = g.usesPerDay;
        const usesPerDayValue = typeof ud === "number" && Number.isFinite(ud) ? String(ud) : "";
        const cl = casterLevelRaw(g);
        const casterLevelValue = typeof cl === "number" && Number.isFinite(cl) ? String(cl) : "";
        rows.push({
            grantIndex: i,
            spellUuid,
            displayName,
            usesPerDayValue,
            atWill: g.atWill === true,
            casterLevelValue,
            classItemId: typeof g.classItemId === "string" ? g.classItemId : "",
            label: typeof g.label === "string" ? g.label : ""
        });
    }
    return rows;
}

/**
 * Normalize optional caster level from a grant object (string or number from JSON).
 * @param {unknown} g
 * @returns {number | undefined}
 */
function casterLevelRaw(g) {
    if (!g || typeof g !== "object") return undefined;
    const cl = g.casterLevel;
    if (typeof cl === "number" && Number.isFinite(cl)) return cl;
    if (typeof cl === "string" && cl.trim() !== "") {
        const n = Number(cl.trim());
        if (Number.isFinite(n)) return n;
    }
    return undefined;
}
