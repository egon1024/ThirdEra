import { describe, expect, it } from "vitest";
import { damageWhileCastingDc, defensiveDc } from "../../../module/logic/concentration-dcs.mjs";

describe("defensiveDc", () => {
    it("returns 15 + spell level for finite levels", () => {
        expect(defensiveDc(0)).toBe(15);
        expect(defensiveDc(1)).toBe(16);
        expect(defensiveDc(9)).toBe(24);
    });

    it("coerces numeric strings", () => {
        expect(defensiveDc("3")).toBe(18);
    });

    it("returns NaN for non-finite spell level", () => {
        expect(Number.isNaN(defensiveDc(NaN))).toBe(true);
        expect(Number.isNaN(defensiveDc(undefined))).toBe(true);
        expect(Number.isNaN(defensiveDc(Infinity))).toBe(true);
    });
});

describe("damageWhileCastingDc", () => {
    it("returns 10 + truncated non-negative damage + spell level", () => {
        expect(damageWhileCastingDc(5, 3)).toBe(18);
        expect(damageWhileCastingDc(0, 0)).toBe(10);
    });

    it("truncates damage toward zero and floors at 0", () => {
        expect(damageWhileCastingDc(7.9, 1)).toBe(10 + 7 + 1);
        expect(damageWhileCastingDc(-3, 2)).toBe(10 + 0 + 2);
    });

    it("returns NaN if damage or spell level is not finite", () => {
        expect(Number.isNaN(damageWhileCastingDc(NaN, 1))).toBe(true);
        expect(Number.isNaN(damageWhileCastingDc(1, NaN))).toBe(true);
    });
});
