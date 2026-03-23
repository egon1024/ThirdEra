import { describe, expect, it } from "vitest";
import {
    getActorSpellResistance,
    spellAllowsPenetrationRoll
} from "../../../module/logic/spell-resistance-helpers.mjs";

describe("getActorSpellResistance", () => {
    it("returns 0 when actor or system missing", () => {
        expect(getActorSpellResistance(null)).toBe(0);
        expect(getActorSpellResistance({})).toBe(0);
    });

    it("reads NPC stat block SR", () => {
        expect(
            getActorSpellResistance({
                type: "npc",
                system: { statBlock: { spellResistance: 12 } }
            })
        ).toBe(12);
    });

    it("reads PC details SR", () => {
        expect(
            getActorSpellResistance({
                type: "character",
                system: { details: { spellResistance: 18 } }
            })
        ).toBe(18);
    });

    it("truncates and floors at 0 for non-finite or negative", () => {
        expect(
            getActorSpellResistance({
                type: "character",
                system: { details: { spellResistance: 5.9 } }
            })
        ).toBe(5);
        expect(
            getActorSpellResistance({
                type: "npc",
                system: { statBlock: { spellResistance: -3 } }
            })
        ).toBe(0);
        expect(
            getActorSpellResistance({
                type: "npc",
                system: { statBlock: { spellResistance: NaN } }
            })
        ).toBe(0);
    });

    it("returns 0 for unknown actor type", () => {
        expect(
            getActorSpellResistance({
                type: "vehicle",
                system: { details: { spellResistance: 5 } }
            })
        ).toBe(0);
    });
});

describe("spellAllowsPenetrationRoll", () => {
    it("allows yes and yes-harmless", () => {
        expect(spellAllowsPenetrationRoll("yes")).toBe(true);
        expect(spellAllowsPenetrationRoll("yes-harmless")).toBe(true);
    });

    it("rejects other keys", () => {
        expect(spellAllowsPenetrationRoll("no")).toBe(false);
        expect(spellAllowsPenetrationRoll("no-object")).toBe(false);
        expect(spellAllowsPenetrationRoll("see-text")).toBe(false);
        expect(spellAllowsPenetrationRoll("")).toBe(false);
        expect(spellAllowsPenetrationRoll(undefined)).toBe(false);
        expect(spellAllowsPenetrationRoll("unknown")).toBe(false);
    });
});
