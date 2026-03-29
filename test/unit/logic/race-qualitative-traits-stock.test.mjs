import { describe, it, expect } from "vitest";
import {
    RACE_QUALITATIVE_TRAITS_REV,
    getStockOtherRacialTraitsHtmlForName,
    decideRaceQualitativeTraitsUpdate,
    getRaceQualitativeTraitsRevOnDoc,
    isStaleBundledQualitativeTraitsHtml
} from "../../../module/logic/race-qualitative-traits-stock.mjs";

describe("race-qualitative-traits-stock", () => {
    it("exports positive revision", () => {
        expect(RACE_QUALITATIVE_TRAITS_REV).toBeGreaterThanOrEqual(1);
    });

    it("getStockOtherRacialTraitsHtmlForName returns HTML for stock races", () => {
        const elf = getStockOtherRacialTraitsHtmlForName("Elf");
        expect(elf).toContain("magic sleep");
        expect(elf).toContain("Low-light");
        expect(getStockOtherRacialTraitsHtmlForName("Homebrew")).toBe("");
    });

    it("decideRaceQualitativeTraitsUpdate skips when doc revision is current", () => {
        expect(decideRaceQualitativeTraitsUpdate(RACE_QUALITATIVE_TRAITS_REV, "", "Elf")).toEqual({ action: "skip" });
    });

    it("decideRaceQualitativeTraitsUpdate bumps flag only when field already has content", () => {
        expect(decideRaceQualitativeTraitsUpdate(0, "<p>custom</p>", "Elf")).toEqual({ action: "bump-flag-only" });
    });

    it("isStaleBundledQualitativeTraitsHtml detects retired meta phrasing", () => {
        expect(isStaleBundledQualitativeTraitsHtml("<ul><li>mechanical table</li></ul>")).toBe(true);
        expect(isStaleBundledQualitativeTraitsHtml("<ul><li>per SRD Small rules</li></ul>")).toBe(true);
        expect(isStaleBundledQualitativeTraitsHtml("<ul><li>+2 morale vs fear.</li></ul>")).toBe(false);
    });

    it("decideRaceQualitativeTraitsUpdate replaces stale bundled halfling HTML when below rev", () => {
        const stale =
            "<ul><li><strong>Saves:</strong> +2 morale (stacks with the racial save bonuses on the mechanical table).</li></ul>";
        const d = decideRaceQualitativeTraitsUpdate(0, stale, "Halfling");
        expect(d.action).toBe("set-html-and-flag");
        expect(d.html).not.toContain("mechanical table");
        expect(d.html).toContain("+2 morale");
    });

    it("decideRaceQualitativeTraitsUpdate sets stock HTML when empty and name matches", () => {
        const d = decideRaceQualitativeTraitsUpdate(0, "   ", "Dwarf");
        expect(d.action).toBe("set-html-and-flag");
        expect(d.html).toContain("Darkvision");
        expect(d.html).toContain("Stonecunning");
    });

    it("decideRaceQualitativeTraitsUpdate bumps flag only for unknown race name", () => {
        expect(decideRaceQualitativeTraitsUpdate(0, "", "Custom Race")).toEqual({ action: "bump-flag-only" });
    });

    it("getRaceQualitativeTraitsRevOnDoc uses getProperty when provided", () => {
        const utils = {
            getProperty: (obj, path) => {
                if (!obj || typeof path !== "string") return undefined;
                return path.split(".").reduce((o, key) => (o != null ? o[key] : undefined), obj);
            }
        };
        const doc = { flags: { thirdera: { raceQualitativeTraitsRev: 3 } } };
        expect(getRaceQualitativeTraitsRevOnDoc(doc, utils)).toBe(3);
        expect(getRaceQualitativeTraitsRevOnDoc({ flags: {} }, utils)).toBe(0);
    });
});
