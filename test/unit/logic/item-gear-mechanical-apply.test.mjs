import { describe, expect, it } from "vitest";
import {
    embeddedGearMechanicalEffectsApply,
    MECHANICAL_APPLY_SCOPE_CARRIED,
    MECHANICAL_APPLY_SCOPE_EQUIPPED,
    normalizeMechanicalApplyScope
} from "../../../module/logic/item-gear-mechanical-apply.mjs";
import { itemsModifierProvider } from "../../../module/logic/modifier-aggregation.mjs";
import { cgsEmbeddedItemGrantsProvider } from "../../../module/logic/cgs-embedded-item-grants-provider.mjs";

describe("normalizeMechanicalApplyScope", () => {
    it("defaults missing or invalid to equipped", () => {
        expect(normalizeMechanicalApplyScope(undefined)).toBe(MECHANICAL_APPLY_SCOPE_EQUIPPED);
        expect(normalizeMechanicalApplyScope("")).toBe(MECHANICAL_APPLY_SCOPE_EQUIPPED);
        expect(normalizeMechanicalApplyScope("bogus")).toBe(MECHANICAL_APPLY_SCOPE_EQUIPPED);
        expect(normalizeMechanicalApplyScope(123)).toBe(MECHANICAL_APPLY_SCOPE_EQUIPPED);
    });

    it("accepts carried", () => {
        expect(normalizeMechanicalApplyScope("carried")).toBe(MECHANICAL_APPLY_SCOPE_CARRIED);
        expect(normalizeMechanicalApplyScope(" carried ")).toBe(MECHANICAL_APPLY_SCOPE_CARRIED);
    });
});

describe("embeddedGearMechanicalEffectsApply", () => {
    it("is false for non-gear types", () => {
        expect(
            embeddedGearMechanicalEffectsApply({
                type: "feat",
                system: { mechanicalApplyScope: "carried", equipped: "false" }
            })
        ).toBe(false);
    });

    it("armor and equipment: equipped scope requires equipped true", () => {
        expect(
            embeddedGearMechanicalEffectsApply({
                type: "armor",
                system: { equipped: "false" }
            })
        ).toBe(false);
        expect(
            embeddedGearMechanicalEffectsApply({
                type: "armor",
                system: { equipped: "true" }
            })
        ).toBe(true);
        expect(
            embeddedGearMechanicalEffectsApply({
                type: "equipment",
                system: { equipped: "true" }
            })
        ).toBe(true);
    });

    it("armor and equipment: carried scope applies when not equipped", () => {
        expect(
            embeddedGearMechanicalEffectsApply({
                type: "armor",
                system: { equipped: "false", mechanicalApplyScope: "carried" }
            })
        ).toBe(true);
    });

    it("weapon: equipped scope requires primary or offhand", () => {
        expect(
            embeddedGearMechanicalEffectsApply({
                type: "weapon",
                system: { equipped: "none" }
            })
        ).toBe(false);
        expect(
            embeddedGearMechanicalEffectsApply({
                type: "weapon",
                system: { equipped: "primary" }
            })
        ).toBe(true);
        expect(
            embeddedGearMechanicalEffectsApply({
                type: "weapon",
                system: { equipped: "offhand" }
            })
        ).toBe(true);
    });

    it("weapon: carried scope applies when not wielded", () => {
        expect(
            embeddedGearMechanicalEffectsApply({
                type: "weapon",
                system: { equipped: "none", mechanicalApplyScope: "carried" }
            })
        ).toBe(true);
    });
});

describe("Phase 5g GMS and CGS parity", () => {
    const actorBase = {
        items: [
            {
                type: "armor",
                name: "Robe",
                uuid: "Item.a",
                system: {
                    equipped: "false",
                    mechanicalApplyScope: "carried",
                    changes: [{ key: "ac", value: 2, label: "" }],
                    cgsGrants: { grants: [{ category: "sense", senseType: "darkvision", range: "30 ft" }] }
                }
            }
        ]
    };

    it("itemsModifierProvider includes carried-scope armor changes", () => {
        const [row] = itemsModifierProvider(actorBase);
        expect(row.label).toBe("Robe");
        expect(row.changes.some((c) => c.key === "ac" && c.value === 2)).toBe(true);
    });

    it("cgsEmbeddedItemGrantsProvider includes carried-scope armor grants", () => {
        const out = cgsEmbeddedItemGrantsProvider(actorBase);
        expect(out).toHaveLength(1);
        expect(out[0].label).toBe("Robe");
        expect(out[0].grants[0]).toMatchObject({ category: "sense", senseType: "darkvision", range: "30 ft" });
    });
});
