/**
 * Resolve item/compendium image paths that reference icons not shipped in Foundry core.
 */

/** @type {ReadonlyMap<string, string>} basename → replacement path (relative to Foundry root) */
export const ITEM_IMAGE_REPLACEMENTS = new Map([
    ["footprint.svg", "icons/svg/pawprint.svg"],
    ["wolf.svg", "icons/svg/shield.svg"],
    ["star.svg", "icons/svg/shield.svg"],
    ["dodge.svg", "icons/svg/shield.svg"],
    ["raven.svg", "icons/svg/shield.svg"],
    ["run.svg", "icons/svg/shield.svg"],
    ["camera.svg", "icons/svg/shield.svg"],
    ["wave.svg", "icons/svg/shield.svg"],
    ["blob.svg", "icons/svg/shield.svg"],
    ["light-bulb.svg", "icons/svg/shield.svg"],
    ["skeleton.svg", "icons/svg/shield.svg"],
    ["smoke.svg", "icons/svg/shield.svg"],
    ["item-journal.svg", "icons/svg/shield.svg"]
]);

/**
 * @param {string} img
 * @returns {string}
 */
export function iconFilenameFromPath(img) {
    return (String(img ?? "").split("/").pop() ?? "").split("?")[0];
}

/**
 * @param {string} img
 * @returns {string}
 */
export function resolveItemImagePath(img) {
    const raw = String(img ?? "").trim();
    if (!raw) return raw;
    const replacement = ITEM_IMAGE_REPLACEMENTS.get(iconFilenameFromPath(raw));
    return replacement ?? raw;
}
