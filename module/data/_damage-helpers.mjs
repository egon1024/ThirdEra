/**
 * SRD weapon damage size progression helpers.
 *
 * The damage.dice field on a weapon stores the Medium-size base damage.
 * These helpers look up the effective damage for any of the 9 SRD size
 * categories using the official progression table.
 */

/** Size categories in order, matching CONFIG.THIRDERA.sizes keys. */
const SIZE_ORDER = [
    "Fine", "Diminutive", "Tiny", "Small", "Medium",
    "Large", "Huge", "Gargantuan", "Colossal"
];

/**
 * SRD damage progression table.
 * Key = Medium base damage string.
 * Value = 9-element array indexed by SIZE_ORDER (Fine → Colossal).
 * Index 4 is always Medium (the base value).
 * null entries mean the weapon is too small to deal meaningful damage.
 */
const DAMAGE_PROGRESSIONS = {
    "1d2":  [null,  null,  null,  "1",    "1d2",  "1d3",  "1d4",  "1d6",  "1d8"],
    "1d3":  [null,  null,  "1",   "1d2",  "1d3",  "1d4",  "1d6",  "1d8",  "2d6"],
    "1d4":  [null,  "1",   "1d2", "1d3",  "1d4",  "1d6",  "1d8",  "2d6",  "3d6"],
    "1d6":  ["1",   "1d2", "1d3", "1d4",  "1d6",  "1d8",  "2d6",  "3d6",  "4d6"],
    "1d8":  ["1d2", "1d3", "1d4", "1d6",  "1d8",  "2d6",  "3d6",  "4d6",  "6d6"],
    "1d10": ["1d3", "1d4", "1d6", "1d8",  "1d10", "2d8",  "3d8",  "4d8",  "6d8"],
    "1d12": ["1d4", "1d6", "1d8", "1d10", "1d12", "3d6",  "4d6",  "6d6",  "8d6"],
    "2d4":  ["1d2", "1d3", "1d4", "1d6",  "2d4",  "2d6",  "3d6",  "4d6",  "6d6"],
    "2d6":  ["1d4", "1d6", "1d8", "1d10", "2d6",  "3d6",  "4d6",  "6d6",  "8d6"],
    "2d8":  ["1d6", "1d8", "1d10","2d6",  "2d8",  "3d8",  "4d8",  "6d8",  "8d8"],
    "2d10": ["1d8", "1d10","2d6", "2d8",  "2d10", "4d8",  "6d8",  "8d8",  "12d8"]
};

/**
 * Look up the effective damage dice for a weapon given its Medium base
 * damage and its current size.
 *
 * @param {string} baseDice  The Medium base damage string (e.g. "1d8")
 * @param {string} size      A size category key from CONFIG.THIRDERA.sizes
 * @returns {string}         The effective damage dice string for that size
 */
export function getEffectiveDamage(baseDice, size) {
    const sizeIndex = SIZE_ORDER.indexOf(size);
    if (sizeIndex === -1) return baseDice;

    const progression = DAMAGE_PROGRESSIONS[baseDice];
    if (!progression) return baseDice;

    return progression[sizeIndex] ?? baseDice;
}
