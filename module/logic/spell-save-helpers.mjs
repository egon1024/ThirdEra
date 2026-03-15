/**
 * Helpers for spell saving-throw parsing and spell-cast message payload.
 * Maps spell savingThrow freeform string to system save key (fort | ref | will) or null.
 */

/**
 * Parse a spell's savingThrow string to the system save key.
 * @param {string} [savingThrow] - Spell system.savingThrow (e.g. "Will negates", "Reflex half", "None", "See text")
 * @returns {"fort"|"ref"|"will"|null} System save key or null when no save / unparseable
 */
export function parseSaveType(savingThrow) {
    const s = (savingThrow ?? "").trim().toLowerCase();
    if (!s || /\b(see\s+text|none)\b/.test(s)) return null;
    if (/fortitude|\bfort\b/.test(s)) return "fort";
    if (/reflex|\bref\b/.test(s)) return "ref";
    if (/\bwill\b/.test(s)) return "will";
    return null;
}
