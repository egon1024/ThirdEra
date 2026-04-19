import { describe, expect, it } from "vitest";
import {
    cgsGrantRowMergeKey,
    getEffectiveCgsGrantShapeForOwnedItem,
    mergeCgsGrantsTemplateWithOverrides,
    normalizeCgsGrantsShape,
    resolveTemplateCgsGrantsShape,
    shouldResolveTemplateCgsGrants
} from "../../../module/logic/cgs-grant-template-merge.mjs";

describe("normalizeCgsGrantsShape", () => {
    it("returns empty arrays for bad input", () => {
        expect(normalizeCgsGrantsShape(null)).toEqual({ grants: [], senses: [] });
        expect(normalizeCgsGrantsShape({})).toEqual({ grants: [], senses: [] });
    });
});

describe("mergeCgsGrantsTemplateWithOverrides", () => {
    it("replaces sense rows by type", () => {
        const out = mergeCgsGrantsTemplateWithOverrides(
            { senses: [{ type: "darkvision", range: "60 ft" }], grants: [] },
            { senses: [{ type: "darkvision", range: "120 ft" }], grants: [] }
        );
        expect(out.senses).toEqual([{ type: "darkvision", range: "120 ft" }]);
    });

    it("merges energy resistance by energyType", () => {
        const out = mergeCgsGrantsTemplateWithOverrides(
            {
                grants: [{ category: "energyResistance", energyType: "acid", amount: 10, label: "A" }],
                senses: []
            },
            { grants: [{ category: "energyResistance", energyType: "acid", amount: 20 }], senses: [] }
        );
        expect(out.grants[0]).toMatchObject({ category: "energyResistance", energyType: "acid", amount: 20, label: "A" });
    });

    it("appends unknown grant keys", () => {
        const out = mergeCgsGrantsTemplateWithOverrides(
            { grants: [{ category: "immunity", tag: "sleep", label: "S" }], senses: [] },
            { grants: [{ category: "immunity", tag: "paralysis", label: "P" }], senses: [] }
        );
        expect(out.grants).toHaveLength(2);
    });
});

describe("cgsGrantRowMergeKey", () => {
    it("keys damage reduction by bypass", () => {
        expect(cgsGrantRowMergeKey({ category: "damageReduction", value: 5, bypass: "magic" })).toBe("damageReduction|magic");
    });
});

describe("getEffectiveCgsGrantShapeForOwnedItem", () => {
    it("uses local cgsGrants when no overrides and sourceId only", () => {
        const item = {
            sourceId: "Compendium.thirdera.thirdera_feats.Item.x",
            system: {
                cgsGrants: { grants: [{ category: "sense", senseType: "scent", range: "30 ft" }], senses: [] }
            }
        };
        const shape = getEffectiveCgsGrantShapeForOwnedItem(item, {});
        expect(shape.grants).toHaveLength(1);
    });

    it("resolves template when overrides present", () => {
        const tpl = {
            documentName: "Item",
            system: {
                cgsGrants: { grants: [], senses: [{ type: "darkvision", range: "60 ft" }] }
            }
        };
        const item = {
            sourceId: "Compendium.pack.Item.abc",
            system: {
                cgsGrants: { grants: [], senses: [{ type: "darkvision", range: "60 ft" }] },
                cgsGrantOverrides: { grants: [], senses: [{ type: "darkvision", range: "90 ft" }] }
            }
        };
        const shape = getEffectiveCgsGrantShapeForOwnedItem(item, {
            fromUuidSync: () => tpl
        });
        expect(shape.senses).toEqual([{ type: "darkvision", range: "90 ft" }]);
    });

    it("uses thin template when local empty and sourceId resolves", () => {
        const tpl = {
            documentName: "Item",
            system: { cgsGrants: { grants: [], senses: [{ type: "darkvision", range: "60 ft" }] } }
        };
        const item = {
            sourceId: "Compendium.pack.Item.abc",
            system: { cgsGrants: { grants: [], senses: [] } }
        };
        expect(shouldResolveTemplateCgsGrants(item)).toBe(true);
        const shape = getEffectiveCgsGrantShapeForOwnedItem(item, { fromUuidSync: () => tpl });
        expect(shape.senses[0]).toMatchObject({ type: "darkvision", range: "60 ft" });
    });
});

describe("resolveTemplateCgsGrantsShape", () => {
    it("returns null when uuid missing", () => {
        expect(resolveTemplateCgsGrantsShape({ system: {} }, { fromUuidSync: () => null })).toBe(null);
    });
});
