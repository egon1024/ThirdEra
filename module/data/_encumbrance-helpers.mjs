/**
 * Shared encumbrance and carrying capacity logic for D&D 3.5.
 */

/**
 * Maximum load for a Medium creature based on Strength.
 * @type {Object<number, number>}
 */
const MAX_LOAD_TABLE = {
    1: 10, 2: 20, 3: 30, 4: 40, 5: 50, 6: 60, 7: 70, 8: 80, 9: 90, 10: 100,
    11: 115, 12: 130, 13: 150, 14: 175, 15: 200, 16: 230, 17: 260, 18: 300, 19: 350,
    20: 400, 21: 460, 22: 520, 23: 600, 24: 700, 25: 800, 26: 920, 27: 1040, 28: 1200, 29: 1400
};

/**
 * Calculate carrying capacity thresholds for a creature.
 * @param {number} strength  The Strength score.
 * @param {string} size      The creature's size.
 * @returns {{light: number, medium: number, heavy: number}}
 */
export function getCarryingCapacity(strength, size = "Medium") {
    if (strength < 1) return { light: 0, medium: 0, heavy: 0 };

    let maxLoad;
    if (strength <= 29) {
        maxLoad = MAX_LOAD_TABLE[strength] || 0;
    } else {
        // For scores > 29, find the score with the same last digit in 20-29 and multiply by 4^((str-lastDigit)/10)
        const lastDigit = strength % 10;
        const baseStr = 20 + lastDigit;
        const multiplier = Math.pow(4, Math.floor((strength - baseStr) / 10));
        maxLoad = MAX_LOAD_TABLE[baseStr] * multiplier;
    }

    // Size multipliers for carrying capacity
    // Fine: 1/8, Diminutive: 1/4, Tiny: 1/2, Small: 3/4, Medium: 1, Large: 2, Huge: 4, Gargantuan: 8, Colossal: 16
    const sizeMultipliers = {
        "Fine": 0.125,
        "Diminutive": 0.25,
        "Tiny": 0.5,
        "Small": 0.75,
        "Medium": 1,
        "Large": 2,
        "Huge": 4,
        "Gargantuan": 8,
        "Colossal": 16
    };
    const sizeMod = sizeMultipliers[size] ?? 1;
    const baseMaxLoad = maxLoad; // Max load for a Medium creature of this Strength
    maxLoad *= sizeMod;

    return {
        light: Math.floor(maxLoad / 3),
        medium: Math.floor((maxLoad * 2) / 3),
        heavy: Math.floor(maxLoad),
        metadata: {
            baseMaxLoad: baseMaxLoad,
            sizeMod: sizeMod
        }
    };
}

/**
 * Determine the load status based on current weight and thresholds.
 * @param {number} weight      Current total weight.
 * @param {Object} thresholds  The {light, medium, heavy} thresholds.
 * @returns {string}           "light", "medium", "heavy", or "overload".
 */
export function getLoadStatus(weight, thresholds) {
    if (weight <= thresholds.light) return "light";
    if (weight <= thresholds.medium) return "medium";
    if (weight <= thresholds.heavy) return "heavy";
    return "overload";
}

/**
 * Get the mechanical penalties for a given load status.
 * @param {string} load  The load status ("light", "medium", "heavy", "overload").
 * @returns {{maxDex: number|null, acp: number, speed30: number, speed20: number}}
 */
export function getLoadEffects(load) {
    const effects = {
        light: { maxDex: null, acp: 0, speed30: 30, speed20: 20 },
        medium: { maxDex: 3, acp: -3, speed30: 20, speed20: 15 },
        heavy: { maxDex: 1, acp: -6, speed30: 20, speed20: 15 },
        overload: { maxDex: 0, acp: -10, speed30: 0, speed20: 0 }
    };
    const result = effects[load] || effects.light;
    return { ...result, load: load || "light" };
}
