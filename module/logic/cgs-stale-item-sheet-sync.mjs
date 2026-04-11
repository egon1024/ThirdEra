/**
 * When a sheet-driven `Item#update` targets `game.packs.get(pack).get(id)` (live pack instance), the open sheet may
 * still reference a different `Item` object with the same id. Merging into `sheetDoc._source` in place and calling
 * `prepareData()` does not re-run TypeDataField initialization for `system`, so prepared `item.system` can stay stale
 * while `_source.system` is correct. Use `sheetDoc.updateSource({ system: clone(returned._source.system) })` then
 * `prepareData()` so nested TypeDataModels match the authoritative instance.
 */

/**
 * @param {{ id?: string }|null|undefined} sheetDoc
 * @param {{ id?: string }|null|undefined} returnedFromUpdate
 */
export function staleSheetItemDocNeedsSystemResync(sheetDoc, returnedFromUpdate) {
    if (!sheetDoc || !returnedFromUpdate) return false;
    if (returnedFromUpdate === sheetDoc) return false;
    const a = sheetDoc.id;
    const b = returnedFromUpdate.id;
    if (a === undefined || a === null || b === undefined || b === null) return false;
    return a === b;
}

/**
 * @param {unknown} obj
 * @returns {object}
 */
function defaultDeepClone(obj) {
    if (!obj || typeof obj !== "object") return {};
    if (typeof structuredClone === "function") {
        try {
            return structuredClone(obj);
        } catch {
            // circular or non-cloneable — caller should pass `deps.clone` (e.g. foundry.utils.deepClone)
        }
    }
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Payload for `Item#updateSource` after updating another same-id Item instance (e.g. pack cache).
 * @param {{ _source?: { system?: object } }} returnedFromUpdate
 * @param {{ clone?: (x: object) => object }} [deps]
 * @returns {{ system: object }}
 */
export function buildSystemUpdateSourceChangesFromReturnedItem(returnedFromUpdate, deps = {}) {
    const clone = deps.clone ?? defaultDeepClone;
    const system = returnedFromUpdate?._source?.system;
    if (!system || typeof system !== "object") {
        return { system: {} };
    }
    return { system: clone(system) };
}
