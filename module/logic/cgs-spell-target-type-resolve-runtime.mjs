/**
 * Resolve spell `targetCreatureTypeKeys` / `targetCreatureSubtypeKeys` using loaded compendiums.
 * Used at cast time so restrictions apply even when compendium JSON keys were not persisted as UUIDs.
 */

import {
    buildCreatureTypeKeyToUuidMap,
    buildSubtypeKeyToUuidMap,
    resolveSpellTargetCreatureKeys
} from "./cgs-compendium-reference-resolve.mjs";
import { normalizeSpellTargetCreatureTypeUuids } from "./spell-creature-type-targeting.mjs";

/**
 * @param {unknown} spellSystem
 * @returns {Promise<string[]>}
 */
export async function resolveSpellTargetTypeUuidsFromPacks(spellSystem) {
    const base = normalizeSpellTargetCreatureTypeUuids(spellSystem?.targetCreatureTypeUuids);
    if (!spellSystem || typeof spellSystem !== "object") return base;
    const hasKeys =
        (Array.isArray(spellSystem.targetCreatureTypeKeys) &&
            spellSystem.targetCreatureTypeKeys.some((x) => String(x).trim())) ||
        (Array.isArray(spellSystem.targetCreatureSubtypeKeys) &&
            spellSystem.targetCreatureSubtypeKeys.some((x) => String(x).trim()));
    if (!hasKeys) return base;
    if (typeof game === "undefined" || !game?.packs) return base;
    const tp = game.packs.get("thirdera.thirdera_creature_types");
    const sp = game.packs.get("thirdera.thirdera_subtypes");
    if (!tp || !sp) return base;
    const typeM = buildCreatureTypeKeyToUuidMap(await tp.getDocuments());
    const subM = buildSubtypeKeyToUuidMap(await sp.getDocuments());
    const r = resolveSpellTargetCreatureKeys(spellSystem, typeM, subM);
    if (!r) return base;
    return normalizeSpellTargetCreatureTypeUuids(r.targetCreatureTypeUuids);
}
