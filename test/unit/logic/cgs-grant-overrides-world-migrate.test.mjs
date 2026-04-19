import { describe, expect, it, vi } from "vitest";
import {
    CGS_GRANT_OVERRIDES_WORLD_MIGRATION_REVISION,
    runCgsGrantOverridesWorldMigrationIfNeeded
} from "../../../module/logic/cgs-grant-overrides-world-migrate.mjs";

describe("runCgsGrantOverridesWorldMigrationIfNeeded", () => {
    it("skips when not GM", async () => {
        const out = await runCgsGrantOverridesWorldMigrationIfNeeded({
            game: { user: { isGM: false } }
        });
        expect(out.skipped).toBe(true);
        expect(out.reason).toBe("not-gm");
    });

    it("bumps revision once when GM", async () => {
        const settings = new Map();
        const game = {
            user: { isGM: true },
            actors: [{ items: { values: () => [{ type: "feat" }] } }],
            settings: {
                get: (ns, k) => (ns === "thirdera" && k === "cgsGrantOverridesWorldMigrationRevision" ? settings.get(k) ?? 0 : 0),
                set: vi.fn(async (ns, k, v) => {
                    if (ns === "thirdera" && k === "cgsGrantOverridesWorldMigrationRevision") settings.set(k, v);
                })
            }
        };
        const first = await runCgsGrantOverridesWorldMigrationIfNeeded({ game });
        expect(first.skipped).toBe(false);
        expect(game.settings.set).toHaveBeenCalledWith(
            "thirdera",
            "cgsGrantOverridesWorldMigrationRevision",
            CGS_GRANT_OVERRIDES_WORLD_MIGRATION_REVISION
        );
        const second = await runCgsGrantOverridesWorldMigrationIfNeeded({ game });
        expect(second.skipped).toBe(true);
        expect(second.reason).toBe("already-applied");
    });
});
