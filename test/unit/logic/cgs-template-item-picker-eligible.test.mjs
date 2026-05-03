import { describe, expect, it } from "vitest";
import { documentEligibleAsCgsTemplatePicker } from "../../../module/logic/cgs-template-link-display.mjs";

describe("documentEligibleAsCgsTemplatePicker", () => {
    it("false when not an Item with cgsGrants", () => {
        expect(documentEligibleAsCgsTemplatePicker(null)).toBe(false);
        expect(documentEligibleAsCgsTemplatePicker({ documentName: "Actor" })).toBe(false);
        expect(documentEligibleAsCgsTemplatePicker({ documentName: "Item", system: {} })).toBe(false);
    });

    it("false when grants and senses empty", () => {
        expect(
            documentEligibleAsCgsTemplatePicker({
                documentName: "Item",
                system: { cgsGrants: { grants: [], senses: [] } }
            })
        ).toBe(false);
    });

    it("true when sense row present", () => {
        expect(
            documentEligibleAsCgsTemplatePicker({
                documentName: "Item",
                system: { cgsGrants: { grants: [], senses: [{ type: "darkvision", range: "" }] } }
            })
        ).toBe(true);
    });

    it("true when grant row present", () => {
        expect(
            documentEligibleAsCgsTemplatePicker({
                documentName: "Item",
                system: { cgsGrants: { grants: [{ category: "immunity", tag: "sleep" }], senses: [] } }
            })
        ).toBe(true);
    });
});
