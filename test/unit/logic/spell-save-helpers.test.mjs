import { describe, expect, it } from "vitest";
import { parseSaveType } from "../../../module/logic/spell-save-helpers.mjs";

describe("parseSaveType", () => {
    it("returns null for empty, see text, none", () => {
        expect(parseSaveType("")).toBe(null);
        expect(parseSaveType("   ")).toBe(null);
        expect(parseSaveType("See text")).toBe(null);
        expect(parseSaveType("None")).toBe(null);
        expect(parseSaveType("Will negates (harmless)")).not.toBe(null);
    });

    it("detects Fortitude", () => {
        expect(parseSaveType("Fortitude negates")).toBe("fort");
        expect(parseSaveType("Fort half")).toBe("fort");
    });

    it("detects Reflex", () => {
        expect(parseSaveType("Reflex half")).toBe("ref");
        expect(parseSaveType("Ref negates")).toBe("ref");
    });

    it("detects Will", () => {
        expect(parseSaveType("Will negates")).toBe("will");
        expect(parseSaveType("Will half")).toBe("will");
    });

    it("is case-insensitive", () => {
        expect(parseSaveType("will NEGATES")).toBe("will");
    });

    it("returns null when unparseable", () => {
        expect(parseSaveType("Strength negates")).toBe(null);
    });
});
