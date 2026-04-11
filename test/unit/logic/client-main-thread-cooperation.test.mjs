import { describe, expect, it } from "vitest";
import { runWithConcurrencyLimit, yieldToMain } from "../../../module/logic/client-main-thread-cooperation.mjs";

describe("client-main-thread-cooperation", () => {
    it("yieldToMain resolves", async () => {
        await expect(yieldToMain()).resolves.toBeUndefined();
    });

    it("runWithConcurrencyLimit returns empty for empty input", async () => {
        await expect(runWithConcurrencyLimit([], 4, async () => 1)).resolves.toEqual([]);
    });

    it("runWithConcurrencyLimit preserves order and respects limit", async () => {
        let inFlight = 0;
        let maxInFlight = 0;
        const items = [1, 2, 3, 4, 5, 6];
        const results = await runWithConcurrencyLimit(items, 2, async (x) => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise((r) => setTimeout(r, 2));
            inFlight--;
            return x * 2;
        });
        expect(results).toEqual([2, 4, 6, 8, 10, 12]);
        expect(maxInFlight).toBeLessThanOrEqual(2);
    });

    it("runWithConcurrencyLimit clamps limit below 1 to 1", async () => {
        let maxInFlight = 0;
        let cur = 0;
        await runWithConcurrencyLimit([1, 2, 3], 0, async () => {
            cur++;
            maxInFlight = Math.max(maxInFlight, cur);
            await new Promise((r) => setTimeout(r, 1));
            cur--;
        });
        expect(maxInFlight).toBe(1);
    });
});
