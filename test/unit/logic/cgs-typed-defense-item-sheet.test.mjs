import { describe, expect, it } from "vitest";
import {
    buildDamageReductionSheetRowsFromGrants,
    buildEnergyResistanceSheetRowsFromGrants,
    buildImmunitySheetRowsFromGrants
} from "../../../module/logic/cgs-typed-defense-item-sheet.mjs";

describe("buildImmunitySheetRowsFromGrants", () => {
    it("returns empty for non-array input", () => {
        expect(buildImmunitySheetRowsFromGrants(null)).toEqual([]);
        expect(buildImmunitySheetRowsFromGrants(undefined)).toEqual([]);
    });

    it("extracts immunity rows with grantIndex", () => {
        const grants = [
            { category: "sense", senseType: "darkvision" },
            { category: "immunity", tag: "fire" },
            { category: "spellGrant", spellUuid: "Comp.x" },
            { category: "immunity", tag: "poison" }
        ];
        const rows = buildImmunitySheetRowsFromGrants(grants);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual({ grantIndex: 1, tag: "fire" });
        expect(rows[1]).toEqual({ grantIndex: 3, tag: "poison" });
    });
});

describe("buildEnergyResistanceSheetRowsFromGrants", () => {
    it("returns empty for non-array input", () => {
        expect(buildEnergyResistanceSheetRowsFromGrants(null)).toEqual([]);
    });

    it("extracts energyResistance rows with grantIndex and amount", () => {
        const grants = [
            { category: "energyResistance", energyType: "fire", amount: 10 },
            { category: "immunity", tag: "fire" },
            { category: "energyResistance", energyType: "cold", amount: 5 }
        ];
        const rows = buildEnergyResistanceSheetRowsFromGrants(grants);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual({ grantIndex: 0, energyType: "fire", amount: "10" });
        expect(rows[1]).toEqual({ grantIndex: 2, energyType: "cold", amount: "5" });
    });

    it("handles non-numeric amount as empty string", () => {
        const grants = [{ category: "energyResistance", energyType: "acid", amount: "invalid" }];
        const rows = buildEnergyResistanceSheetRowsFromGrants(grants);
        expect(rows[0].amount).toBe("");
    });
});

describe("buildDamageReductionSheetRowsFromGrants", () => {
    it("returns empty for non-array input", () => {
        expect(buildDamageReductionSheetRowsFromGrants(null)).toEqual([]);
    });

    it("extracts damageReduction rows with grantIndex, value, bypass", () => {
        const grants = [
            { category: "damageReduction", value: 10, bypass: "magic" },
            { category: "immunity", tag: "fire" },
            { category: "damageReduction", value: 5, bypass: "" }
        ];
        const rows = buildDamageReductionSheetRowsFromGrants(grants);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual({ grantIndex: 0, value: "10", bypass: "magic" });
        expect(rows[1]).toEqual({ grantIndex: 2, value: "5", bypass: "" });
    });

    it("handles non-numeric value as empty string", () => {
        const grants = [{ category: "damageReduction", value: NaN, bypass: "silver" }];
        const rows = buildDamageReductionSheetRowsFromGrants(grants);
        expect(rows[0].value).toBe("");
    });
});
