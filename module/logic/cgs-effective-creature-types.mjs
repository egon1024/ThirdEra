/**
 * Effective creature types resolver — Phase 5f-follow.
 *
 * Implements the §5.1 v1 union semantics from cgs-implementation.md:
 *   effective type UUIDs   = primary type UUID (details) ∪ creatureTypeOverlay rows (cgs)
 *   effective subtype UUIDs = primary subtype UUIDs (details) ∪ subtypeOverlay rows (cgs)
 *
 * Primary comes from NPC `system.details.creatureTypeUuid` / `system.details.subtypeUuids`.
 * Characters may have no primary type — resolver returns overlay-only sets.
 *
 * Mechanical consumers (turning, favored enemy, type gates, etc.) MUST use
 * `getEffectiveCreatureTypes` rather than re-implementing the union themselves.
 */

/**
 * @param {string[]} primary
 * @param {string[]} overlays
 * @returns {string[]}
 */
function dedupedUnion(primary, overlays) {
    const seen = new Set(primary);
    const result = [...primary];
    for (const uuid of overlays) {
        if (!seen.has(uuid)) {
            seen.add(uuid);
            result.push(uuid);
        }
    }
    return result;
}

/**
 * Returns the deduplicated, non-empty effective creature type and subtype UUIDs
 * for the given actor system data, applying §5.1 union semantics.
 *
 * Primary UUIDs always appear first (in original array order); overlay UUIDs
 * follow in their merged row order. Duplicates are eliminated keeping the first
 * occurrence. Empty strings are trimmed and discarded. Missing or undefined
 * fields are treated as empty — the function never throws.
 *
 * @param {{
 *   details?: {
 *     creatureTypeUuid?: string,
 *     subtypeUuids?: string[]
 *   },
 *   cgs?: {
 *     creatureTypeOverlays?: { rows?: Array<{ typeUuid?: string }> },
 *     subtypeOverlays?: { rows?: Array<{ subtypeUuid?: string }> }
 *   }
 * }} systemData - Post-prepareDerivedData actor system object (or compatible plain data).
 * @returns {{ typeUuids: string[], subtypeUuids: string[] }}
 */
export function getEffectiveCreatureTypes(systemData) {
    const details = systemData?.details ?? {};
    const cgs = systemData?.cgs ?? {};

    const primaryTypeRaw = typeof details.creatureTypeUuid === "string" ? details.creatureTypeUuid.trim() : "";
    const primaryTypeUuids = primaryTypeRaw ? [primaryTypeRaw] : [];

    const primarySubtypeUuids = Array.isArray(details.subtypeUuids)
        ? details.subtypeUuids
              .map((s) => (typeof s === "string" ? s.trim() : ""))
              .filter(Boolean)
        : [];

    const overlayTypeRows = Array.isArray(cgs.creatureTypeOverlays?.rows) ? cgs.creatureTypeOverlays.rows : [];
    const overlayTypeUuids = overlayTypeRows
        .map((row) => (typeof row?.typeUuid === "string" ? row.typeUuid.trim() : ""))
        .filter(Boolean);

    const overlaySubtypeRows = Array.isArray(cgs.subtypeOverlays?.rows) ? cgs.subtypeOverlays.rows : [];
    const overlaySubtypeUuids = overlaySubtypeRows
        .map((row) => (typeof row?.subtypeUuid === "string" ? row.subtypeUuid.trim() : ""))
        .filter(Boolean);

    return {
        typeUuids: dedupedUnion(primaryTypeUuids, overlayTypeUuids),
        subtypeUuids: dedupedUnion(primarySubtypeUuids, overlaySubtypeUuids),
    };
}

/**
 * Thin actor-document wrapper. Delegates to `getEffectiveCreatureTypes(actor.system)`.
 *
 * @param {{ system: object }} actor
 * @returns {{ typeUuids: string[], subtypeUuids: string[] }}
 */
export function getEffectiveCreatureTypesFromActor(actor) {
    return getEffectiveCreatureTypes(actor?.system);
}

/**
 * Whether the given creature type or subtype UUID appears in the effective sets (v1 union).
 * Use for mechanical checks (targeting, gates, etc.) instead of comparing only `details`.
 *
 * @param {Parameters<typeof getEffectiveCreatureTypes>[0]} systemData
 * @param {string} uuid
 * @returns {boolean}
 */
export function effectiveCreatureTypesIncludeUuid(systemData, uuid) {
    const id = typeof uuid === "string" ? uuid.trim() : "";
    if (!id) return false;
    const { typeUuids, subtypeUuids } = getEffectiveCreatureTypes(systemData);
    return typeUuids.includes(id) || subtypeUuids.includes(id);
}

/**
 * True if any UUID in `candidates` is in the effective type or subtype set.
 *
 * @param {Parameters<typeof getEffectiveCreatureTypes>[0]} systemData
 * @param {Iterable<string>} candidates
 * @returns {boolean}
 */
export function effectiveCreatureTypesIncludeAnyUuid(systemData, candidates) {
    if (candidates == null) return false;
    for (const raw of candidates) {
        if (effectiveCreatureTypesIncludeUuid(systemData, raw)) return true;
    }
    return false;
}
