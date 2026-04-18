import { describe, expect, it, vi } from "vitest";
import {
    BUNDLED_COMPENDIUM_SYNC_MIGRATION_REVISION,
    isBundledCompendiumMigrationPending,
    syncBundledCompendiumJsonForCollections,
    runBundledCompendiumJsonWorldMigrationIfNeeded
} from "../../../module/logic/compendium-bundled-json-sync.mjs";

describe("compendium-bundled-json-sync", () => {
    describe("isBundledCompendiumMigrationPending", () => {
        it("is pending when applied is below target", () => {
            expect(isBundledCompendiumMigrationPending(0, 1)).toBe(true);
            expect(isBundledCompendiumMigrationPending(undefined, 1)).toBe(true);
        });
        it("is not pending when applied matches target", () => {
            expect(isBundledCompendiumMigrationPending(1, 1)).toBe(false);
            expect(isBundledCompendiumMigrationPending(BUNDLED_COMPENDIUM_SYNC_MIGRATION_REVISION)).toBe(false);
        });
        it("treats non-finite applied as pending", () => {
            expect(isBundledCompendiumMigrationPending("x", 1)).toBe(true);
        });
    });

    describe("syncBundledCompendiumJsonForCollections", () => {
        it("calls loadPackFromJSON with bypassPopulationGate for each collection", async () => {
            const loadPackFromJSON = vi.fn().mockResolvedValue({ gateSkipped: false, created: 1, updated: 2 });
            const packA = { collection: "thirdera.thirdera_creature_features" };
            const deps = {
                game: { packs: { get: (id) => (id === "thirdera.thirdera_creature_features" ? packA : null) } },
                CompendiumLoader: { loadPackFromJSON },
                fileMappings: { "thirdera.thirdera_creature_features": ["a.json"] },
                yieldToMain: vi.fn().mockResolvedValue(undefined)
            };
            const out = await syncBundledCompendiumJsonForCollections(deps, ["thirdera.thirdera_creature_features"]);
            expect(loadPackFromJSON).toHaveBeenCalledTimes(1);
            expect(loadPackFromJSON).toHaveBeenCalledWith(packA, ["a.json"], { bypassPopulationGate: true });
            expect(out.totalCreated).toBe(1);
            expect(out.totalUpdated).toBe(2);
        });
    });

    describe("runBundledCompendiumJsonWorldMigrationIfNeeded", () => {
        it("does nothing when not GM", async () => {
            const setAppliedRevision = vi.fn();
            const out = await runBundledCompendiumJsonWorldMigrationIfNeeded({
                game: { user: { isGM: false } },
                getAppliedRevision: async () => 0,
                setAppliedRevision,
                localize: (k) => k,
                notifyInfo: vi.fn()
            });
            expect(out.ran).toBe(false);
            expect(out.reason).toBe("not-gm");
            expect(setAppliedRevision).not.toHaveBeenCalled();
        });

        it("skips when revision already current", async () => {
            const setAppliedRevision = vi.fn();
            const out = await runBundledCompendiumJsonWorldMigrationIfNeeded({
                game: { user: { isGM: true }, packs: { get: vi.fn() } },
                CompendiumLoader: { loadPackFromJSON: vi.fn() },
                fileMappings: { "thirdera.thirdera_creature_features": ["a.json"] },
                getAppliedRevision: async () => BUNDLED_COMPENDIUM_SYNC_MIGRATION_REVISION,
                setAppliedRevision,
                localize: (k) => k,
                notifyInfo: vi.fn()
            });
            expect(out.ran).toBe(false);
            expect(out.reason).toBe("already-current");
            expect(setAppliedRevision).not.toHaveBeenCalled();
        });
    });
});
