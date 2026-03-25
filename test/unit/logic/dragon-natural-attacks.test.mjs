import { describe, expect, it } from "vitest";
import {
    buildTrueDragonNaturalAttacks,
    summarizeTrueDragonFullAttack
} from "../../../module/logic/dragon-natural-attacks.mjs";

describe("buildTrueDragonNaturalAttacks", () => {
    it("returns empty for unknown size", () => {
        expect(buildTrueDragonNaturalAttacks({ sizeCode: "X", biteAttackBonus: 10 })).toEqual([]);
    });

    it("returns empty for non-finite bite bonus", () => {
        expect(buildTrueDragonNaturalAttacks({ sizeCode: "H", biteAttackBonus: NaN })).toEqual([]);
    });

    it("builds Huge dragon with Multiattack secondaries at bite − 2", () => {
        const atk = buildTrueDragonNaturalAttacks({ sizeCode: "H", biteAttackBonus: 31 });
        expect(atk[0]).toMatchObject({
            name: "Bite",
            dice: "2d8",
            primary: "true",
            presetAttackBonus: 31,
            reach: "15 ft"
        });
        expect(atk.filter((a) => a.name === "Claw")).toHaveLength(2);
        expect(atk.filter((a) => a.name === "Claw").every((a) => a.presetAttackBonus === 29)).toBe(true);
        expect(atk.some((a) => a.name === "Wing")).toBe(true);
        expect(atk.some((a) => a.name === "Tail slap")).toBe(true);
        expect(atk.some((a) => a.name === "Crush")).toBe(true);
        expect(atk.some((a) => a.name === "Tail sweep")).toBe(false);
    });

    it("Small dragon has bite and claws only", () => {
        const atk = buildTrueDragonNaturalAttacks({ sizeCode: "S", biteAttackBonus: 12 });
        expect(atk.map((a) => a.name)).toEqual(["Bite", "Claw", "Claw"]);
        expect(atk[0].presetAttackBonus).toBe(12);
        expect(atk[1].presetAttackBonus).toBe(10);
    });

    it("Colossal includes tail sweep", () => {
        const atk = buildTrueDragonNaturalAttacks({ sizeCode: "C", biteAttackBonus: 49 });
        expect(atk.some((a) => a.name === "Tail sweep")).toBe(true);
        expect(atk.at(-1)?.name).toBe("Tail sweep");
    });
});

describe("summarizeTrueDragonFullAttack", () => {
    it("groups repeated weapons", () => {
        const atk = buildTrueDragonNaturalAttacks({ sizeCode: "M", biteAttackBonus: 14 });
        const s = summarizeTrueDragonFullAttack(atk);
        expect(s).toContain("2× Claw");
        expect(s).toContain("2× Wing");
    });
});
