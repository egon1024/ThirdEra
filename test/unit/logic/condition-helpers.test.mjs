import { describe, expect, it } from "vitest";
import { getActiveConditionModifiers } from "../../../module/logic/condition-helpers.mjs";

function mockConditionItem(name, changes) {
    return {
        name,
        system: { changes }
    };
}

describe("getActiveConditionModifiers", () => {
    it("returns zeroed structure when no effects", () => {
        const actor = { effects: [] };
        const map = new Map();
        const out = getActiveConditionModifiers(actor, map);
        expect(out.ac).toBe(0);
        expect(out.loseDexToAc).toBe(false);
        expect(out.speedMultiplier).toBe(1);
        expect(out.saves.fort).toBe(0);
        expect(out.attackMelee).toBe(0);
    });

    it("aggregates AC and save modifiers from matching condition items", () => {
        const stunned = mockConditionItem("Stunned", [
            { key: "ac", value: -2, label: "Stunned" },
            { key: "saveFort", value: -4 }
        ]);
        const map = new Map([["stunned", stunned]]);
        const actor = {
            effects: [{ statuses: new Set(["stunned"]) }]
        };
        const out = getActiveConditionModifiers(actor, map);
        expect(out.ac).toBe(-2);
        expect(out.acBreakdown).toEqual([{ label: "Stunned", value: -2 }]);
        expect(out.saves.fort).toBe(-4);
    });

    it("sets loseDexToAc when acLoseDex change is non-zero", () => {
        const item = mockConditionItem("Flat-footed", [{ key: "acLoseDex", value: 1 }]);
        const map = new Map([["flat-footed", item]]);
        const actor = {
            effects: [{ statuses: new Set(["flat-footed"]) }]
        };
        const out = getActiveConditionModifiers(actor, map);
        expect(out.loseDexToAc).toBe(true);
    });

    it("multiplies speedMultiplier for values in (0,1]", () => {
        const item = mockConditionItem("Slow", [{ key: "speedMultiplier", value: 0.5 }]);
        const map = new Map([["slowed", item]]);
        const actor = {
            effects: [{ statuses: new Set(["slowed"]) }]
        };
        const out = getActiveConditionModifiers(actor, map);
        expect(out.speedMultiplier).toBe(0.5);
    });

    it("ignores unknown change keys", () => {
        const item = mockConditionItem("X", [{ key: "hp", value: 5 }]);
        const map = new Map([["x", item]]);
        const actor = {
            effects: [{ statuses: new Set(["x"]) }]
        };
        const out = getActiveConditionModifiers(actor, map);
        expect(out.ac).toBe(0);
    });

    it("chains speedMultiplier across two conditions on one effect", () => {
        const slow = mockConditionItem("Slow", [{ key: "speedMultiplier", value: 0.5 }]);
        const entangled = mockConditionItem("Entangled", [{ key: "speedMultiplier", value: 0.5 }]);
        const map = new Map([
            ["slowed", slow],
            ["entangled", entangled]
        ]);
        const actor = {
            effects: [{ statuses: new Set(["slowed", "entangled"]) }]
        };
        const out = getActiveConditionModifiers(actor, map);
        expect(out.speedMultiplier).toBeCloseTo(0.25);
    });

    it("applies generic attack to both melee and ranged breakdowns", () => {
        const item = mockConditionItem("Bless", [{ key: "attack", value: 1 }]);
        const map = new Map([["blessed", item]]);
        const actor = {
            effects: [{ statuses: new Set(["blessed"]) }]
        };
        const out = getActiveConditionModifiers(actor, map);
        expect(out.attackMelee).toBe(1);
        expect(out.attackRanged).toBe(1);
        expect(out.attackMeleeBreakdown).toHaveLength(1);
        expect(out.attackRangedBreakdown).toHaveLength(1);
    });

    it("applies attackMelee without affecting ranged", () => {
        const item = mockConditionItem("WF", [{ key: "attackMelee", value: 2 }]);
        const map = new Map([["wf", item]]);
        const actor = {
            effects: [{ statuses: new Set(["wf"]) }]
        };
        const out = getActiveConditionModifiers(actor, map);
        expect(out.attackMelee).toBe(2);
        expect(out.attackRanged).toBe(0);
    });
});
