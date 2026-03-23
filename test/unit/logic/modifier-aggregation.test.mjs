import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    getActiveModifiers,
    isCanonicalModifierKey
} from "../../../module/logic/modifier-aggregation.mjs";

describe("isCanonicalModifierKey", () => {
    it("accepts fixed keys", () => {
        expect(isCanonicalModifierKey("ac")).toBe(true);
        expect(isCanonicalModifierKey("acLoseDex")).toBe(true);
        expect(isCanonicalModifierKey("speedMultiplier")).toBe(true);
        expect(isCanonicalModifierKey("saveFort")).toBe(true);
        expect(isCanonicalModifierKey("naturalHealingPerDay")).toBe(true);
        expect(isCanonicalModifierKey("initiative")).toBe(true);
    });

    it("accepts ability.str and skill keys", () => {
        expect(isCanonicalModifierKey("ability.str")).toBe(true);
        expect(isCanonicalModifierKey("skill.climb")).toBe(true);
    });

    it("rejects unknown ability suffix", () => {
        expect(isCanonicalModifierKey("ability.foo")).toBe(false);
    });

    it("rejects empty and non-canonical keys", () => {
        expect(isCanonicalModifierKey("")).toBe(false);
        expect(isCanonicalModifierKey("   ")).toBe(false);
        expect(isCanonicalModifierKey("hp")).toBe(false);
        expect(isCanonicalModifierKey("spellDC")).toBe(false);
    });

    it("trims whitespace", () => {
        expect(isCanonicalModifierKey("  ac  ")).toBe(true);
    });
});

describe("getActiveModifiers", () => {
    let prevConfig;

    beforeEach(() => {
        prevConfig = globalThis.CONFIG;
        globalThis.CONFIG = { THIRDERA: { modifierSourceProviders: [] } };
    });

    afterEach(() => {
        globalThis.CONFIG = prevConfig;
        vi.restoreAllMocks();
    });

    it("defaults speedMultiplier to 1 when no contributions", () => {
        const bag = getActiveModifiers({});
        expect(bag.totals.speedMultiplier).toBe(1);
        expect(bag.totals.ac ?? 0).toBe(0);
    });

    it("sums additive keys from providers", () => {
        CONFIG.THIRDERA.modifierSourceProviders = [
            () => [
                {
                    label: "Feat A",
                    changes: [
                        { key: "ac", value: 2 },
                        { key: "ac", value: 1 }
                    ]
                }
            ]
        ];
        const bag = getActiveModifiers({});
        expect(bag.totals.ac).toBe(3);
        expect(bag.breakdown.ac).toHaveLength(2);
    });

    it("maps attack to attackMelee and attackRanged", () => {
        CONFIG.THIRDERA.modifierSourceProviders = [
            () => [{ label: "WF", changes: [{ key: "attack", value: 1 }] }]
        ];
        const bag = getActiveModifiers({});
        expect(bag.totals.attackMelee).toBe(1);
        expect(bag.totals.attackRanged).toBe(1);
    });

    it("multiplies speedMultiplier values in (0,1]", () => {
        CONFIG.THIRDERA.modifierSourceProviders = [
            () => [
                {
                    label: "A",
                    changes: [{ key: "speedMultiplier", value: 0.5 }]
                },
                {
                    label: "B",
                    changes: [{ key: "speedMultiplier", value: 0.5 }]
                }
            ]
        ];
        const bag = getActiveModifiers({});
        expect(bag.totals.speedMultiplier).toBeCloseTo(0.25);
    });

    it("ignores speedMultiplier outside (0,1]", () => {
        CONFIG.THIRDERA.modifierSourceProviders = [
            () => [
                { label: "Bad", changes: [{ key: "speedMultiplier", value: 2 }] },
                { label: "Bad2", changes: [{ key: "speedMultiplier", value: 0 }] }
            ]
        ];
        const bag = getActiveModifiers({});
        expect(bag.totals.speedMultiplier).toBe(1);
    });

    it("treats acLoseDex as boolean max (any non-zero -> 1)", () => {
        CONFIG.THIRDERA.modifierSourceProviders = [
            () => [
                { label: "A", changes: [{ key: "acLoseDex", value: 1 }] },
                { label: "B", changes: [{ key: "acLoseDex", value: 99 }] }
            ]
        ];
        const bag = getActiveModifiers({});
        expect(bag.totals.acLoseDex).toBe(1);
    });

    it("skips NaN values and non-canonical keys", () => {
        CONFIG.THIRDERA.modifierSourceProviders = [
            () => [
                {
                    label: "X",
                    changes: [
                        { key: "ac", value: NaN },
                        { key: "bogusKey", value: 5 },
                        { key: "saveWill", value: 2 }
                    ]
                }
            ]
        ];
        const bag = getActiveModifiers({});
        expect(bag.totals.ac ?? 0).toBe(0);
        expect(bag.totals.saveWill).toBe(2);
    });

    it("accepts provider returning { contributions } shape", () => {
        CONFIG.THIRDERA.modifierSourceProviders = [
            () => ({
                contributions: [{ label: "Pack", changes: [{ key: "initiative", value: 4 }] }]
            })
        ];
        const bag = getActiveModifiers({});
        expect(bag.totals.initiative).toBe(4);
    });

    it("continues after a provider throws", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        CONFIG.THIRDERA.modifierSourceProviders = [
            () => {
                throw new Error("boom");
            },
            () => [{ label: "OK", changes: [{ key: "ac", value: 1 }] }]
        ];
        const bag = getActiveModifiers({});
        expect(bag.totals.ac).toBe(1);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it("uses per-change label when present", () => {
        CONFIG.THIRDERA.modifierSourceProviders = [
            () => [
                {
                    label: "Feat",
                    changes: [{ key: "ac", value: 1, label: "Dodge bonus" }]
                }
            ]
        ];
        const bag = getActiveModifiers({});
        expect(bag.breakdown.ac[0].label).toBe("Dodge bonus");
    });
});
