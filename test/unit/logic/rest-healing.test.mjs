import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
    getActiveModifiers: vi.fn(() => ({ totals: {}, breakdown: {} }))
}));

vi.mock("../../../module/logic/modifier-aggregation.mjs", () => ({
    getActiveModifiers: (actor) => hoisted.getActiveModifiers(actor)
}));

import { getRestHealingAmount } from "../../../module/logic/rest-healing.mjs";

describe("getRestHealingAmount", () => {
    beforeEach(() => {
        hoisted.getActiveModifiers.mockReset();
        hoisted.getActiveModifiers.mockReturnValue({ totals: {}, breakdown: {} });
    });

    it("adds character level, GMS naturalHealingPerDay, and details bonus", () => {
        hoisted.getActiveModifiers.mockReturnValue({
            totals: { naturalHealingPerDay: 2 },
            breakdown: {}
        });
        const actor = {
            system: {
                details: { totalLevel: 5, naturalHealingBonus: 1 }
            }
        };
        expect(getRestHealingAmount(actor)).toBe(5 + 2 + 1);
    });

    it("uses details.level when totalLevel absent", () => {
        const actor = {
            system: {
                details: { level: 3, naturalHealingBonus: 0 }
            }
        };
        expect(getRestHealingAmount(actor)).toBe(3);
    });

    it("defaults invalid level to 1", () => {
        const actor = {
            system: {
                details: { totalLevel: 0, naturalHealingBonus: 0 }
            }
        };
        expect(getRestHealingAmount(actor)).toBe(1);
    });

    it("floors fractional level", () => {
        const actor = {
            system: {
                details: { totalLevel: 4.9, naturalHealingBonus: 0 }
            }
        };
        expect(getRestHealingAmount(actor)).toBe(4);
    });

    it("treats non-finite or negative naturalHealingBonus as 0", () => {
        const actor = {
            system: {
                details: { totalLevel: 2, naturalHealingBonus: -5 }
            }
        };
        expect(getRestHealingAmount(actor)).toBe(2);
        expect(
            getRestHealingAmount({
                system: { details: { totalLevel: 2, naturalHealingBonus: NaN } }
            })
        ).toBe(2);
    });

    it("passes actor into getActiveModifiers for GMS lookup", () => {
        const actor = { id: "a1", system: { details: { totalLevel: 1, naturalHealingBonus: 0 } } };
        getRestHealingAmount(actor);
        expect(hoisted.getActiveModifiers).toHaveBeenCalledWith(actor);
    });
});
