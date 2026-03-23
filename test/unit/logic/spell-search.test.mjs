import { describe, expect, it } from "vitest";
import {
    SPELL_SEARCH_HIDDEN_CLASS,
    normalizeQuery,
    spellMatches
} from "../../../module/logic/spell-search.mjs";

describe("SPELL_SEARCH_HIDDEN_CLASS", () => {
    it("exports stable CSS class name", () => {
        expect(SPELL_SEARCH_HIDDEN_CLASS).toBe("spell-search-hidden");
    });
});

describe("normalizeQuery", () => {
    it("trims, lowercases, collapses whitespace", () => {
        expect(normalizeQuery("  Foo   Bar  ")).toBe("foo bar");
    });

    it("returns empty string for nullish", () => {
        expect(normalizeQuery(null)).toBe("");
        expect(normalizeQuery(undefined)).toBe("");
    });
});

describe("spellMatches", () => {
    it("matches all when query empty", () => {
        expect(spellMatches("Fireball", "")).toBe(true);
        expect(spellMatches("x", normalizeQuery(""))).toBe(true);
    });

    it("matches substring letters in order (fuzzy subsequence)", () => {
        expect(spellMatches("Magic Missile", "mm")).toBe(true);
    });

    it("matches via Levenshtein on words for short queries", () => {
        expect(spellMatches("Fireball", "firebal")).toBe(true);
    });

    it("returns false when no reasonable match", () => {
        expect(spellMatches("Cure Light Wounds", "zzzz")).toBe(false);
    });
});
