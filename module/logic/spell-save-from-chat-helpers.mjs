/**
 * Pure helpers for spell cast chat messages → save-roll payload (no Foundry UI).
 * Entry points stay in `spell-save-from-chat.mjs`.
 */

/**
 * @typedef {{ dc: number, saveType: string, spellName: string, targetActorUuids: string[] }} SpellCastSavePayload
 */

/**
 * Read spell-cast save data from a message’s `flags.thirdera.spellCast` when DC and save type are present.
 * Accepts any object with that shape (e.g. ChatMessage or a plain stub in tests).
 *
 * @param {object|null|undefined} message
 * @returns {SpellCastSavePayload|null}
 */
export function getSpellCastDataFromMessage(message) {
    const spellCast = message?.flags?.thirdera?.spellCast;
    if (!spellCast || spellCast.saveType == null) return null;
    const dc = spellCast.dc;
    if (typeof dc !== "number" || !Number.isFinite(dc)) return null;
    return {
        dc: spellCast.dc,
        saveType: spellCast.saveType,
        spellName: spellCast.spellName ?? "",
        targetActorUuids: Array.isArray(spellCast.targetActorUuids) ? spellCast.targetActorUuids : []
    };
}
