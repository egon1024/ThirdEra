/**
 * Shared spell search/filter logic for spell lists (Spell List Browser, character sheet Known tab).
 * Uses fuzzy substring match and Levenshtein distance on words for typo tolerance.
 */

/** CSS class toggled on hidden elements when filtering. */
export const SPELL_SEARCH_HIDDEN_CLASS = "spell-search-hidden";

/**
 * Normalize and return a query string for matching (trimmed, lowercased, collapsed whitespace).
 * @param {string} raw
 * @returns {string}
 */
export function normalizeQuery(raw) {
    return (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ") || "";
}

/**
 * Returns true if spell name matches the search query (empty query = match all).
 * Uses fuzzy substring (letters in order) and Levenshtein on words for typo tolerance.
 * @param {string} name - Spell name (or other text to match)
 * @param {string} query - Normalized query (use normalizeQuery if needed)
 * @returns {boolean}
 */
export function spellMatches(name, query) {
    if (!query) return true;
    if (fuzzyMatch(name, query)) return true;
    const maxEdits = query.length <= 4 ? 1 : query.length <= 7 ? 2 : 3;
    const words = (name || "").toLowerCase().split(/\s+/).filter(Boolean);
    for (const word of words) {
        if (Math.abs(word.length - query.length) > maxEdits) continue;
        if (levenshtein(query, word) <= maxEdits) return true;
    }
    return false;
}

function fuzzyMatch(text, query) {
    if (!text || !query) return true;
    const s = text.toLowerCase();
    let idx = 0;
    for (const c of query) {
        const pos = s.indexOf(c, idx);
        if (pos < 0) return false;
        idx = pos + 1;
    }
    return true;
}

function levenshtein(a, b) {
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            matrix[i][j] =
                b[i - 1] === a[j - 1]
                    ? matrix[i - 1][j - 1]
                    : 1 + Math.min(matrix[i - 1][j - 1], matrix[i][j - 1], matrix[i - 1][j]);
        }
    }
    return matrix[b.length][a.length];
}
