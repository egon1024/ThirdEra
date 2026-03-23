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
});
