import { describe, expect, it } from "vitest";
import {
    getCgsSpellGrantCastTotal,
    incrementCgsSpellGrantCastsMap,
    shouldUseCgsGrantCastMapForCast
} from "../../../module/logic/cgs-spell-grant-cast.mjs";

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

describe("shouldUseCgsGrantCastMapForCast", () => {
    const rowAtWill = { spellUuid: "u", atWill: true };
    const rowPerDay = { spellUuid: "u", usesPerDay: 1 };
    const rowPlain = { spellUuid: "u" };

    it("is false without a grant row or SLA-style row", () => {
        expect(shouldUseCgsGrantCastMapForCast(true, true, null)).toBe(false);
        expect(shouldUseCgsGrantCastMapForCast(true, true, rowPlain)).toBe(false);
    });

    it("is true for RTC panel when row is SLA-style", () => {
        expect(shouldUseCgsGrantCastMapForCast(false, true, rowAtWill)).toBe(true);
        expect(shouldUseCgsGrantCastMapForCast(false, true, rowPerDay)).toBe(true);
    });

    it("is true for explicit viaCgsGrant when row is SLA-style", () => {
        expect(shouldUseCgsGrantCastMapForCast(true, false, rowPerDay)).toBe(true);
    });

    it("is false for RTC without viaCgsGrant when row is not SLA-style", () => {
        expect(shouldUseCgsGrantCastMapForCast(false, true, rowPlain)).toBe(false);
    });
});
