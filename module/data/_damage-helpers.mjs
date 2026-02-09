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

/** Handedness categories in order from lightest to heaviest. */
const HANDEDNESS_ORDER = ["light", "oneHanded", "twoHanded"];

/**
 * Determine how a weapon's handedness and attack penalty are affected when
 * the weapon's size differs from the wielder's size (SRD rules).
 *
 * @param {string} weaponSize       Size key of the weapon (e.g. "Large")
 * @param {string} weaponHandedness Base handedness key (e.g. "oneHanded")
 * @param {string} wielderSize      Size key of the wielder (e.g. "Medium")
 * @returns {{ effectiveHandedness: string|null, attackPenalty: number, canWield: boolean }}
 */
export function getWieldingInfo(weaponSize, weaponHandedness, wielderSize) {
    const weaponSizeIdx = SIZE_ORDER.indexOf(weaponSize);
    const wielderSizeIdx = SIZE_ORDER.indexOf(wielderSize);
    const handednessIdx = HANDEDNESS_ORDER.indexOf(weaponHandedness);

    // If any input is unrecognized, return safe defaults
    if (weaponSizeIdx === -1 || wielderSizeIdx === -1 || handednessIdx === -1) {
        return { effectiveHandedness: weaponHandedness, attackPenalty: 0, canWield: true, wielderSize };
    }

    const sizeSteps = weaponSizeIdx - wielderSizeIdx;

    // No mismatch
    if (sizeSteps === 0) {
        return { effectiveHandedness: weaponHandedness, attackPenalty: 0, canWield: true, wielderSize };
    }

    const effectiveIdx = handednessIdx + sizeSteps;
    const canWield = effectiveIdx >= 0 && effectiveIdx <= 2;
    const effectiveHandedness = canWield ? HANDEDNESS_ORDER[effectiveIdx] : null;
    const attackPenalty = Math.abs(sizeSteps) * -2;

    return { effectiveHandedness, attackPenalty, canWield, wielderSize };
}

/**
 * Compute two-weapon fighting attack penalties based on the off-hand weapon's
 * effective handedness (SRD Table: Two-Weapon Fighting Penalties).
 *
 * @param {string} offhandEffectiveHandedness  "light" or "oneHanded"
 * @returns {{ primaryPenalty: number, offhandPenalty: number }}
 */
export function getTWFPenalties(offhandEffectiveHandedness) {
    if (offhandEffectiveHandedness === "light") {
        return { primaryPenalty: -4, offhandPenalty: -8 };
    }
    // One-handed (or anything else) off-hand
    return { primaryPenalty: -6, offhandPenalty: -10 };
}

/**
 * Return the STR damage multiplier for a weapon based on which hand it is
 * wielded in and its effective handedness.
 *
 * @param {string} hand                   "primary", "offhand", or "none"
 * @param {string} effectiveHandedness    "light", "oneHanded", or "twoHanded"
 * @returns {number}  1.0, 0.5, or 1.5
 */
export function getStrMultiplier(hand, effectiveHandedness) {
    if (hand === "offhand") return 0.5;
    if (effectiveHandedness === "twoHanded") return 1.5;
    return 1.0;
}

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
