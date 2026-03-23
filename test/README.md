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
| `module/logic/feat-prerequisites.mjs` (`actorHasFeatByUuid` only) | `unit/logic/feat-prerequisites.test.mjs` |
| `module/logic/condition-helpers.mjs` (`getActiveConditionModifiers` only) | `unit/logic/condition-helpers.test.mjs` |
| `module/logic/derived-conditions.mjs` (`getDerivedHpConditionId`, `getDerivedFrom` only) | `unit/logic/derived-conditions.test.mjs` |
| `module/utils/fuzzy.mjs` | `unit/utils/fuzzy.test.mjs` |
| `module/data/_damage-helpers.mjs` | `unit/data/damage-helpers.test.mjs` |
| `module/data/_encumbrance-helpers.mjs` | `unit/data/encumbrance-helpers.test.mjs` |

### Not covered here (needs Foundry globals, UI, or I/O)

These modules are **intentionally excluded** from Node unit tests until logic is extracted or **Quench** (in-Foundry) tests exist:

- **`module/logic/`** — `spell-sr-from-chat`, `spell-save-from-chat`, `concentration-from-chat`, `character-system-source-backfill` (`foundry.utils`), `modifier-aggregation`, `rest-healing`, `apply-damage-healing` / `apply-damage-healing-entry-points`, `auto-granted-feats`, `domain-spells`, `compendium-loader`, `audit-log`, `class-spell-list` (async `game` / packs), `derived-conditions` (`sync*` / `isFlatFootedFromCombat` — use `game.combat`), `condition-helpers` (`getConditionItemsMap*`), `feat-prerequisites` (`meetsFeatPrerequisites` — `foundry.utils`, `game.i18n`, `CONFIG`).
- **`module/data/_ac-helpers.mjs`** — Uses `CONFIG.THIRDERA.sizeModifiers` and `system.parent.items` (Foundry-shaped graph); test after injecting `CONFIG` or extracting pure pieces.
- **`module/documents/`**, **`module/sheets/`**, **`module/applications/`**, **`thirdera.mjs`** — Document/sheet/UI layer; future Quench or E2E.
- **`module/data/*`** (TypeDataModels) — Depend on `foundry.data.fields` at import time.

When you change a **covered** module, add or update tests in the matching `test/unit/**` file. Policy: [`.cursor/rules/automated-tests-for-logic.mdc`](../.cursor/rules/automated-tests-for-logic.mdc).

## Commands

Same as CI: from repo root, `npm ci` then `npm test`, or `npm run test:watch` locally.
