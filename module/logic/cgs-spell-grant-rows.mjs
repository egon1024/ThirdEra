/**
 * Resolve merged CGS spell-grant rows for an actor: prefer `prepareDerivedData` output on `actor.system.cgs`,
 * fall back to recomputing via `getActiveCapabilityGrants` when the embedded array is missing or empty.
 */

import { getActiveCapabilityGrants } from "./capability-aggregation.mjs";

/**
 * @param {unknown} actor
 * @returns {unknown[]}
 */
export function getMergedSpellGrantRowsForActor(actor) {
    const fromSystem = /** @type {{ system?: { cgs?: { spellGrants?: { rows?: unknown } } } }} */ (actor)?.system?.cgs?.spellGrants?.rows;
    if (Array.isArray(fromSystem) && fromSystem.length > 0) {
        return fromSystem;
    }
    try {
        const active = getActiveCapabilityGrants(actor);
        const rows = active?.spellGrants?.rows;
        if (Array.isArray(rows) && rows.length > 0) {
            return rows;
        }
    } catch {
        /* ignore */
    }
    return Array.isArray(fromSystem) ? fromSystem : [];
}
