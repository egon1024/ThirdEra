/**
 * Two monster JSON files can incorrectly share the same `system.key` / compendium stable key, producing
 * two `toUpdate` rows for the **same** compendium actor `_id`. Embedded-item replace then runs twice;
 * the later row with **`items: []`** deletes recreated embeds and skips create — empty inventory.
 * Collapse to one row per `_id`, keeping the payload with the **strictly larger** `items.length` (first wins on ties).
 *
 * @param {Array<Record<string, unknown>>} rows
 * @returns {Array<Record<string, unknown>>}
 */
export function dedupeMonsterPackActorUpdateRowsPreferMoreEmbeddedItems(rows) {
    if (!Array.isArray(rows)) return [];
    /** @type {Map<string, Record<string, unknown>>} */
    const bestById = new Map();
    for (const row of rows) {
        if (row == null || typeof row !== "object") continue;
        const id = typeof row._id === "string" ? row._id : "";
        if (!id) continue;
        const n = Array.isArray(row.items) ? row.items.length : 0;
        const prev = bestById.get(id);
        const prevN = prev && Array.isArray(prev.items) ? prev.items.length : -1;
        if (!prev || n > prevN) {
            bestById.set(id, row);
        }
    }
    const out = [];
    const emitted = new Set();
    for (const row of rows) {
        if (row == null || typeof row !== "object") {
            out.push(row);
            continue;
        }
        const id = typeof row._id === "string" ? row._id : "";
        if (!id) {
            out.push(row);
            continue;
        }
        if (emitted.has(id)) continue;
        const best = bestById.get(id);
        if (best) out.push(best);
        emitted.add(id);
    }
    return out;
}

/**
 * Compendium NPC updates from bundled JSON: bulk {@link Actor#updateDocuments} merges embedded
 * `items` by `_id`. Pack templates omit valid 16-char ids, so each refresh can **append** duplicates.
 * Strip `items` from the batch payload and replace embedded Items separately (see compendium-loader).
 *
 * @param {Array<Record<string, unknown>>} rows - Actor update payloads `{ _id, ... }` possibly including `items`
 * @returns {Array<Record<string, unknown>>}
 */
export function stripEmbeddedItemsFromActorUpdateRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
        if (row == null || typeof row !== "object") return row;
        const { items: _omit, ...rest } = row;
        return rest;
    });
}
