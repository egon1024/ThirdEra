import { describe, expect, it } from "vitest";
import {
    getDerivedFrom,
    getDerivedHpConditionId
} from "../../../module/logic/derived-conditions.mjs";

describe("getDerivedHpConditionId", () => {
    it("returns null when hp missing or positive", () => {
        expect(getDerivedHpConditionId({})).toBe(null);
        expect(getDerivedHpConditionId({ system: {} })).toBe(null);
        expect(getDerivedHpConditionId({ system: { attributes: { hp: { value: 5 } } } })).toBe(null);
    });

    it("returns disabled at 0 HP", () => {
        expect(
            getDerivedHpConditionId({
                system: { attributes: { hp: { value: 0, stable: false } } }
            })
        ).toBe("disabled");
    });

    it("returns dying when negative and not stable", () => {
        expect(
            getDerivedHpConditionId({
                system: { attributes: { hp: { value: -5, stable: false } } }
            })
        ).toBe("dying");
    });

    it("returns stable when negative and stable", () => {
        expect(
            getDerivedHpConditionId({
                system: { attributes: { hp: { value: -1, stable: true } } }
            })
        ).toBe("stable");
    });

    it("returns dead at -10 or below", () => {
        expect(
            getDerivedHpConditionId({
                system: { attributes: { hp: { value: -10, stable: false } } }
            })
        ).toBe("dead");
        expect(
            getDerivedHpConditionId({
                system: { attributes: { hp: { value: -15, stable: true } } }
            })
        ).toBe("dead");
    });
});

describe("getDerivedFrom", () => {
    it("reads thirdera.derivedFrom flag", () => {
        const effect = {
            getFlag(ns, key) {
                if (ns === "thirdera" && key === "derivedFrom") return "hp";
                return null;
            }
        };
        expect(getDerivedFrom(effect)).toBe("hp");
    });

    it("returns null when flag missing", () => {
        expect(getDerivedFrom({})).toBe(null);
        expect(getDerivedFrom({ getFlag: () => null })).toBe(null);
    });
});
