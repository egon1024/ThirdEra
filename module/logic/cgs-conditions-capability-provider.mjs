/**
 * CGS capability contributions from active conditions (Phase 5a).
 * Mirrors conditionsModifierProvider effect → condition item resolution; reads `system.cgsGrants.grants`.
 *
 * @see module/logic/modifier-aggregation.mjs (conditionsModifierProvider)
 * @see .cursor/plans/cgs-implementation.md §6
 */

import { getActorEffectsList, getConditionItemsMapSync, getEffectStatusIds } from "./condition-helpers.mjs";

/**
 * @param {unknown} actor
 * @returns {Array<{ label: string, grants: unknown[], sourceRef?: Record<string, unknown> }>}
 */
export function cgsConditionsCapabilityProvider(actor) {
    const conditionMap = getConditionItemsMapSync();
    /** @type {Array<{ label: string, grants: unknown[], sourceRef?: Record<string, unknown> }>} */
    const out = [];
    const conditionIdsAdded = new Set();
    const effects = getActorEffectsList(actor);

    for (const effect of effects) {
        const statusIds = getEffectStatusIds(effect);
        if (statusIds.length === 0) continue;
        for (const statusId of statusIds) {
            const conditionId = String(statusId).toLowerCase().trim();
            if (conditionIdsAdded.has(conditionId)) continue;
            const conditionItem = conditionMap.get(conditionId);
            if (!conditionItem) continue;
            const grants = conditionItem.system?.cgsGrants?.grants;
            if (!Array.isArray(grants) || grants.length === 0) continue;
            conditionIdsAdded.add(conditionId);
            const label = conditionItem.name || conditionId;
            const uuid = typeof conditionItem.uuid === "string" ? conditionItem.uuid : undefined;
            out.push({
                label,
                sourceRef: {
                    kind: "conditionItem",
                    ...(uuid ? { uuid } : {}),
                    conditionId
                },
                grants
            });
        }
    }
    return out;
}
