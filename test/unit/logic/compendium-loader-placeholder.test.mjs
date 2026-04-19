import { describe, expect, it } from "vitest";
import {
    collectObsoleteCreatureFeatureCompendiumDocIds,
    OBSOLETE_CREATURE_FEATURE_COMPENDIUM_KEYS
} from "../../../module/logic/compendium-loader.mjs";

describe("collectObsoleteCreatureFeatureCompendiumDocIds", () => {
    it("lists reserved placeholder keys", () => {
        expect(OBSOLETE_CREATURE_FEATURE_COMPENDIUM_KEYS.has("creatureFeaturePlaceholder")).toBe(true);
        expect(OBSOLETE_CREATURE_FEATURE_COMPENDIUM_KEYS.has("creatureAlertness")).toBe(true);
    });

    it("returns ids for docs whose system.key is the obsolete placeholder", () => {
        const ids = collectObsoleteCreatureFeatureCompendiumDocIds([
            { id: "abc", system: { key: "creatureDarkvision60" } },
            { id: "ph1", system: { key: "creatureFeaturePlaceholder" } },
            { id: "ph2", system: { key: "creatureFeaturePlaceholder" } },
            { id: "al1", system: { key: "creatureAlertness" } }
        ]);
        expect(ids).toEqual(["ph1", "ph2", "al1"]);
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
