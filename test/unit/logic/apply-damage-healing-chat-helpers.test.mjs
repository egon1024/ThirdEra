import { describe, expect, it } from "vitest";
import { getApplyDataFromRollFields } from "../../../module/logic/apply-damage-healing-chat-helpers.mjs";

describe("getApplyDataFromRollFields", () => {
    it("returns null when not a roll or no rolls", () => {
        expect(getApplyDataFromRollFields({ isRoll: false, rolls: [{ total: 5 }], flavor: "" })).toBeNull();
        expect(getApplyDataFromRollFields({ isRoll: true, rolls: [], flavor: "" })).toBeNull();
        expect(getApplyDataFromRollFields({ isRoll: true, rolls: null, flavor: "" })).toBeNull();
        expect(getApplyDataFromRollFields(null)).toBeNull();
    });

    it("uses damage mode by default and sums roll totals", () => {
        expect(
            getApplyDataFromRollFields({
                isRoll: true,
                rolls: [{ total: 3 }, { total: 4 }],
                flavor: "Melee"
            })
        ).toEqual({ amount: 7, mode: "damage" });
    });

    it("uses healing mode when flavor mentions heal", () => {
        expect(
            getApplyDataFromRollFields({
                isRoll: true,
                rolls: [{ total: 8 }],
                flavor: "Cure Light Wounds heal"
            })
        ).toEqual({ amount: 8, mode: "healing" });
    });

    it("for combined attack & damage, uses only last roll total", () => {
        expect(
            getApplyDataFromRollFields({
                isRoll: true,
                rolls: [{ total: 12 }, { total: 7 }],
                flavor: "Attack and Damage roll"
            })
        ).toEqual({ amount: 7, mode: "damage" });
    });

    it("combined path uses 0 when last roll has no numeric total", () => {
        expect(
            getApplyDataFromRollFields({
                isRoll: true,
                rolls: [{ total: 12 }, {}],
                flavor: "attack damage"
            })
        ).toEqual({ amount: 0, mode: "damage" });
    });
});
