import { describe, expect, it } from "vitest";
import { getEffectiveCgsGrantShapeForOwnedItem } from "../../../module/logic/cgs-grant-template-merge.mjs";
import {
    getLegacyCreatureFeatureKeysForConsolidation,
    transformCreatureFeatureItemIfLegacy
} from "../../../module/logic/cgs-creature-feature-consolidation.mjs";

describe("cgs-creature-feature-consolidation", () => {
    it("lists legacy keys", () => {
        const keys = getLegacyCreatureFeatureKeysForConsolidation();
        expect(keys).toContain("creatureDarkvision60");
        expect(keys).toContain("creatureDamageReduction5Magic");
    });

    it("transforms darkvision 60 to canonical + overrides with same merged senses", () => {
        const legacy = {
            type: "creatureFeature",
            name: "Darkvision (60 ft.)",
            system: {
                key: "creatureDarkvision60",
                abilityKind: "Ex",
                changes: [],
                cgsGrants: { grants: [], senses: [{ type: "darkvision", range: "60 ft" }] }
            }
        };
        const before = getEffectiveCgsGrantShapeForOwnedItem(legacy, {});
        const out = transformCreatureFeatureItemIfLegacy(legacy);
        expect(out?.changed).toBe(true);
        const after = getEffectiveCgsGrantShapeForOwnedItem(out.item, {});
        expect(after.senses).toEqual(before.senses);
        expect(/** @type {{ system?: { key?: string } }} */ (out.item).system?.key).toBe("creatureDarkvision");
    });

    it("transforms DR 5/magic with same merged DR grant", () => {
        const legacy = {
            type: "creatureFeature",
            system: {
                key: "creatureDamageReduction5Magic",
                abilityKind: "Su",
                changes: [],
                cgsGrants: {
                    grants: [{ category: "damageReduction", value: 5, bypass: "magic", label: "x" }],
                    senses: []
                }
            }
        };
        const before = getEffectiveCgsGrantShapeForOwnedItem(legacy, {});
        const out = transformCreatureFeatureItemIfLegacy(legacy);
        expect(out?.changed).toBe(true);
        const after = getEffectiveCgsGrantShapeForOwnedItem(out.item, {});
        expect(after.grants.map((g) => ({ category: g.category, value: g.value, bypass: g.bypass }))).toEqual(
            before.grants.map((g) => ({ category: g.category, value: g.value, bypass: g.bypass }))
        );
    });

    it("is idempotent for already-canonical keys", () => {
        const item = {
            type: "creatureFeature",
            system: {
                key: "creatureDarkvision",
                cgsGrants: { grants: [], senses: [{ type: "darkvision", range: "" }] },
                cgsGrantOverrides: { grants: [], senses: [{ type: "darkvision", range: "60 ft" }] }
            }
        };
        expect(transformCreatureFeatureItemIfLegacy(item)).toBeNull();
    });
});
