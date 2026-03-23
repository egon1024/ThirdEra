import { describe, expect, it } from "vitest";
import {
    applyParsedSpellFields,
    parseSpellFields
} from "../../../module/logic/spell-description-parser.mjs";

describe("parseSpellFields", () => {
    it("fills from canonical SRD map for known spell name", () => {
        const out = parseSpellFields("", "Fireball", {});
        expect(out.range).toContain("Long");
        expect(out.target).toMatch(/radius/i);
        expect(out.duration).toBe("Instantaneous");
        expect(out.savingThrow).toMatch(/Reflex/i);
    });

    it("does not overwrite existing non-blank fields", () => {
        const out = parseSpellFields("", "Fireball", {
            range: "Touch",
            target: "See text",
            duration: "See text",
            savingThrow: "See text"
        });
        expect(out.range).toBeUndefined();
    });

    it("parses labeled lines from stripped description", () => {
        const html = `<p>Range: Close (25 ft.)</p><p>Duration: 1 round</p>`;
        const out = parseSpellFields(html, "Custom", {
            range: "",
            target: "",
            duration: "",
            savingThrow: ""
        });
        expect(out.range).toMatch(/Close/i);
        expect(out.duration).toMatch(/1 round/i);
    });

    it("uses heuristics for touch when description implies touch and range still See text", () => {
        const html = "<p>You touch a willing creature to receive a blessing.</p>";
        const out = parseSpellFields(html, "Unknown Spell", {
            range: "See text",
            target: "",
            duration: "",
            savingThrow: ""
        });
        expect(out.range).toMatch(/Touch/i);
    });
});

describe("applyParsedSpellFields", () => {
    it("mutates system with parsed keys only", () => {
        const system = { range: "See text", other: 1 };
        applyParsedSpellFields(system, { range: "Touch", target: "You" });
        expect(system.range).toBe("Touch");
        expect(system.target).toBe("You");
        expect(system.other).toBe(1);
    });

    it("no-ops on null system or parsed", () => {
        expect(() => applyParsedSpellFields(null, { range: "x" })).not.toThrow();
        expect(() => applyParsedSpellFields({}, null)).not.toThrow();
    });
});
