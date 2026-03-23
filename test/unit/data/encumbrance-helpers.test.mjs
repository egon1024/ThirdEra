import { describe, expect, it } from "vitest";
import {
    getCarryingCapacity,
    getLoadEffects,
    getLoadStatus
} from "../../../module/data/_encumbrance-helpers.mjs";

describe("getCarryingCapacity", () => {
    it("returns zeros for strength below 1 (no metadata branch)", () => {
        expect(getCarryingCapacity(0)).toEqual({
            light: 0,
            medium: 0,
            heavy: 0
        });
    });

    it("computes Medium thresholds for STR 10", () => {
        const c = getCarryingCapacity(10, "Medium");
        expect(c.heavy).toBe(100);
        expect(c.light).toBe(Math.floor(100 / 3));
        expect(c.medium).toBe(Math.floor((100 * 2) / 3));
    });

    it("applies Small size multiplier", () => {
        const med = getCarryingCapacity(10, "Medium");
        const small = getCarryingCapacity(10, "Small");
        expect(small.heavy).toBe(Math.floor(med.metadata.baseMaxLoad * 0.75));
    });
});

describe("getLoadStatus", () => {
    const t = { light: 33, medium: 66, heavy: 100 };

    it("classifies light, medium, heavy, overload", () => {
        expect(getLoadStatus(10, t)).toBe("light");
        expect(getLoadStatus(50, t)).toBe("medium");
        expect(getLoadStatus(90, t)).toBe("heavy");
        expect(getLoadStatus(150, t)).toBe("overload");
    });
});

describe("getLoadEffects", () => {
    it("returns expected penalties per load", () => {
        expect(getLoadEffects("light").maxDex).toBe(null);
        expect(getLoadEffects("medium").maxDex).toBe(3);
        expect(getLoadEffects("heavy").acp).toBe(-6);
        expect(getLoadEffects("overload").speed30).toBe(0);
    });

    it("defaults unknown load to light-like structure", () => {
        const r = getLoadEffects("bogus");
        expect(r.acp).toBe(0);
    });
});
