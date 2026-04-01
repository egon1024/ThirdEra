import { describe, expect, it } from "vitest";
import { getCgsSpellGrantCastTotal, incrementCgsSpellGrantCastsMap } from "../../../module/logic/cgs-spell-grant-cast.mjs";

describe("getCgsSpellGrantCastTotal", () => {
    it("returns 0 when missing map or spell uuid", () => {
        expect(getCgsSpellGrantCastTotal({}, "Compendium.x.Item.y")).toBe(0);
        expect(getCgsSpellGrantCastTotal({ cgsSpellGrantCasts: {} }, "")).toBe(0);
        expect(getCgsSpellGrantCastTotal({ cgsSpellGrantCasts: { a: 2 } }, "  ")).toBe(0);
    });

    it("reads numeric total for spell uuid key", () => {
        const sys = {
            cgsSpellGrantCasts: {
                "Compendium.thirdera.spells.Item.abc": 3,
                other: 1
            }
        };
        expect(getCgsSpellGrantCastTotal(sys, "Compendium.thirdera.spells.Item.abc")).toBe(3);
        expect(getCgsSpellGrantCastTotal(sys, " Compendium.thirdera.spells.Item.abc ")).toBe(3);
    });

    it("coerces string values", () => {
        const sys = { cgsSpellGrantCasts: { u: "2" } };
        expect(getCgsSpellGrantCastTotal(sys, "u")).toBe(2);
    });
});

describe("incrementCgsSpellGrantCastsMap", () => {
    it("no-ops when spell uuid is blank (empty map or shallow copy)", () => {
        expect(incrementCgsSpellGrantCastsMap(undefined, "")).toEqual({});
        expect(incrementCgsSpellGrantCastsMap({ a: 1 }, "  ")).toEqual({ a: 1 });
    });

    it("increments from empty and preserves other keys", () => {
        const u = "Compendium.pack.Item.id";
        expect(incrementCgsSpellGrantCastsMap(undefined, u)).toEqual({ [u]: 1 });
        const prev = { [u]: 2, other: 5 };
        const next = incrementCgsSpellGrantCastsMap(prev, u);
        expect(next).toEqual({ [u]: 3, other: 5 });
        expect(next).not.toBe(prev);
    });

    it("does not mutate the input map", () => {
        const prev = { k: 1 };
        const out = incrementCgsSpellGrantCastsMap(prev, "k");
        expect(prev.k).toBe(1);
        expect(out.k).toBe(2);
    });
});
