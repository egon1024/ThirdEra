/**
 * Map Third Era / 3.5 creature size to Foundry token width and height (grid squares).
 * Uses a 5 ft grid: space in feet / 5. Fine–Tiny use fractional squares per user preference.
 */

/** @type {Readonly<Record<string, { width: number; height: number }>>} */
export const TOKEN_DIMENSIONS_BY_SIZE = Object.freeze({
    Fine: { width: 0.1, height: 0.1 },
    Diminutive: { width: 0.2, height: 0.2 },
    Tiny: { width: 0.5, height: 0.5 },
    Small: { width: 1, height: 1 },
    Medium: { width: 1, height: 1 },
    Large: { width: 2, height: 2 },
    Huge: { width: 3, height: 3 },
    Gargantuan: { width: 4, height: 4 },
    Colossal: { width: 6, height: 6 }
});

/** Foundry default prototype / token footprint when unspecified. */
export const FOUNDRY_DEFAULT_TOKEN_DIMENSION = 1;

/** Tolerance for comparing fractional grid sizes. */
export const TOKEN_DIMENSION_EPSILON = 1e-5;

/**
 * @param {number} a
 * @param {number} b
 * @returns {boolean}
 */
export function nearlyEqualTokenDimension(a, b) {
    return Math.abs(a - b) <= TOKEN_DIMENSION_EPSILON;
}

/**
 * @param {string|undefined|null} size
 * @returns {{ width: number; height: number }}
 */
export function getTokenDimensionsForSize(size) {
    if (size && TOKEN_DIMENSIONS_BY_SIZE[size]) {
        return TOKEN_DIMENSIONS_BY_SIZE[size];
    }
    return TOKEN_DIMENSIONS_BY_SIZE.Medium;
}

/**
 * True if width/height match the canonical footprint for this size (within epsilon).
 *
 * @param {number} width
 * @param {number} height
 * @param {string|undefined|null} size
 * @returns {boolean}
 */
export function prototypeDimensionsMatchAutoForSize(width, height, size) {
    const { width: ew, height: eh } = getTokenDimensionsForSize(size);
    return nearlyEqualTokenDimension(width, ew) && nearlyEqualTokenDimension(height, eh);
}

/**
 * On actor creation: set footprint from size when the prototype is still Foundry's generic 1×1.
 *
 * @param {object} params
 * @param {string|undefined|null} params.size           system.details.size
 * @param {number} params.prototypeWidth
 * @param {number} params.prototypeHeight
 * @returns {boolean}
 */
export function shouldApplyAutoTokenDimensionsOnCreate({ size, prototypeWidth, prototypeHeight }) {
    const w = Number(prototypeWidth);
    const h = Number(prototypeHeight);
    if (!Number.isFinite(w) || !Number.isFinite(h)) return false;
    if (!nearlyEqualTokenDimension(w, FOUNDRY_DEFAULT_TOKEN_DIMENSION)) return false;
    if (!nearlyEqualTokenDimension(h, FOUNDRY_DEFAULT_TOKEN_DIMENSION)) return false;
    const { width: tw, height: th } = getTokenDimensionsForSize(size);
    return !(nearlyEqualTokenDimension(w, tw) && nearlyEqualTokenDimension(h, th));
}

/**
 * On actor size change: update prototype only if footprint still matches the old size's auto dimensions.
 *
 * @param {object} params
 * @param {string|undefined|null} params.oldSize
 * @param {string|undefined|null} params.newSize
 * @param {number} params.prototypeWidth
 * @param {number} params.prototypeHeight
 * @returns {boolean}
 */
export function shouldApplyAutoTokenDimensionsOnSizeChange({
    oldSize,
    newSize,
    prototypeWidth,
    prototypeHeight
}) {
    if (oldSize === newSize) return false;
    const w = Number(prototypeWidth);
    const h = Number(prototypeHeight);
    if (!Number.isFinite(w) || !Number.isFinite(h)) return false;
    if (!prototypeDimensionsMatchAutoForSize(w, h, oldSize)) return false;
    const { width: nw, height: nh } = getTokenDimensionsForSize(newSize);
    const { width: ow, height: oh } = getTokenDimensionsForSize(oldSize);
    return !(nearlyEqualTokenDimension(nw, ow) && nearlyEqualTokenDimension(nh, oh));
}

/**
 * @param {object} changes           Actor update diff (nested or flattened)
 * @returns {string|undefined}     New size if present in the diff
 */
export function getSizeChangeFromActorUpdateDiff(changes) {
    if (!changes || typeof changes !== "object") return undefined;
    const nested = changes.system?.details?.size;
    if (typeof nested === "string") return nested;
    const flat = changes["system.details.size"];
    if (typeof flat === "string") return flat;
    return undefined;
}
