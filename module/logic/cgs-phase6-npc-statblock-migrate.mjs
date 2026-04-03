/**
 * Phase 6 — Move legacy `system.statBlock.senses` into `system.cgsGrants.senses` (single CGS authoring surface).
 * Idempotent: clears stat block senses only after merging; re-running is a no-op.
 *
 * @see plans/cgs-phased-implementation.md (compendium migration + world upgrade path)
 */

/**
 * @param {string} type
 * @param {string} range
 * @returns {string}
 */
export function npcStatBlockSenseDedupeKey(type, range) {
    return `${String(type).trim().toLowerCase()}|||${String(range).trim().toLowerCase()}`;
}

/**
 * @param {unknown} row
 * @returns {{ type: string, range: string } | null}
 */
export function normalizeStatBlockSenseRow(row) {
    if (!row || typeof row !== "object") return null;
    const type = typeof row.type === "string" ? row.type.trim() : "";
    const range = typeof row.range === "string" ? row.range.trim() : "";
    if (!type) return null;
    return { type, range };
}

/**
 * True when the NPC system still has legacy stat-block sense rows worth merging into CGS.
 *
 * @param {unknown} system
 * @returns {boolean}
 */
export function npcSystemHasLegacyStatBlockSenses(system) {
    const sb = system?.statBlock;
    if (!sb || typeof sb !== "object") return false;
    const senses = sb.senses;
    if (!Array.isArray(senses) || senses.length === 0) return false;
    for (const row of senses) {
        if (normalizeStatBlockSenseRow(row)) return true;
    }
    return false;
}

/**
 * Merge `statBlock.senses` into `cgsGrants.senses` (deduped by type+range), then clear `statBlock.senses`.
 * Mutates `source` (expected: actor `system` subtree).
 *
 * @param {Record<string, unknown>} source
 * @returns {boolean} true if any change was made
 */
export function migrateNpcStatBlockSensesIntoCgsGrants(source) {
    if (!source || typeof source !== "object") return false;
    const sb = source.statBlock;
    if (!sb || typeof sb !== "object") return false;
    const legacy = sb.senses;
    if (!Array.isArray(legacy) || legacy.length === 0) return false;

    if (!source.cgsGrants || typeof source.cgsGrants !== "object") {
        source.cgsGrants = { senses: [], creatureTypeOverlayUuids: [], subtypeOverlayUuids: [] };
    }
    const cg = source.cgsGrants;
    if (!Array.isArray(cg.senses)) cg.senses = [];
    if (!Array.isArray(cg.creatureTypeOverlayUuids)) cg.creatureTypeOverlayUuids = [];
    if (!Array.isArray(cg.subtypeOverlayUuids)) cg.subtypeOverlayUuids = [];

    const existing = new Set(cg.senses.map((s) => npcStatBlockSenseDedupeKey(s?.type, s?.range)));

    let appended = false;
    for (const row of legacy) {
        const norm = normalizeStatBlockSenseRow(row);
        if (!norm) continue;
        const key = npcStatBlockSenseDedupeKey(norm.type, norm.range);
        if (existing.has(key)) continue;
        cg.senses.push({ type: norm.type, range: norm.range });
        existing.add(key);
        appended = true;
    }

    const hadLegacyRows = legacy.some((row) => normalizeStatBlockSenseRow(row) !== null);
    if (hadLegacyRows) {
        sb.senses = [];
        return true;
    }
    return appended;
}

/**
 * @param {unknown} system
 * @returns {Record<string, unknown>}
 */
function cloneNpcSystemForMigration(system) {
    try {
        if (typeof structuredClone === "function") return structuredClone(system);
    } catch {
        /* fall through */
    }
    return JSON.parse(JSON.stringify(system));
}

/**
 * Build a flat update payload for `Actor#update` when legacy stat-block senses need persisting into CGS.
 *
 * @param {unknown} system - actor.system (plain object or TypeDataModel-shaped data)
 * @returns {Record<string, unknown> | null}
 */
export function buildNpcPhase6StatBlockSenseMigrationUpdate(system) {
    if (!npcSystemHasLegacyStatBlockSenses(system)) return null;
    const dupe = cloneNpcSystemForMigration(system);
    migrateNpcStatBlockSensesIntoCgsGrants(dupe);
    return {
        "system.cgsGrants.senses": dupe.cgsGrants?.senses ?? [],
        "system.statBlock.senses": dupe.statBlock?.senses ?? []
    };
}
