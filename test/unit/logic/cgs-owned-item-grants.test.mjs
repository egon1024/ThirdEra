import { describe, expect, it } from "vitest";
import {
    getEffectiveOwnedItemCgsGrants,
    mapCgsSensesRowsToSenseGrants
} from "../../../module/logic/cgs-owned-item-grants.mjs";

describe("mapCgsSensesRowsToSenseGrants", () => {
    it("maps non-empty type rows and skips blank type", () => {
        expect(
            mapCgsSensesRowsToSenseGrants([
                { type: "darkvision", range: "60 ft" },
                { type: "", range: "x" },
                { type: "scent", range: "30 ft" }
            ])
        ).toEqual([
            { category: "sense", senseType: "darkvision", range: "60 ft" },
            { category: "sense", senseType: "scent", range: "30 ft" }
        ]);
    });
});

describe("getEffectiveOwnedItemCgsGrants", () => {
    it("returns grants when grants array is non-empty", () => {
        const g = [{ category: "sense", senseType: "lowLight", range: "" }];
        const item = { system: { cgsGrants: { grants: g, senses: [{ type: "darkvision", range: "999" }] } } };
        expect(getEffectiveOwnedItemCgsGrants(item)).toEqual(g);
    });

    it("maps senses when grants empty", () => {
        const item = {
            system: { cgsGrants: { grants: [], senses: [{ type: "blindsight", range: "5 ft" }] } }
        };
        expect(getEffectiveOwnedItemCgsGrants(item)).toEqual([
            { category: "sense", senseType: "blindsight", range: "5 ft" }
        ]);
    });

    it("returns empty when no cgsGrants", () => {
        expect(getEffectiveOwnedItemCgsGrants({ system: {} })).toEqual([]);
    });
});
