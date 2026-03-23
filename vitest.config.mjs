import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["test/**/*.test.mjs", "test/**/*.spec.mjs"],
        passWithNoTests: false,
        coverage: {
            provider: "v8",
            reportsDirectory: "./coverage",
            reporter: ["text", "text-summary", "html", "lcov"],
            // Match import-safe areas documented in test/README.md (not whole module/).
            include: ["module/logic/**/*.mjs", "module/utils/**/*.mjs", "module/data/_*.mjs"],
            exclude: [
                "**/node_modules/**",
                // Foundry chat / I/O / packs — not run under Vitest (see test/README.md).
                "module/logic/*-from-chat.mjs",
                "module/logic/apply-damage-healing.mjs",
                "module/logic/apply-damage-healing-entry-points.mjs",
                "module/logic/audit-log.mjs",
                "module/logic/auto-granted-feats.mjs",
                "module/logic/character-system-source-backfill.mjs",
                "module/logic/class-spell-list.mjs",
                "module/logic/compendium-loader.mjs",
                "module/logic/domain-spells.mjs",
                // Needs Foundry-shaped actor graph; defer until extracted or CONFIG-injected tests.
                "module/data/_ac-helpers.mjs"
            ],
            // Enforced by `npm run test:coverage` / `make test-coverage` (CI **coverage** job).
            // Floors are intentionally conservative for now; raise when the suite stabilizes.
            thresholds: {
                lines: 66,
                statements: 66,
                branches: 66,
                functions: 66
            }
        }
    }
});
