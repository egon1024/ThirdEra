/**
 * Simple fuzzy matching helpers (e.g. for skill picker search).
 * @module utils/fuzzy
 */

/** Max normalized Levenshtein distance to count as a match (lower = stricter). */
const FUZZY_MAX_NORMALIZED_LEVENSHTEIN = 0.44;

/**
 * Levenshtein distance between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshtein(a, b) {
    const sa = String(a ?? "").toLowerCase();
    const sb = String(b ?? "").toLowerCase();
    if (sa.length === 0) return sb.length;
    if (sb.length === 0) return sa.length;
    const m = sa.length;
    const n = sb.length;
    const d = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) d[i][0] = i;
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = sa[i - 1] === sb[j - 1] ? 0 : 1;
            d[i][j] = Math.min(
                d[i - 1][j] + 1,
                d[i][j - 1] + 1,
                d[i - 1][j - 1] + cost
            );
        }
    }
    return d[m][n];
}

/**
 * True if query chars appear in order in text (subsequence match).
 * @param {string} query
 * @param {string} text
 * @returns {boolean}
 */
function isSubsequence(query, text) {
    let j = 0;
    const t = String(text ?? "").toLowerCase();
    const q = String(query ?? "").toLowerCase();
    for (let i = 0; i < t.length && j < q.length; i++) {
        if (t[i] === q[j]) j++;
    }
    return j === q.length;
}

/**
 * Score for fuzzy match: lower is better. Substring match wins (score 0); then subsequence; else Levenshtein.
 * Uses Levenshtein when no substring/subsequence; matched only if normalized distance is at most
 * `FUZZY_MAX_NORMALIZED_LEVENSHTEIN` (substring/subsequence still catch ordered-letter typos).
 * @param {string} query
 * @param {string} name
 * @param {string} [key] - optional key (e.g. skill key) to also match
 * @returns {{ score: number, matched: boolean }}
 */
export function fuzzyScore(query, name, key = "") {
    const q = String(query ?? "").trim().toLowerCase();
    const n = String(name ?? "").toLowerCase();
    const k = String(key ?? "").toLowerCase();
    if (q.length === 0) return { score: 0, matched: true };
    if (n.includes(q) || k.includes(q)) return { score: 0, matched: true };
    if (isSubsequence(q, n) || (k && isSubsequence(q, k))) return { score: 0.1, matched: true };
    const distName = levenshtein(q, n);
    const distKey = k ? levenshtein(q, k) : Infinity;
    const score = Math.min(distName, distKey);
    const maxLen = Math.max(n.length, k.length, 1);
    const normalized = score / maxLen;
    return { score: normalized, matched: normalized <= FUZZY_MAX_NORMALIZED_LEVENSHTEIN };
}
