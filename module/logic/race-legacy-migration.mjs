/**
 * Pure helpers for migrating race items from legacy abilityAdjustments to system.changes (GMS).
 */

const ABILITY_KEYS_ORDER = ["str", "dex", "con", "int", "wis", "cha"];

/**
 * Build GMS change rows from legacy abilityAdjustments (non-zero only).
 * @param {Record<string, unknown>} adj  Legacy object with str, dex, … (may be partial)
 * @returns {Array<{ key: string, value: number, label: string }>}
 */
export function legacyAbilityAdjustmentsToChanges(adj) {
    if (!adj || typeof adj !== "object") return [];
    const out = [];
    for (const abil of ABILITY_KEYS_ORDER) {
        const value = Number(adj[abil]);
        if (Number.isNaN(value) || value === 0) continue;
        out.push({ key: `ability.${abil}`, value, label: "" });
    }
    return out;
}
