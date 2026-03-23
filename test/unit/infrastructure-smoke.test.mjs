import { describe, expect, it } from "vitest";

/**
 * Phase 1: verifies Vitest + ESM + CI wiring. No imports from module/ yet.
 */
describe("test infrastructure", () => {
    it("runs Vitest successfully", () => {
        expect(1 + 1).toBe(2);
    });
});
