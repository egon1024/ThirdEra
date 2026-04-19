/**
 * Classify owned {@link Item} feats for actor sheet display: linked to the bundled Feats compendium vs embedded/stat block.
 * @module module/logic/feat-embed-display
 */

/** Foundry compendium UUID path segment for the ThirdEra feats pack (`system.json` name `thirdera_feats`). */
export const FEATS_COMPENDIUM_COLLECTION_SEGMENT = ".thirdera_feats.";

/**
 * @param {unknown} item - Actor-owned Item (or plain data with `type`, `sourceId`)
 * @returns {boolean} True when `sourceId` points at the bundled feats compendium document.
 */
export function isFeatLinkedToBundledFeatsCompendium(item) {
    if (!item || item.type !== "feat") return false;
    const sid = typeof item.sourceId === "string" ? item.sourceId.trim() : "";
    if (!sid.startsWith("Compendium.")) return false;
    return sid.includes(FEATS_COMPENDIUM_COLLECTION_SEGMENT);
}
