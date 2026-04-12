import { describe, expect, it } from "vitest";
import { parseConcentrationOtherInputs } from "../../../module/logic/concentration-from-chat-helpers.mjs";

describe("parseConcentrationOtherInputs", () => {
    it("returns OtherNeedDcOrDamage when both fields empty", () => {
        expect(parseConcentrationOtherInputs("", "", 3)).toEqual({
            ok: false,
            errorKey: "THIRDERA.Concentration.OtherNeedDcOrDamage"
        });
        expect(parseConcentrationOtherInputs("   ", "\t", 0)).toEqual({
            ok: false,
            errorKey: "THIRDERA.Concentration.OtherNeedDcOrDamage"
        });
    });

    it("rejects invalid damage (non-finite or negative)", () => {
        expect(parseConcentrationOtherInputs("x", "", 2)).toEqual({
            ok: false,
            errorKey: "THIRDERA.Concentration.OtherInvalidDamage"
        });
        expect(parseConcentrationOtherInputs("-1", "", 2)).toEqual({
            ok: false,
            errorKey: "THIRDERA.Concentration.OtherInvalidDamage"
        });
    });

    it("returns damage path with SRD DC 10 + damage + spell level", () => {
        expect(parseConcentrationOtherInputs("5", "", 3)).toEqual({
            ok: true,
            dc: 18,
            labelKind: "damage",
            damage: 5
        });
    });

    it("returns OtherInvalidDamage when DC formula is not finite", () => {
        expect(parseConcentrationOtherInputs("0", "", NaN)).toEqual({
            ok: false,
            errorKey: "THIRDERA.Concentration.OtherInvalidDamage"
        });
    });

    it("returns custom DC path when damage empty and custom set", () => {
        expect(parseConcentrationOtherInputs("", "22", 9)).toEqual({
            ok: true,
            dc: 22,
            labelKind: "custom"
        });
    });

    it("rejects non-finite custom DC", () => {
        expect(parseConcentrationOtherInputs("", "oops", 1)).toEqual({
            ok: false,
            errorKey: "THIRDERA.Concentration.OtherInvalidCustomDc"
        });
    });

    it("prefers damage branch when both provided", () => {
        expect(parseConcentrationOtherInputs("2", "99", 1)).toEqual({
            ok: true,
            dc: 13,
            labelKind: "damage",
            damage: 2
        });
    });
});
