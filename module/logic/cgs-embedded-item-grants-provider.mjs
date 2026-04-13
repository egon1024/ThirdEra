/**
 * CGS contributions from embedded race, feat, creatureFeature, class feature, and equipped armor/equipment/weapon (Phase 5b–5c).
 * Apply rules mirror {@link itemsModifierProvider} in modifier-aggregation.mjs (Phase 5g: `system.mechanicalApplyScope`).
 * Optional **creature gates** (`system.mechanicalCreatureGateUuids`) use a fixed-point resolver — see `getAcceptedMechanicalGearIdsForActor`.
 *
 * Items expose optional `system.cgsGrants.grants` (same discriminated shape as conditions).
 * Races also resolve `system.cgsGrants.senses` and stock `race-*` compendium defaults when grants are empty.
 *
 * @see .cursor/plans/cgs-phased-implementation.md (Phase 5b)
 */

import { getActiveCapabilityGrants } from "./capability-aggregation.mjs";
import { effectiveCreatureTypesIncludeAnyUuid } from "./cgs-effective-creature-types.mjs";
import { getEffectiveOwnedItemCgsGrants } from "./cgs-owned-item-grants.mjs";
import { getEffectiveRaceCgsGrants } from "./cgs-stock-race-grants.mjs";
import {
    embeddedGearMechanicalEffectsApply,
    embeddedGearItemStableKey,
    normalizeMechanicalCreatureGateUuids
} from "./item-gear-mechanical-apply.mjs";

/**
 * @param {unknown} item
 * @param {string} defaultLabel
 * @param {unknown[]} grants
 * @returns {{ label: string, grants: unknown[], sourceRef: Record<string, unknown> } | null}
 */
function cgsContributionFromGrants(item, defaultLabel, grants) {
    if (!item || typeof item !== "object") return null;
    if (!Array.isArray(grants) || grants.length === 0) return null;
    const uuid = typeof item.uuid === "string" ? item.uuid.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const label = name || defaultLabel;
    return {
        label,
        grants,
        sourceRef: {
            kind: "item",
            ...(uuid ? { uuid } : {})
        }
    };
}

/**
 * @param {unknown} item
 * @param {string} defaultLabel
 * @returns {{ label: string, grants: unknown[], sourceRef: Record<string, unknown> } | null}
 */
export function cgsContributionFromOwnedItem(item, defaultLabel) {
    const grants = getEffectiveOwnedItemCgsGrants(item);
    return cgsContributionFromGrants(item, defaultLabel, grants);
}

/**
 * Race item: explicit grants, then senses rows, then stock defaults for `race-*` compendium ids.
 * @param {unknown} item
 * @returns {{ label: string, grants: unknown[], sourceRef: Record<string, unknown> } | null}
 */
export function cgsContributionFromRaceItem(item) {
    const grants = getEffectiveRaceCgsGrants(item);
    return cgsContributionFromGrants(item, "Race", grants);
}

/**
 * Core collector for embedded item CGS (race, feat, creatureFeature, class feature, gear).
 * When `acceptedGearIds` is `null`, all armor/equipment/weapon that
 * pass `embeddedGearMechanicalEffectsApply` contribute. When it is a Set, only listed gear ids do.
 *
 * @param {unknown} actor
 * @param {Set<string> | null} acceptedGearIds
 * @returns {Array<{ label: string, grants: unknown[], sourceRef: Record<string, unknown> }>}
 */
export function collectEmbeddedItemGrantsForCgs(actor, acceptedGearIds) {
    const items = actor?.items;
    if (!items) return [];
    const list =
        Array.isArray(items) ? items : typeof items[Symbol.iterator] === "function" ? Array.from(items) : [];
    /** @type {Array<{ label: string, grants: unknown[], sourceRef: Record<string, unknown> }>} */
    const out = [];
    for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const type = item.type;
        if (type === "race") {
            const c = cgsContributionFromRaceItem(item);
            if (c) out.push(c);
            continue;
        }
        if (type === "feat") {
            const c = cgsContributionFromOwnedItem(item, "Feat");
            if (c) out.push(c);
            continue;
        }
        if (type === "feature") {
            const c = cgsContributionFromOwnedItem(item, "Class feature");
            if (c) out.push(c);
            continue;
        }
        if (type === "creatureFeature") {
            const c = cgsContributionFromOwnedItem(item, "Creature feature");
            if (c) out.push(c);
            continue;
        }
        if (type === "armor" || type === "equipment") {
            if (!embeddedGearMechanicalEffectsApply(item)) continue;
            if (acceptedGearIds !== null && !acceptedGearIds.has(embeddedGearItemStableKey(item))) continue;
            const c = cgsContributionFromOwnedItem(item, type === "armor" ? "Armor" : "Equipment");
            if (c) out.push(c);
            continue;
        }
        if (type === "weapon") {
            if (!embeddedGearMechanicalEffectsApply(item)) continue;
            if (acceptedGearIds !== null && !acceptedGearIds.has(embeddedGearItemStableKey(item))) continue;
            const c = cgsContributionFromOwnedItem(item, "Weapon");
            if (c) out.push(c);
        }
    }
    return out;
}

/**
 * @returns {{ senseTypeLabels: Record<string, string>, allVisionSenseTypeKeys?: string[] }}
 */
function defaultCgsDepsForGearGateResolution() {
    const cfg = typeof globalThis.CONFIG !== "undefined" ? globalThis.CONFIG?.THIRDERA : undefined;
    const senseTypeLabels =
        cfg?.senseTypes && typeof cfg.senseTypes === "object" ? /** @type {Record<string, string>} */ (cfg.senseTypes) : {};
    const allVisionSenseTypeKeys = Object.keys(senseTypeLabels)
        .map((k) => String(k).trim())
        .filter(Boolean);
    return {
        senseTypeLabels,
        allVisionSenseTypeKeys: allVisionSenseTypeKeys.length > 0 ? allVisionSenseTypeKeys : undefined
    };
}

/**
 * When any mechanical gear uses a creature gate, returns the set of gear item ids that contribute GMS/CGS;
 * otherwise `null` (no gating).
 *
 * @param {unknown} actor
 * @param {Parameters<typeof getActiveCapabilityGrants>[1]} [mergeDeps]
 * @returns {Set<string> | null}
 */
export function getAcceptedMechanicalGearIdsForActor(actor, mergeDeps) {
    const gear = [];
    const items = actor?.items ?? [];
    const itemList = Array.isArray(items) ? items : typeof items[Symbol.iterator] === "function" ? Array.from(items) : [];
    for (const item of itemList) {
        if (!item || typeof item !== "object") continue;
        const t = item.type;
        if (t !== "armor" && t !== "equipment" && t !== "weapon") continue;
        if (!embeddedGearMechanicalEffectsApply(item)) continue;
        gear.push(item);
    }
    const hasGate = gear.some((it) => normalizeMechanicalCreatureGateUuids(it.system?.mechanicalCreatureGateUuids).length > 0);
    if (!hasGate) return null;

    const reg =
        typeof globalThis.CONFIG !== "undefined" && Array.isArray(globalThis.CONFIG?.THIRDERA?.capabilitySourceProviders)
            ? globalThis.CONFIG.THIRDERA.capabilitySourceProviders
            : [];
    const baseProviders = reg.filter((p) => p !== cgsEmbeddedItemGrantsProvider);

    const baseMerge = { ...defaultCgsDepsForGearGateResolution(), ...(mergeDeps && typeof mergeDeps === "object" ? mergeDeps : {}) };

    /** @type {Set<string>} */
    let accepted = new Set();
    for (const item of gear) {
        if (normalizeMechanicalCreatureGateUuids(item.system?.mechanicalCreatureGateUuids).length === 0) {
            accepted.add(embeddedGearItemStableKey(item));
        }
    }

    let changed = true;
    let guard = 0;
    while (changed && guard++ < 16) {
        changed = false;
        const interimAccepted = accepted;
        const interimProvider = (a) => collectEmbeddedItemGrantsForCgs(a, interimAccepted);
        const providers = [...baseProviders, interimProvider];
        const cgs = getActiveCapabilityGrants(actor, { ...baseMerge, providers });
        const sys = actor?.system;
        const overlaySystem = sys && typeof sys === "object" ? { ...sys, cgs } : { cgs };

        for (const item of gear) {
            const gk = embeddedGearItemStableKey(item);
            if (accepted.has(gk)) continue;
            const gate = normalizeMechanicalCreatureGateUuids(item.system?.mechanicalCreatureGateUuids);
            if (gate.length === 0) continue;
            if (effectiveCreatureTypesIncludeAnyUuid(overlaySystem, gate)) {
                accepted.add(gk);
                changed = true;
            }
        }
    }
    return accepted;
}

/**
 * @param {unknown} actor
 * @returns {Array<{ label: string, grants: unknown[], sourceRef: Record<string, unknown> }>}
 */
export function cgsEmbeddedItemGrantsProvider(actor) {
    const accepted = getAcceptedMechanicalGearIdsForActor(actor);
    return collectEmbeddedItemGrantsForCgs(actor, accepted);
}
