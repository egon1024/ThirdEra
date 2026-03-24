# ThirdEra automated tests

Vitest runs any `*.test.mjs` / `*.spec.mjs` under `test/` (see [`vitest.config.mjs`](../vitest.config.mjs)). **Foundry VTT is not required** for these tests.

## Layout

| Directory | Mirrors | Purpose |
|-----------|---------|---------|
| [`unit/logic/`](unit/logic/) | `module/logic/` | Pure or mostly pure rules/helpers from `module/logic/`. |
| [`unit/utils/`](unit/utils/) | `module/utils/` | Shared utilities (e.g. fuzzy match). |
| [`unit/data/`](unit/data/) | `module/data/` | Standalone helper modules (`*_helpers.mjs`) that do not need Foundry at import time. |
| [`unit/`](unit/) (root) | — | Meta tests (e.g. runner smoke). |

## Coverage matrix

### Covered in `test/unit` (Node / Vitest)

| Production module | Test file |
|-------------------|-----------|
| `module/logic/concentration-dcs.mjs` | `unit/logic/concentration-dcs.test.mjs` |
| `module/logic/xp-table.mjs` | `unit/logic/xp-table.test.mjs` |
| `module/logic/spell-resistance-helpers.mjs` | `unit/logic/spell-resistance-helpers.test.mjs` |
| `module/logic/spell-save-helpers.mjs` | `unit/logic/spell-save-helpers.test.mjs` |
| `module/logic/spell-search.mjs` | `unit/logic/spell-search.test.mjs` |
| `module/logic/spell-description-parser.mjs` | `unit/logic/spell-description-parser.test.mjs` |
| `module/logic/feat-prerequisites.mjs` (`actorHasFeatByUuid`, `meetsFeatPrerequisites` with stubbed `foundry` / `game` / `CONFIG`) | `unit/logic/feat-prerequisites.test.mjs` |
| `module/logic/modifier-aggregation.mjs` (`isCanonicalModifierKey`, `getActiveModifiers` with stubbed `CONFIG`) | `unit/logic/modifier-aggregation.test.mjs` |
| `module/logic/rest-healing.mjs` (`computeRestHealing` with mocked `getActiveModifiers`) | `unit/logic/rest-healing.test.mjs` |
| `module/logic/condition-helpers.mjs` (`getActiveConditionModifiers` only) | `unit/logic/condition-helpers.test.mjs` |
| `module/logic/derived-conditions.mjs` (`getDerivedHpConditionId`, `getDerivedFrom` only) | `unit/logic/derived-conditions.test.mjs` |
| `module/logic/monster-pack-keys.mjs` (`resolveMonsterPackNpcKeys`) | `unit/logic/monster-pack-keys.test.mjs` |
| `module/logic/npc-skill-prep.mjs` (`prepareNpcSkillItems`, `buildModifierOnlySkills`, `skillMiscBreakdownLabel`, `resolvedSkillMiscLineLabel`) | `unit/logic/npc-skill-prep.test.mjs` |
| `module/logic/npc-embedded-skill-identity.mjs` (NPC skill embed identity / dedupe for sheet + create) | `unit/logic/npc-embedded-skill-identity.test.mjs` |
| `module/utils/fuzzy.mjs` | `unit/utils/fuzzy.test.mjs` |
| `module/data/_damage-helpers.mjs` | `unit/data/damage-helpers.test.mjs` |
| `module/data/_encumbrance-helpers.mjs` | `unit/data/encumbrance-helpers.test.mjs` |
| `packs/monsters/*.json` (embedded skill/feat `system.key` uniqueness) | `unit/data/monster-embedded-skills-uniqueness.test.mjs` |

### Not covered here (needs Foundry globals, UI, or I/O)

These modules are **intentionally excluded** from Node unit tests until logic is extracted or **Quench** (in-Foundry) tests exist:

- **`module/logic/`** — `spell-sr-from-chat`, `spell-save-from-chat`, `concentration-from-chat`, `character-system-source-backfill` (`foundry.utils`), `apply-damage-healing` / `apply-damage-healing-entry-points`, `auto-granted-feats`, `domain-spells`, `compendium-loader`, `audit-log`, `class-spell-list` (async `game` / packs), `derived-conditions` (`sync*` / `isFlatFootedFromCombat` — use `game.combat`), `condition-helpers` (`getConditionItemsMap*`).
- **`module/data/_ac-helpers.mjs`** — Uses `CONFIG.THIRDERA.sizeModifiers` and `system.parent.items` (Foundry-shaped graph); test after injecting `CONFIG` or extracting pure pieces.
- **`module/documents/`**, **`module/sheets/`**, **`module/applications/`**, **`thirdera.mjs`** — Document/sheet/UI layer; future Quench or E2E.
- **`module/data/*`** (TypeDataModels) — Depend on `foundry.data.fields` at import time.

When you change a **covered** module, add or update tests in the matching `test/unit/**` file. Policy: [`.cursor/rules/automated-tests-for-logic.mdc`](../.cursor/rules/automated-tests-for-logic.mdc).

## Commands

| Command | Purpose |
|---------|---------|
| `make test` | Same as `npm test` — run all tests once (fast; no coverage). |
| `make test-coverage` | Same as `npm run test:coverage` — **v8** coverage, **minimum thresholds** (see `coverage.thresholds` in [`vitest.config.mjs`](../vitest.config.mjs)); writes **`coverage/`** (HTML: `coverage/index.html`, LCOV: `coverage/lcov.info`). Fails if coverage is below the configured floors. **Validate** CI uses this target. |
| `npm test` / `npm run test:coverage` | Direct npm invocations; equivalent to the `make` targets above. |
| `npm run test:watch` | Re-run tests on change (local only). |

Coverage **includes** `module/logic/**`, `module/utils/**`, and `module/data/_*.mjs`, but **excludes** modules we do not intend to cover in Node (Foundry chat hooks, packs, audit log, `_ac-helpers`, etc.) — see `coverage.exclude` in [`vitest.config.mjs`](../vitest.config.mjs). **`coverage.thresholds`** enforces minimum **lines**, **statements**, **branches**, and **functions** over that scoped set (CI and local **`make test-coverage`**). The headline percentage reflects **unit-test-in-scope** files; open the HTML report for per-file detail. When you add Vitest coverage for a previously excluded file, remove its path from `coverage.exclude`.

**CI:** **Validate** runs **`unit-tests`** (**`make test`**) and a separate **`coverage`** job (**`make test-coverage`**, thresholds + artifact **`coverage-report`**). Also **`lint`** (placeholder), **`static-validation`** (JSON, JS syntax, templates).
