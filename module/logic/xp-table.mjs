/**
 * Experience point thresholds for character level advancement.
 * SRD: https://www.d20srd.org/srd/xp.htm
 * Epic (21+): https://www.d20srd.org/srd/epic/basics.htm — "Double the XP required
 * to advance between two levels that are two levels below their current level."
 */

/** Cumulative XP required to reach each level (1–20). Index 0 = level 1, index 19 = level 20. */
export const SRD_XP_TABLE = [
    0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000,
    55000, 66000, 78000, 91000, 105000, 120000, 136000, 153000, 171000, 190000
];

/**
 * Returns the cumulative XP required to reach the given character level.
 * Levels 1–20 use the SRD table; levels 21+ use the Epic formula.
 * @param {number} level - Character level (1-based).
 * @returns {number} Cumulative XP needed to be at that level.
 */
export function getXpForLevel(level) {
    const n = Math.floor(Number(level));
    if (n < 1 || !Number.isFinite(n)) return 0;
    if (n <= 20) return SRD_XP_TABLE[n - 1];

    // Epic: increment to level N = 2 × (XP[N-2] − XP[N-3]); i.e. double the
    // XP needed to go from (N-3) to (N-2). Then add to XP for level N-1.
    const xpPrev = getXpForLevel(n - 1);
    const xpPrev2 = getXpForLevel(n - 2);
    const xpPrev3 = getXpForLevel(n - 3);
    const increment = 2 * (xpPrev2 - xpPrev3);
    return xpPrev + increment;
}

/**
 * Returns the XP at the midpoint of the given level's range (between this level's minimum
 * and the next level's threshold). Used for level-down optional XP adjustment.
 * "Minimum of new level" is getXpForLevel(newTotalLevel).
 * @param {number} level - Character level (0-based or 1-based; for level < 1 returns 0).
 * @returns {number} Midpoint XP (integer, floored).
 */
export function getMidpointXpForLevel(level) {
    const n = Math.floor(Number(level));
    if (n < 1 || !Number.isFinite(n)) return 0;
    const minXp = getXpForLevel(n);
    const nextXp = getXpForLevel(n + 1);
    return Math.floor((minXp + nextXp) / 2);
}

/**
 * Returns the cumulative XP required to reach the next level after the given total level.
 * Used for "Next level at X" on the character sheet. Supports Epic (e.g. level 20 → 226000).
 * @param {number} totalLevel - Current total character level (from levelHistory.length).
 * @returns {number} Cumulative XP required to reach totalLevel + 1.
 */
export function getNextLevelXp(totalLevel) {
    const n = Math.floor(Number(totalLevel));
    if (n < 0 || !Number.isFinite(n)) return getXpForLevel(1); // 1000 for level 2
    return getXpForLevel(n + 1);
}
