/**
 * Concentration check DC formulas (D&D 3.5 SRD-style).
 * Used by cast-chat concentration UI and future dialogs (Track A).
 */

/**
 * @param {number} spellLevel - Level of the spell being cast (typically 0–9)
 * @returns {number} DC, or NaN if `spellLevel` is not a finite number
 */
function _finiteSpellLevel(spellLevel) {
    const sl = Number(spellLevel);
    return Number.isFinite(sl) ? sl : NaN;
}

/**
 * @param {number} n
 * @returns {number}
 */
function _nonNegativeTrunc(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return NaN;
    return Math.max(0, Math.trunc(v));
}

/**
 * Cast defensively (avoid provoking attacks of opportunity). SRD: DC 15 + spell level.
 * @param {number} spellLevel - Level of the spell being cast
 * @returns {number}
 */
export function defensiveDc(spellLevel) {
    const sl = _finiteSpellLevel(spellLevel);
    if (Number.isNaN(sl)) return NaN;
    return 15 + sl;
}

/**
 * Concentration DC after taking damage while casting. SRD: DC 10 + damage dealt + spell level.
 * @param {number} damageDealt - Hit points of damage taken (non-negative; truncated toward zero)
 * @param {number} spellLevel - Level of the spell being cast
 * @returns {number}
 */
export function damageWhileCastingDc(damageDealt, spellLevel) {
    const dmg = _nonNegativeTrunc(damageDealt);
    const sl = _finiteSpellLevel(spellLevel);
    if (Number.isNaN(dmg) || Number.isNaN(sl)) return NaN;
    return 10 + dmg + sl;
}

/*
 * --- Planned (UI / adjudication in later phases) ---
 *
 * Vigorous motion (horseback, boat, etc.): DC 10 + spell level
 * Entangled: DC 15 + spell level
 * Grappling / pinned while casting: DC = opponent’s grapple check result + spell level
 * Weather: use the SRD table (e.g. wind + rain DC 5 + spell level, storm DC 10 + spell level, …)
 */
