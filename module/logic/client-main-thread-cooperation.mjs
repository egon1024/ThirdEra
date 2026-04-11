/**
 * Yield the main thread so the browser can paint and handle input between heavy ready-path work.
 * Uses requestAnimationFrame in the client when available; falls back to setTimeout for Node/tests.
 * @returns {Promise<void>}
 */
export function yieldToMain() {
    if (typeof requestAnimationFrame === "function") {
        return new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Run async work on {@code items} with at most {@code limit} in-flight tasks (useful for bounded DB update fan-out).
 * Preserves result order; empty {@code items} resolves to [].
 * @template T, R
 * @param {T[]} items
 * @param {number} limit  — max concurrency (clamped to ≥ 1)
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
export async function runWithConcurrencyLimit(items, limit, fn) {
    if (!items?.length) return [];
    const n = Math.max(1, Math.min(limit | 0, items.length));
    const results = new Array(items.length);
    let next = 0;

    async function worker() {
        while (next < items.length) {
            const idx = next++;
            results[idx] = await fn(items[idx], idx);
        }
    }

    await Promise.all(Array.from({ length: n }, () => worker()));
    return results;
}
