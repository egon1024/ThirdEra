import { describe, expect, it } from "vitest";
import { normalizeNpcStatBlockNaturalAttackPresetBonuses } from "../../../module/logic/npc-stat-block-submit-normalize.mjs";

describe("normalizeNpcStatBlockNaturalAttackPresetBonuses", () => {
    it("coerces empty string and undefined presetAttackBonus to null", () => {
        const submitData = {
            system: {
                statBlock: {
                    naturalAttacks: [
                        { name: "Bite", presetAttackBonus: "" },
                        { name: "Claw", presetAttackBonus: undefined }
                    ]
                }
            }
        };
        normalizeNpcStatBlockNaturalAttackPresetBonuses(submitData);
        expect(submitData.system.statBlock.naturalAttacks[0].presetAttackBonus).toBe(null);
        expect(submitData.system.statBlock.naturalAttacks[1].presetAttackBonus).toBe(null);
    });

    it("preserves integers and parses numeric strings", () => {
        const submitData = {
            system: {
                statBlock: {
                    naturalAttacks: [
                        { presetAttackBonus: 15 },
                        { presetAttackBonus: "12" }
                    ]
                }
            }
        };
        normalizeNpcStatBlockNaturalAttackPresetBonuses(submitData);
        expect(submitData.system.statBlock.naturalAttacks[0].presetAttackBonus).toBe(15);
        expect(submitData.system.statBlock.naturalAttacks[1].presetAttackBonus).toBe(12);
    });

    it("no-ops when naturalAttacks missing", () => {
        const submitData = { system: { statBlock: {} } };
        expect(() => normalizeNpcStatBlockNaturalAttackPresetBonuses(submitData)).not.toThrow();
    });

    it("handles expandObject-style naturalAttacks as plain object (numeric keys)", () => {
        const submitData = {
            system: {
                statBlock: {
                    naturalAttacks: {
                        0: { name: "Bite", presetAttackBonus: "" },
                        1: { name: "Claw", presetAttackBonus: "" }
                    }
                }
            }
        };
        normalizeNpcStatBlockNaturalAttackPresetBonuses(submitData);
        expect(submitData.system.statBlock.naturalAttacks[0].presetAttackBonus).toBe(null);
        expect(submitData.system.statBlock.naturalAttacks[1].presetAttackBonus).toBe(null);
    });
});
