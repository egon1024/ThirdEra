import { describe, expect, it } from "vitest";
import {
    getEffectiveDamage,
    getStrMultiplier,
    getTWFPenalties,
    getWieldingInfo
} from "../../../module/data/_damage-helpers.mjs";

describe("getEffectiveDamage", () => {
    it("returns Medium base for Medium size", () => {
        expect(getEffectiveDamage("1d8", "Medium")).toBe("1d8");
    });

    it("steps up for Large", () => {
        expect(getEffectiveDamage("1d8", "Large")).toBe("2d6");
    });

    it("returns base dice for unknown size", () => {
        expect(getEffectiveDamage("1d8", "Unknown")).toBe("1d8");
    });

    it("returns base dice for unknown progression", () => {
        expect(getEffectiveDamage("9d9", "Large")).toBe("9d9");
    });
});

describe("getWieldingInfo", () => {
    it("returns no penalty when sizes match", () => {
        const r = getWieldingInfo("Medium", "oneHanded", "Medium");
        expect(r.attackPenalty).toBe(0);
        expect(r.canWield).toBe(true);
        expect(r.effectiveHandedness).toBe("oneHanded");
    });

    it("applies -2 per size step for oversized weapon", () => {
        const r = getWieldingInfo("Large", "oneHanded", "Medium");
        expect(r.attackPenalty).toBe(-2);
        expect(r.canWield).toBe(true);
    });

    it("returns safe defaults for unknown size", () => {
        const r = getWieldingInfo("Huge", "oneHanded", "bogus");
        expect(r.attackPenalty).toBe(0);
        expect(r.canWield).toBe(true);
    });
});

describe("getTWFPenalties", () => {
    it("uses lighter penalties for light off-hand", () => {
        expect(getTWFPenalties("light")).toEqual({ primaryPenalty: -4, offhandPenalty: -8 });
    });

    it("uses heavier penalties for one-handed off-hand", () => {
        expect(getTWFPenalties("oneHanded")).toEqual({ primaryPenalty: -6, offhandPenalty: -10 });
    });
});

describe("getStrMultiplier", () => {
    it("returns 0.5 for off-hand", () => {
        expect(getStrMultiplier("offhand", "oneHanded")).toBe(0.5);
    });

    it("returns 1.5 for two-handed primary", () => {
        expect(getStrMultiplier("primary", "twoHanded")).toBe(1.5);
    });

    it("returns 1 for primary one-handed", () => {
        expect(getStrMultiplier("primary", "oneHanded")).toBe(1);
    });
});
