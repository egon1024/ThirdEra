/**
 * Spell creature type targeting — effective-type consumer #4.
 *
 * When a spell has `system.targetCreatureTypeUuids` (non-empty), or authoring keys
 * (`targetCreatureTypeKeys` / `targetCreatureSubtypeKeys`) resolved at cast via
 * `cgs-spell-target-type-resolve-runtime.mjs`, it is limited to targets whose effective
 * creature types (§5.1 union) include at least one of those UUIDs. Validation uses
 * `getEffectiveCreatureTypes` so overlays from CGS are respected.
 *
 * Pure helpers here (no Foundry globals). Runtime key resolution lives in
 * `cgs-spell-target-type-resolve-runtime.mjs`.
 */

import { getEffectiveCreatureTypes, effectiveCreatureTypesIncludeAnyUuid } from "./cgs-effective-creature-types.mjs";

/**
 * Normalize the raw `system.targetCreatureTypeUuids` value to a clean array
 * of non-empty, trimmed UUID strings.
 *
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeSpellTargetCreatureTypeUuids(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((u) => (typeof u === "string" ? u.trim() : ""))
        .filter(Boolean);
}

/**
 * Check whether a single target actor's system data satisfies the spell's
 * creature type restriction.
 *
 * @param {string[]} spellTypeUuids  Normalized spell target UUIDs (from `normalizeSpellTargetCreatureTypeUuids`).
 * @param {Parameters<typeof getEffectiveCreatureTypes>[0]} targetSystemData  Post-prepareDerivedData `actor.system`.
 * @returns {{ valid: boolean, spellTypeUuids: string[], targetTypeUuids: string[], targetSubtypeUuids: string[] }}
 */
export function validateSpellTargetCreatureType(spellTypeUuids, targetSystemData) {
    const effective = getEffectiveCreatureTypes(targetSystemData);
    if (spellTypeUuids.length === 0) {
        return {
            valid: true,
            spellTypeUuids,
            targetTypeUuids: effective.typeUuids,
            targetSubtypeUuids: effective.subtypeUuids
        };
    }
    const valid = effectiveCreatureTypesIncludeAnyUuid(targetSystemData, spellTypeUuids);
    return {
        valid,
        spellTypeUuids,
        targetTypeUuids: effective.typeUuids,
        targetSubtypeUuids: effective.subtypeUuids
    };
}

/**
 * Validate all targets against a spell's creature type restriction and return
 * per-target results.
 *
 * @param {string[]} spellTypeUuids  Normalized spell target UUIDs.
 * @param {Array<{ name: string, uuid: string, systemData: object }>} targets
 * @returns {{ hasRestriction: boolean, allValid: boolean, results: Array<{ name: string, uuid: string, valid: boolean }> }}
 */
export function validateSpellTargetsCreatureTypes(spellTypeUuids, targets) {
    if (spellTypeUuids.length === 0) {
        return {
            hasRestriction: false,
            allValid: true,
            results: targets.map((t) => ({ name: t.name, uuid: t.uuid, valid: true }))
        };
    }
    const results = targets.map((t) => {
        const { valid } = validateSpellTargetCreatureType(spellTypeUuids, t.systemData);
        return { name: t.name, uuid: t.uuid, valid };
    });
    return {
        hasRestriction: true,
        allValid: results.every((r) => r.valid),
        results
    };
}
