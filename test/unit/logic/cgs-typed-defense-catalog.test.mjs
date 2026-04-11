import { describe, expect, it } from "vitest";
import {
    buildTypedDefenseCatalogMapsFromPlainDocs,
    defaultCatalogKeyFromDisplayName,
    mergeConfigAndTypedDefenseCatalogMaps,
    mergeStringLabelRecords
} from "../../../module/logic/cgs-typed-defense-catalog.mjs";
import {
    getMergedTypedDefenseLabelMapsForPrepare,
    refreshTypedDefenseCatalogCache
} from "../../../module/logic/cgs-typed-defense-catalog-runtime.mjs";

describe("defaultCatalogKeyFromDisplayName", () => {
    it("returns camelCase from words", () => {
        expect(defaultCatalogKeyFromDisplayName("Fire")).toBe("fire");
        expect(defaultCatalogKeyFromDisplayName("Cold iron")).toBe("coldIron");
        expect(defaultCatalogKeyFromDisplayName("Mind affecting")).toBe("mindAffecting");
    });
    it("returns empty for blank", () => {
        expect(defaultCatalogKeyFromDisplayName("")).toBe("");
        expect(defaultCatalogKeyFromDisplayName("   ")).toBe("");
        expect(defaultCatalogKeyFromDisplayName(undefined)).toBe("");
    });
});

describe("mergeStringLabelRecords", () => {
    it("catalog overrides config keys", () => {
        expect(mergeStringLabelRecords({ a: "A" }, { a: "Override" })).toEqual({ a: "Override" });
    });
});

describe("buildTypedDefenseCatalogMapsFromPlainDocs", () => {
    it("partitions by kind and uses item name as label", () => {
        const maps = buildTypedDefenseCatalogMapsFromPlainDocs([
            { name: "Holy", system: { catalogKey: "holy", catalogKind: "drBypass" } },
            { name: "Radiant", system: { catalogKey: "radiant", catalogKind: "energyType" } },
            { name: "Death", system: { catalogKey: "death", catalogKind: "immunityTag" } }
        ]);
        expect(maps.drBypassLabels.holy).toBe("Holy");
        expect(maps.energyTypeLabels.radiant).toBe("Radiant");
        expect(maps.immunityTagLabels.death).toBe("Death");
    });

    it("energyResistance uses same label map as energyType", () => {
        const maps = buildTypedDefenseCatalogMapsFromPlainDocs([
            { name: "Sonic", system: { catalogKey: "sonic", catalogKind: "energyResistance" } }
        ]);
        expect(maps.energyTypeLabels.sonic).toBe("Sonic");
    });

    it("uses key as label when name missing", () => {
        const maps = buildTypedDefenseCatalogMapsFromPlainDocs([{ system: { catalogKey: "arcane", catalogKind: "drBypass" } }]);
        expect(maps.drBypassLabels.arcane).toBe("arcane");
    });
});

describe("mergeConfigAndTypedDefenseCatalogMaps", () => {
    it("merges config with catalog override records", () => {
        const merged = mergeConfigAndTypedDefenseCatalogMaps(
            { immunityTags: { poison: "Poison" }, energyTypes: { fire: "Fire" }, drBypassTypes: { magic: "Magic" } },
            { immunityTagLabels: { poison: "Poison (homebrew)" }, energyTypeLabels: {}, drBypassLabels: {} }
        );
        expect(merged.immunityTagLabels.poison).toBe("Poison (homebrew)");
        expect(merged.energyTypeLabels.fire).toBe("Fire");
    });
});

describe("cgs-typed-defense-catalog-runtime", () => {
    it("getMergedTypedDefenseLabelMapsForPrepare reads game.thirdera maps", () => {
        const game = { thirdera: { typedDefenseCatalogMaps: { immunityTagLabels: { holy: "Holy" } } } };
        const merged = getMergedTypedDefenseLabelMapsForPrepare(game, {
            immunityTags: { poison: "Poison" },
            energyTypes: {},
            drBypassTypes: {}
        });
        expect(merged.immunityTagLabels.holy).toBe("Holy");
        expect(merged.immunityTagLabels.poison).toBe("Poison");
    });

    it("refreshTypedDefenseCatalogCache no-ops without game.thirdera", async () => {
        await expect(refreshTypedDefenseCatalogCache({})).resolves.toBeUndefined();
    });

    it("refreshTypedDefenseCatalogCache builds maps from defenseCatalog items", async () => {
        const game = {
            thirdera: {},
            items: {
                contents: [
                    { type: "defenseCatalog", name: "Void", system: { catalogKey: "void", catalogKind: "energyType" } }
                ]
            },
            packs: { get: () => null }
        };
        await refreshTypedDefenseCatalogCache(game);
        expect(game.thirdera.typedDefenseCatalogMaps.energyTypeLabels.void).toBe("Void");
    });
});
