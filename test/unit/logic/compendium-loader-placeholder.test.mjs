import { describe, expect, it } from "vitest";
import {
    collectObsoleteCreatureFeatureCompendiumDocIds,
    getCreatureFeatureCompendiumPurgeKeys,
    OBSOLETE_CREATURE_FEATURE_COMPENDIUM_KEYS
} from "../../../module/logic/compendium-loader.mjs";

describe("collectObsoleteCreatureFeatureCompendiumDocIds", () => {
    it("lists reserved placeholder keys", () => {
        expect(OBSOLETE_CREATURE_FEATURE_COMPENDIUM_KEYS.has("creatureFeaturePlaceholder")).toBe(true);
        expect(OBSOLETE_CREATURE_FEATURE_COMPENDIUM_KEYS.has("creatureAlertness")).toBe(true);
    });

    it("purge set includes legacy pre-consolidation creature feature keys", () => {
        const purge = getCreatureFeatureCompendiumPurgeKeys();
        expect(purge.has("creatureDarkvision60")).toBe(true);
        expect(purge.has("creatureDamageReduction5Magic")).toBe(true);
        expect(purge.has("creatureFastHealing1")).toBe(true);
        expect(purge.has("creatureDarkvision")).toBe(false);
    });

    it("returns ids for obsolete placeholders and legacy consolidated keys", () => {
        const ids = collectObsoleteCreatureFeatureCompendiumDocIds([
            { id: "abc", system: { key: "creatureDarkvision" } },
            { id: "ph1", system: { key: "creatureFeaturePlaceholder" } },
            { id: "ph2", system: { key: "creatureFeaturePlaceholder" } },
            { id: "al1", system: { key: "creatureAlertness" } },
            { id: "dv60", system: { key: "creatureDarkvision60" } }
        ]);
        expect(ids.sort()).toEqual(["al1", "dv60", "ph1", "ph2"].sort());
    });

    it("ignores docs without id or non-matching key", () => {
        expect(
            collectObsoleteCreatureFeatureCompendiumDocIds([
                { system: { key: "creatureFeaturePlaceholder" } },
                { id: "x", system: { key: "creatureBruteBlows" } }
            ])
        ).toEqual([]);
    });

    it("handles non-array input", () => {
        expect(collectObsoleteCreatureFeatureCompendiumDocIds(undefined)).toEqual([]);
        expect(collectObsoleteCreatureFeatureCompendiumDocIds(null)).toEqual([]);
    });
});
