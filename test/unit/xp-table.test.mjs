import { describe, expect, it } from "vitest";
import {
    SRD_XP_TABLE,
    getMidpointXpForLevel,
    getNextLevelXp,
    getXpForLevel
} from "../../module/logic/xp-table.mjs";

describe("SRD_XP_TABLE", () => {
    it("has 20 entries for levels 1–20", () => {
        expect(SRD_XP_TABLE).toHaveLength(20);
    });

    it("matches known SRD thresholds", () => {
        expect(SRD_XP_TABLE[0]).toBe(0);
        expect(SRD_XP_TABLE[1]).toBe(1000);
        expect(SRD_XP_TABLE[19]).toBe(190000);
    });
});

describe("getXpForLevel", () => {
    it("returns 0 for level below 1 or non-finite", () => {
        expect(getXpForLevel(0)).toBe(0);
        expect(getXpForLevel(-1)).toBe(0);
        expect(getXpForLevel(NaN)).toBe(0);
    });

    it("uses SRD table for levels 1–20", () => {
        for (let level = 1; level <= 20; level++) {
            expect(getXpForLevel(level)).toBe(SRD_XP_TABLE[level - 1]);
        }
    });

    it("floors fractional level", () => {
        expect(getXpForLevel(5.9)).toBe(getXpForLevel(5));
    });

    it("computes epic level 21 per SRD-style formula (226000 cumulative)", () => {
        expect(getXpForLevel(21)).toBe(226000);
    });

    it("computes epic level 22 consistently", () => {
        const inc = 2 * (getXpForLevel(20) - getXpForLevel(19));
        expect(getXpForLevel(22)).toBe(getXpForLevel(21) + inc);
    });
});

describe("getMidpointXpForLevel", () => {
    it("returns 0 for level < 1", () => {
        expect(getMidpointXpForLevel(0)).toBe(0);
    });

    it("returns floor of average of level min and next threshold", () => {
        expect(getMidpointXpForLevel(1)).toBe(Math.floor((0 + 1000) / 2));
        expect(getMidpointXpForLevel(20)).toBe(Math.floor((190000 + getXpForLevel(21)) / 2));
    });
});

describe("getNextLevelXp", () => {
    it("returns getXpForLevel(n + 1) for n >= 0", () => {
        expect(getNextLevelXp(0)).toBe(getXpForLevel(1));
        expect(getNextLevelXp(1)).toBe(getXpForLevel(2));
        expect(getNextLevelXp(20)).toBe(getXpForLevel(21));
    });

    it("returns getXpForLevel(1) for invalid total level", () => {
        expect(getNextLevelXp(-1)).toBe(getXpForLevel(1));
        expect(getNextLevelXp(NaN)).toBe(getXpForLevel(1));
    });
});
