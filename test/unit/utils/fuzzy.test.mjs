import { describe, expect, it } from "vitest";
import { fuzzyScore, levenshtein } from "../../../module/utils/fuzzy.mjs";

describe("levenshtein", () => {
    it("returns 0 for identical strings (case-insensitive)", () => {
        expect(levenshtein("Foo", "foo")).toBe(0);
    });

    it("returns length when one side is empty", () => {
        expect(levenshtein("", "abc")).toBe(3);
        expect(levenshtein("xy", "")).toBe(2);
    });

    it("treats nullish as empty string", () => {
        expect(levenshtein(null, "a")).toBe(1);
        expect(levenshtein("b", undefined)).toBe(1);
    });

    it("computes classic edit distance", () => {
        expect(levenshtein("kitten", "sitting")).toBe(3);
        expect(levenshtein("a", "b")).toBe(1);
    });
});

describe("fuzzyScore", () => {
    it("empty query matches with score 0", () => {
        expect(fuzzyScore("", "anything")).toEqual({ score: 0, matched: true });
        expect(fuzzyScore("   ", "x")).toEqual({ score: 0, matched: true });
    });

    it("substring of name matches with score 0", () => {
        expect(fuzzyScore("app", "Appraise")).toEqual({ score: 0, matched: true });
    });

    it("substring of key matches with score 0", () => {
        expect(fuzzyScore("clim", "Foo", "climb")).toEqual({ score: 0, matched: true });
    });

    it("subsequence match yields score 0.1 (e.g. apr in appraise)", () => {
        const r = fuzzyScore("apr", "appraise");
        expect(r.matched).toBe(true);
        expect(r.score).toBe(0.1);
    });

    it("can fail match when string is too far from query", () => {
        const r = fuzzyScore("zzzz", "appraise");
        expect(r.matched).toBe(false);
        expect(r.score).toBeGreaterThan(0.65);
    });

    it("handles nullish name and key", () => {
        const r = fuzzyScore("hi", null, undefined);
        expect(r.matched).toBe(false);
    });
});
