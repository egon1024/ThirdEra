# Development reference

This page is the single reference for **[contributors](contributing.md)** working in this repository: project overview, architecture, conventions, and operational notes. If you are **extending** the system (adding compendiums, modules, or new content) rather than changing core code, see **[Extending](extending.md)** first.

## Project Overview

ThirdEra is a **Foundry VTT game system** implementing D&D 3.5 Edition using the System Reference Document (SRD). It targets **Foundry VTT v13** and uses the **ApplicationV2 / HandlebarsApplicationMixin** sheet framework (not the legacy Application v1). **Only SRD content is intended to be implemented - no proprietary data outside the SRD.** The system is designed so that third-party compendiums or modules can extend it.

There is no build step, bundler, or package manager **for the system at runtime**. The system is plain ES modules + CSS + Handlebars templates, loaded directly by Foundry VTT at runtime.

**Automated unit tests** use a **dev-only** toolchain ([`package.json`](../package.json) + **Vitest**) for logic that can run in Node. Tests live under `test/` and **complement** in-world checks (F5 reload, optional scenarios under gitignored `docs/testing/` when present). Roadmap and planned work are summarized on **[Future plans](future-plans.md)**.

### Published documentation (docs-site) and feature state

The **docs-site** (this MkDocs tree: `development.md`, `extending.md`, `usage/*`, `compendium-guide.md`, etc.) is the **published** description of how the system behaves **in releases**. It should stay **honest about what is implemented vs what is only planned or manual**:

- Prefer explicit phrases such as **“supported today”**, **“not in core yet”**, or **“planned”** wherever a feature is partial (CGS categories, type-based rules, vision, and similar).
- **Contributors:** When a PR changes user-visible or macro-facing behavior, update the relevant docs-site page(s) in the **same** change or an immediately following PR so the site does not lag the code.
- **QA / manual test steps** belong in maintainer notes or gitignored testing docs, **not** in docs-site (see project conventions); behavior descriptions and limitations **do** belong here.

## Development Setup

- Symlink or copy this repository into Foundry VTT `Data/systems/` as `thirdera/`. Foundry resolves paths relative to `systems/thirdera/` (e.g. template paths use `"systems/thirdera/templates/..."`).
- **In-game verification:** Reload the Foundry VTT world in-browser (F5 or "Reload" in developer tools) when changing behavior the unit suite does not cover.

## Automated unit tests

**Prerequisites:** [Node.js](https://nodejs.org/) **v20+** on your PATH (same major version as [`.github/workflows/validate.yml`](../.github/workflows/validate.yml)). You do **not** need Foundry running to execute unit tests.

**First-time setup (same as CI):** From the repository root:

1. `npm ci` — installs exact versions from `package-lock.json` (use `npm install` instead if you are not using a lockfile-driven workflow locally, but CI always uses `npm ci`).
2. **`make test`** or **`npm test`** — runs **Vitest** once and exits; must pass before considering related work done.
3. **`make lint`** or **`npm run lint`** — runs **ESLint** on `test/**/*.mjs`, `module/**/*.mjs`, `thirdera.mjs`, and `vitest.config.mjs` ([`eslint.config.js`](../eslint.config.js); **`package.json`** `lint` passes the same globs so CI matches local); same scope as the **Validate** workflow **`lint`** job.

**`scripts/`:** The repo’s **`scripts/`** directory (maintenance scripts, migrations, generators) is **not** in the Vitest tree and is **not** included in ESLint — **by design, not planned** for CI. Validate changes there manually (see **docs-site/compendium-guide.md** for script-oriented workflows).

**Day-to-day:** After dependencies are installed, **`make test`** or **`npm test`** is enough for quick iteration. Use `npm run test:watch` for interactive re-runs while editing (not used in CI). Before finishing work that touches scoped backend logic, also run **`make test-coverage`** so **minimum coverage** (see below) is satisfied—the same command CI runs. After editing tests, system JavaScript under `module/`, `thirdera.mjs`, or `vitest.config.mjs`, run **`make lint`** (or `npm run lint`) before pushing.

**Coverage (same as CI for PRs on scoped files):**

- Run **`make test-coverage`** or **`npm run test:coverage`** — full suite with the **v8** coverage provider, **minimum thresholds** enforced by Vitest (see [`vitest.config.mjs`](../vitest.config.mjs) `coverage.thresholds`; currently **66%** for lines, statements, branches, and functions over the included paths). Writes reports under **`coverage/`** (gitignored); the command **fails** if coverage drops below those floors.
- **HTML report:** open **`coverage/index.html`** in a browser for per-file line coverage. **`coverage/lcov.info`** is suitable for external tools (e.g. IDE extensions, Codecov).
- Coverage is **scoped** in [`vitest.config.mjs`](../vitest.config.mjs) to `module/logic/**`, `module/utils/**`, and `module/data/_*.mjs`, with **`coverage.exclude`** omitting Foundry-only logic (chat hooks, packs, audit log, `_ac-helpers`, etc.) so the **headline percentage** reflects files we aim to cover in Node. Use the HTML report for per-file detail. **Raise thresholds** in that file when sustained coverage improves and the team wants a tighter gate.
- **Pull requests:** the **Validate** workflow runs parallel jobs: **`unit-tests`** (**`make test`**, Vitest only), **`coverage`** (**`make test-coverage`**, thresholds + artifact **`coverage-report`**), **`lint`** (**`npm run lint`**, ESLint on the paths listed above), **`static-validation`** (JSON / syntax / templates). Download the HTML/LCOV bundle from the **`coverage`** job’s **Artifacts** on GitHub. The suite runs twice in CI (once per job); that keeps a fast test gate separate from the slower coverage run.

**Layout:** Tests live under `test/unit/`, grouped to mirror code: `test/unit/logic/` → `module/logic/`, `test/unit/utils/` → `module/utils/`, `test/unit/data/` → `module/data/` helpers. Use the `*.test.mjs` (or `*.spec.mjs`) suffix. **`test/README.md`** lists **which production files are covered** and **which are intentionally out of scope** for Node (Foundry-only). The system’s `esmodules` entry is unchanged; `node_modules/` is dev-only and gitignored.

**Policy:** Changes to behavioral logic under `module/logic/`, `module/utils/`, and pure `module/data/*_helpers.mjs` should include new or updated tests where practical, **`make test`** must pass, **`make test-coverage`** must pass **including coverage thresholds**, and **`make lint`** must pass (see **`test/README.md`** at the repository root for scope and exceptions). **`make lint`** covers the paths in step 3; clear reported issues when you touch those files, and use dedicated PRs for broad ESLint cleanup when the backlog is large. Pull request validation uses the **Validate** workflow: **`unit-tests`** (`npm ci` + **`make test`**), **`coverage`** (`npm ci` + **`make test-coverage`**), **`lint`** (`npm ci` + **`npm run lint`**), and **`static-validation`** (JSON, `node --check` on `.mjs`, template paths).

## Architecture

### Entry Point

`thirdera.mjs` - Registers all data models, document classes, sheet classes, Handlebars helpers, and partials in `Hooks.once("init")`. Also registers sidebar delete button hooks. Global config: `CONFIG.THIRDERA`.

The `Hooks.once("ready")` path is tuned to keep the browser responsive on large worlds and packs: compendium index/img fix-up rebuilds directory trees in small batches with main-thread yields between chunks; condition status metadata and the domain-spell compendium cache load in parallel; GM compendium JSON import yields between packs; Phase 6 NPC sense migration and HP-derived condition sync use bounded parallelism where safe. For timing breakdowns when debugging slow reloads, enable the **client** setting **Log client bootstrap timing (debug)** under **Configure Settings → Third Era** (console output only).

### Data Models (`module/data/`)

Each file defines a `TypeDataModel` subclass with static `defineSchema()` using Foundry field classes (`NumberField`, `StringField`, `SchemaField`, `HTMLField`, etc.).

- **Actor types**: `CharacterData` (actor-character.mjs), `NPCData` (actor-npc.mjs). **`CharacterData.migrateData`**, **`backfillCharacterSystemSourceForActor`**, and **`backfillCharacterSystemChangeObject`** (`module/logic/character-system-source-backfill.mjs`) backfill missing `system.details` / `system.experience` keys on load, on the live `system` source (`ThirdEraActor._preUpdate` / `ThirdEraItem` when parent is a PC), and on **`changes.system`** in `ThirdEraActor._preUpdate` (including when the delta omits `details` / `experience` but `changed.items` is absent — spell updates often send `system` only). **`details.naturalHealingBonus`**, **`details.spellResistance`**, and **`experience.value` / `experience.max`** use **`required: false`** so partial actor/system merges do not hard-fail validation; **`prepareDerivedData`** coerces nullish values to defaults. Embedded **Item** updates may still use **`changes.items`** without `system`; when that happens, `ThirdEraActor._preUpdate` can inject a minimal `changes.system`. **Spell resistance (numeric):** PCs store `system.details.spellResistance` (integer ≥ 0, default 0; character sheet **Attributes → Details**); NPCs use `system.statBlock.spellResistance`.
- **Item types**: `WeaponData`, `ArmorData`, `EquipmentData`, `SpellData`, `FeatData`, `SkillData`, `RaceData`, `ClassData`, `FeatureData`

Derived data (ability modifiers, save totals, grapple, initiative) is calculated in `prepareDerivedData()` on the data models, not on document classes.

### Document Classes (`module/documents/`)

- **ThirdEraActor** (actor.mjs) - Extends `Actor`. Roll methods: `rollAbilityCheck`, `rollSavingThrow`, `rollSkillCheck`, `rollConcentrationCheck`, `rollSpellPenetration`. **Initiative** uses Foundry’s inherited `Actor.rollInitiative` (no override) so combatants and chat messages stay in sync with the combat tracker. Delegates to type-specific `_prepareCharacterData` / `_prepareNPCData`.
- **ThirdEraItem** (item.mjs) - Extends `Item`. `rollAttack` / `rollDamage` for weapons. Skill totals in `_prepareSkillData` when the item is owned by an actor.

### Sheet Classes (`module/sheets/`)

Both use **ApplicationV2**: `HandlebarsApplicationMixin(ActorSheetV2)` / `HandlebarsApplicationMixin(ItemSheetV2)`.

- **ThirdEraActorSheet** (actor-sheet.mjs) - Single PARTS entry; template swapped in `_configureRenderParts()` by actor type (character vs npc). Actions: static private methods in `DEFAULT_OPTIONS.actions`. **Unlinked tokens:** the sheet document is a synthetic actor (ActorDelta). Character **Attributes → Details** fields (size, natural healing bonus, spell resistance, current XP) are mirrored to the world `Actor` on submit and removed from the synthetic update so the same PC opened from the Actors sidebar stays in sync (same pattern as dropping a condition onto a token sheet targeting the world actor).
- **ThirdEraItemSheet** (item-sheet.mjs) - Template per item type (`item-${type}-sheet.hbs`). `submitOnChange: true` for auto-saving. **Compendium / pack items:** the sheet’s `document` may not be the same object reference as `game.packs.get(pack).get(id)`; after updating the pack-cached instance, resync the sheet’s copy with `Document#updateSource` so nested `system` TypeDataModels match (helpers in `module/logic/cgs-stale-item-sheet-sync.mjs`).

Tab switching is manual via a `changeTab` action (not Foundry's built-in tab system).

### Templates (`templates/`)

- **Actor**: `templates/actor/character-sheet.hbs`, `npc-sheet.hbs`
- **Item**: One per type (`item-weapon-sheet.hbs`, `item-armor-sheet.hbs`, etc.), plus `item-feature-sheet.hbs`
- **Partials**: `templates/partials/editor-box.hbs` (ProseMirror display/edit toggle). See `templates/partials/README.md`.

Context comes from `_prepareContext()`; item lists are pre-sorted in the sheet's `_prepareItems()`. For **NPC** actors, embedded **skills** in sheet context are **de-duplicated by skill identity** (`npc-embedded-skill-identity.mjs`: same `system.key` for most skills; `profession` uses key + name). `ThirdEraActor.createEmbeddedDocuments` also **drops duplicate skill payloads** so imports/drops cannot stack identical rows.

### Handlebars Helpers

Registered in `thirdera.mjs:registerHandlebarsHelpers()`: `abilityMod(score)`, `signedNumber(num)`, `eq(a, b)`, `concat(...args)`.

### Styles

`styles/thirdera.css` - All selectors under `.thirdera`. ProseMirror: `.active`/`.inactive` for edit/display; `--editor-min-height` custom property.

**Design tokens** (on `.thirdera`): Use **only** these - no new hardcoded colors or font sizes.

- **Colors**: `--color-*` (text, backgrounds, theme accents, hover, status, borders)
- **Typography**: `--font-family`, `--font-size-*` scale (note, label, body, value, value-lg, value-xl, heading)

### Localization

`lang/en.json` - `THIRDERA.*` namespace; also `TYPES.Item.*` and `TYPES.Actor.*` for Foundry type labels.

## Reference Resources

- **Extenders:** **[Extending](extending.md)** (this site) - Adding compendiums or new content; data-driven design and reference rules.
- **Foundry VTT source:** `~/foundryvtt/` - For base classes, hooks, API. Consult its own docs as needed.
- **Online:** D&D 3.5 SRD - https://www.d20srd.org/index.htm | Foundry API - https://foundryvtt.com/api/

## Key Conventions

- **Item references:** Use **document ID or UUID** for references and membership checks, not name or key. See [Item references](#item-references) below.
- **Config:** `CONFIG.THIRDERA` uses mixed casing; sheets remap to camelCase in `_prepareContext()` for templates (e.g. `config.abilityScores`).
- **Sizes:** Actors, weapons, armor use `choices: () => CONFIG.THIRDERA.sizes` (9 SRD size categories).
- **Token footprint vs size:** On actor **create**, if the prototype token is still Foundry’s default **1×1**, width/height are set from **`system.details.size`** (3.5 space on a 5 ft grid; Fine–Tiny use fractional squares). On **size change**, the prototype is updated only when its current width/height still match the auto footprint for the **previous** size (manual dimensions are preserved). **Linked** scene tokens are resized to the new footprint on size change (**GM client**). Existing actors are not batch-migrated. Pure rules: `module/logic/token-dimensions-from-size.mjs`; Foundry handlers + registration: `module/logic/token-dimensions-from-size-hooks.mjs` (`registerTokenDimensionHooks` from `thirdera.mjs` on init).
- **Booleans on items:** Store as **StringField** `"true"` / `"false"`, not BooleanField.
- **Sheets:** `form: { submitOnChange: true }` in `DEFAULT_OPTIONS`; actions via `data-action` and `DEFAULT_OPTIONS.actions`; item actions use `target.closest("[data-item-id]")?.dataset.itemId`.
- **Value breakdown:** Show base + each modifier (labeled) + total; provide a **visual indicator** when a value is modified (e.g. armor capping Dex).
- **Extensibility:** Races, classes, etc. are **Item types**, not hardcoded config.
- **Rich text:** `<prose-mirror>` (Foundry v13); styling with `.active`/`.inactive`. Exception: npc-sheet biography still uses legacy `{{editor}}`. `toggled` is read-once config; `open` and `.active`/`.inactive` control state.
- **Checkboxes:** Never style as text inputs (no background/border/full-width). Use transparent background, no border, `accent-color` for theme.
- **Release upgrades:** Every branch intended to become a release must include a migration path from the previous release version. See [Release migrations](#release-migrations) below.

### Item references

All references between items (and any membership or “do you have this?” checks) must use **document identity** — ID or UUID — not name, key, or other string labels.

- **Reference storage:** When one item references another (e.g. required feat, class that grants this, spell school), store the **document UUID** (or, for same-world-only references, the document **id**). Do not store the referenced item’s name or a “key” for lookup or membership checks.
- **Membership / “has this” checks:** When checking whether an actor (or another item) “has” or “includes” a given item (e.g. “does the character have the Dodge feat?”), resolve by **document identity**: compare by document UUID, document id, or by a stored source/origin that is itself an ID or UUID (e.g. compendium sourceId). Do not determine membership by matching name or key strings.
- **Display:** Names and keys remain fine for **display** (e.g. showing “Dodge” in the UI). The constraint is on **storage and logic**: what we store and how we resolve “is this the same item?” must be ID/UUID-based.

**Rationale:** Names and keys can change or collide; IDs and UUIDs are stable and unique. Compendium documents are identified by UUID; world documents have id (and uuid). Using ID/UUID keeps world and compendium references consistent and avoids ambiguity when the same “logical” item exists in multiple packs or the world.

**Examples:**

- **Feat prerequisites “required feats”:** Store an array of **feat document UUIDs** (e.g. `prerequisiteFeatUuids: ["Compendium.thirdera.thirdera_feats.Item.abc123", …]`). To check “actor has this feat”, resolve each UUID to a document and determine whether the actor has an item that is or derives from that document (e.g. by sourceId, origin, or same document id when applicable).
- **Class feature “feat item”:** Store the **feat document’s id or UUID** (e.g. `featItemId` or `featItemUuid`), not the feat name. Lookup and membership by that id/UUID.
- **Spell’s school:** Reference the school **item’s id/UUID** if the system models schools as items; otherwise a stable identifier that is not the display name.

**Exception:** Where the codebase explicitly uses a **stable key** (e.g. `system.key`) for compendium **name-based matching** (e.g. loader “match by key when name collides”), that remains a separate concern. The key is still not used as the **canonical reference** between items for “which feat is required” or “does the actor have this?” — those use ID/UUID. Keys may be used to *resolve* “which document is Dodge?” when building UUID references (e.g. in migration or authoring), but the stored reference is the document’s id/UUID.

### Release migrations

Every meaningful change must consider **upgrade from the previous release version**. Migration work is part of development, not a post-release cleanup task.

- **Goal:** Users upgrading into the release built from the current branch should keep their data and reach a working state without manual repair.
- **When migration is required:** Any change that affects stored data, schema shapes, references, compendium-driven assumptions, derived-data expectations, or sheet/workflow behavior must be evaluated for upgrade impact.
- **Branch-wide view:** Do not design migrations one ticket at a time in isolation. Consider the **combined effect of all changes in the current branch** so the resulting migration path accounts for ordering, compatibility between related changes, and idempotence.
- **Expected outcome per task:** Either add/update migration logic and validation steps, or explicitly document why no migration is needed.
- **Preferred migration behavior:** Preserve user data in place, repair outdated structures safely, and avoid one-off manual cleanup unless there is no safer alternative.

### Modifier system (`module/logic/modifier-aggregation.mjs`)

A **unified modifier pipeline** aggregates contributions from conditions, feats, race, equipped items, and future sources into one **modifier bag** per actor. Extensions, magic-item categories, and sequencing for non-numeric traits are summarized on **[Future plans](future-plans.md#generalized-modifier-system-and-magic-items)**.

- **Canonical keys:** `CONFIG.THIRDERA.modifierKeys` lists allowed keys (e.g. `ac`, `acLoseDex`, `speedMultiplier`, `saveFort`/`saveRef`/`saveWill`, `attack`/`attackMelee`/`attackRanged`, `naturalHealingPerDay`, **`initiative`**, `ability.str` … `ability.cha`, `skill.<skillKey>`). Only these keys are applied. The **`initiative`** total is summed with Dexterity modifier into `attributes.initiative.bonus` (used by the system initiative formula in `system.json`). The **`naturalHealingPerDay`** total is added to character level and to `actor.system.details.naturalHealingBonus` when computing daily natural healing in the **Take rest** flow (`getRestHealingAmount` in `module/logic/rest-healing.mjs`).
- **Ability and skill keys:** Condition items (and later feats/equipped items) can use `ability.str`, `ability.dex`, etc. and `skill.<skillKey>` (e.g. `skill.hide`) in their `changes` array. The aggregator outputs per-key totals and breakdowns; character `prepareDerivedData` applies ability deltas to each ability’s **effective** (with breakdown), then recomputes **mod** before any other step uses ability mod. Skill modifiers from the bag are applied in the skill loop; modifier-only skills (no ranks) appear in an "Other skill modifiers" block with roll.
- **NPC skills:** NPCs use the same GMS integration for skills: **`prepareNpcSkillItems`** in [`module/logic/npc-skill-prep.mjs`](../module/logic/npc-skill-prep.mjs) runs in `NPCData.prepareDerivedData` (after max Dex / load) and sets each embedded **`skill`** item’s **`modifier.total`** to ability + ranks + misc + armor/load ACP + **`skill.<key>`** from `getActiveModifiers`. There is **no** skill point budget or max rank enforcement on NPCs. Per-skill **class vs cross-class** on NPCs is controlled by **`system.npcClassSkill`** on the skill item ([`module/data/item-skill.mjs`](../module/data/item-skill.mjs), default **true** when embedded on an NPC); **`prepareNpcSkillItems`** maps that to derived **`isClassSkill`** for row styling only (PC class rules are unchanged). **`buildModifierOnlySkills`** fills **`modifierOnlySkills`** for modifier-only rows and **`rollSkillCheckByKey`** (same as characters). The NPC sheet **Attributes → Skills** subtab lists embedded skills (with a class-skill checkbox), an **Add skill** dropdown (world + all Item compendia via **`getNpcSkillAddOptions`** in [`module/applications/skill-picker-dialog.mjs`](../module/applications/skill-picker-dialog.mjs)), and modifier-only entries. **`modifier.miscLabel`** on a skill item (optional) replaces the generic **Misc** line in the skill total tooltip; character and NPC sheets expose **misc** and **misc label** inline next to ranks, and the owned skill item sheet has the same fields.
- **Provider contract:** A **modifier-source provider** is a function `(actor) => Array<{ label: string, changes: Array<{ key: string, value: number, label?: string }> }>`. The aggregator runs all functions in `CONFIG.THIRDERA.modifierSourceProviders` and merges results.
- **Usage:** Call `getActiveModifiers(actor)` once early in character or NPC `prepareDerivedData` (after base ability values); apply ability deltas and set mod; then use the same modifier bag for AC, speed, saves, attack, initiative, and skills. Race contributes like feats: the actor’s race item uses optional `system.changes` (canonical keys), merged by the built-in item modifier provider when the race is owned.

**Extending the modifier system:** You can add new modifier sources in two ways.

1. **Register a provider function.** Push a function to `CONFIG.THIRDERA.modifierSourceProviders`. Each provider has signature `(actor) => Array<{ label: string, changes: Array<{ key: string, value: number, label?: string }> }>`. The aggregator runs all providers and merges contributions; only keys in the canonical set (see `CONFIG.THIRDERA.modifierKeys`) are applied. Example: a module that adds temporary spell effects could register a provider that returns one contribution per active spell with a `changes` array.
2. **Item method `getModifierChanges(actor)`.** On any item type, implement `getModifierChanges(actor)` returning `{ applies: boolean, changes: Array<{ key: string, value: number, label?: string }> }`. The built-in item provider in the registry iterates `actor.items` and, when this method exists, calls it; when `applies === true`, it merges the returned `changes` with `label = item.name`. No change to the aggregator is required. *(Note: the stock `itemsModifierProvider` today reads `system.changes` directly for feat, race, and gear items; `getModifierChanges` is the documented extension hook for custom item types.)* Items can use optional `system.changes` (same shape) and rely on the default item provider’s type-specific “applies” rules (feat and race: always when owned; armor, equipment, weapon: when equipped/wielded by default). **Gear apply scope (Phase 5g):** armor, equipment, and weapon items may set `system.mechanicalApplyScope` to `equipped` (default) or `carried`. The same predicate gates GMS numeric modifiers and embedded-item CGS grants (`module/logic/item-gear-mechanical-apply.mjs`, `embeddedGearMechanicalEffectsApply`).

### Capability grants (structured effects, parallel to the modifier system)

**In-world and sheet naming:** Character and item sheets use the label **Capability grants** for structured contributions that are **not** numeric modifier rows (e.g. senses and vision lines, condition-driven suppression, spell-like grants, **extra creature types and subtypes** for shapechanging and template-style effects). Internally the codebase may still refer to the **Capability Grant System (CGS)** in logic modules and maintainer docs; contributors should keep **numeric** bonuses in **Mechanical effects** (`system.changes`) and structured non-numeric effects in **`system.cgsGrants`** where applicable.

#### CGS — supported in core today

The engine merges grants from items, conditions, race, class features, actor-level CGS mechanics, and (for NPCs) stat-block inputs where applicable; **refresh** propagates when sources change. **Today this includes:**

- **Senses:** Stage A union merge plus **Stage B** effective senses after **`senseSuppression`** (e.g. blindness); **Sources** / provenance on the sheet; legacy NPC stat-block sense migration into **`system.cgsGrants.senses`** (including stock monster pack shape).
- **Spell and SLA grants:** Merged **`spellGrant`** rows, **Granted spells** / **Ready to cast** integration, grant-channel cast tracking (**`cgsSpellGrantCasts`**), rest resets.
- **Typed defenses:** Merged **immunities**, **energy resistance**, **damage reduction** with provenance; CONFIG-backed labels for core SRD vocabulary, augmented by optional world items of type **`defenseCatalog`** (**Custom defense labels** in the UI) whose **`catalogKey`** (must match the corresponding text in capability grants) and **`catalogKind`** override or extend display labels (see **`game.thirdera.refreshTypedDefenseCatalogCache`** after **`ready`**). Those items only supply **display names** (they do not store resistance amounts or DR values; those stay on grants). **`catalogKind`** can be **energy resistance (type label)** or **energy type** interchangeably for the shared energy-type label map. On create, a blank **`catalogKey`** is filled from the item **name** (camelCase heuristic); authors can edit **`catalogKey`** on the sheet when it must differ from the display name.
- **Creature type / subtype overlays:** Authoring on items and actors; merged readout with provenance; **v1 semantics** are **additive** (primary **Details** type/subtypes **∪** overlay UUIDs). **`getEffectiveCreatureTypes(actor.system)`** in `module/logic/cgs-effective-creature-types.mjs` is the single supported resolver for that union; **`effectiveCreatureTypesIncludeUuid`** / **`effectiveCreatureTypesIncludeAnyUuid`** match stored reference UUIDs against the same union. **`game.thirdera.effectiveCreatureTypes`** (after **`ready`**) exposes **`get`**, **`getFromActor`**, **`includesUuid`**, **`includesAnyUuid`**, **`getDisplayText`**, **`notify`**, **`notifyForSelectedTokens`** for macros and auditing. GMs: world **Actors** sidebar → right-click → **Show effective creature types (mechanical)**; or select token(s) on the canvas and call **`game.thirdera.effectiveCreatureTypes.notifyForSelectedTokens()`** from a macro.
- **Gear:** **`system.mechanicalApplyScope`** (**equipped** vs **carried**) gates both GMS **`system.changes`** and embedded-item CGS on armor, equipment, and weapons (`module/logic/item-gear-mechanical-apply.mjs`). Optional **`system.mechanicalCreatureGateUuids`:** when non-empty, that gear’s mechanical effects apply only if the owner’s **`getEffectiveCreatureTypes`** matches at least one listed type/subtype document UUID (convergent fixed-point when multiple gated pieces interact; `module/logic/cgs-embedded-item-grants-provider.mjs`).
- **Spell creature type targeting:** Spells can optionally set **`system.targetCreatureTypeUuids`** (an array of creature type/subtype document UUIDs) to restrict valid targets by creature type. When casting, **`castSpell`** validates each target’s effective creature types and warns the GM if a target does not match (cast is not blocked). Chat messages show a creature type restriction line. Pure logic: `module/logic/spell-creature-type-targeting.mjs`. Spell sheet: **Target creature types** section on Details tab (dropdown or drag-drop creature type/subtype items).

#### CGS — not in core yet (planned, deferred, or GM/manual only)

These areas may have **data and UI** in ThirdEra but **no** built-in automation, or are explicitly **out of scope** for the current v1 overlay design:

- **Type-based mechanics (deferred):** Turning/rebuking, favored enemy, smite-style riders keyed to type, and similar **rules** are **not** implemented as automated core resolution—authors and GMs apply the rules at the table. **Gear** may use **`mechanicalCreatureGateUuids`** so modifiers and CGS from that item apply only when **`getEffectiveCreatureTypes`** matches. When further features are added to core, they must use **`getEffectiveCreatureTypes`** (not **Details** alone).
- **CGS grant activation gates (future):** No built-in rules yet for **turning individual grants off** based on actor-wide state such as **encumbrance load** (e.g. heavy load) or **equipped inventory patterns** (e.g. unarmed-only class features, “works only in light armor,” requires worn armor). That is separate from **`system.mechanicalApplyScope`** on armor/equipment/weapons (equipped vs carried) and from **`mechanicalCreatureGateUuids`** on gear. If added, it should align with CGS provenance (show suppressed grants with a reason rather than silent omission). See [Future plans](future-plans.md).
- **Token / canvas vision** driven from **effective** CGS senses: **not** implemented; map sight does not follow merged/suppressed senses yet.
- **Polymorph / “form replacement”:** Overlays do **not** replace primary type for all purposes; **per-purpose** or full replacement semantics are **future** design (maintainer **`cgs-implementation.md` §5.1**).
- **Defense label packs:** World **`defenseCatalog`** items (and an optional future pack **`thirdera.thirdera_defense_catalog`**) augment CONFIG label maps; there is no requirement to ship a core compendium for SRD labels.

When any item above moves from “not yet” to “supported,” **update this subsection and any linked usage pages in the same effort.**

- **Actors:** The **Senses** block is the merged, effective readout (with **Sources** for provenance). **Sense grants** on the sheet is where actor-level sense rows are edited (`system.cgsGrants.senses`); optional **type overlays** are edited nearby (`system.cgsGrants.creatureTypeOverlayUuids` / `subtypeOverlayUuids` — references to **Creature Type** and **Subtype** documents, additive on top of an NPC’s base type on **Details**). Merged overlays appear under **Additional creature types (active)** with provenance. **NPC / monster upgrade (Phase 6):** Stock **Monsters** compendium JSON stores mechanical senses under **`system.cgsGrants.senses`** (legacy **`system.statBlock.senses`** is merged out in pack data). When you open a world as GM, any NPC that still has legacy stat-block sense rows gets an **idempotent** migration: those rows are merged into **`system.cgsGrants.senses`** (deduped) and **`system.statBlock.senses`** is cleared, matching what **`NPCData.migrateData`** already does on load. Suppressed senses (e.g. blindness) appear under **Suppressed senses** with **Suppressing** sources.
- **Spell grants:** In `system.cgsGrants.grants`, entries with `{ "category": "spellGrant", "spellUuid": "<full item UUID>" }` (or **`spellKey`** matching the spell’s **`system.key`** in pack JSON, resolved at compendium load) merge into derived **`system.cgs.spellGrants.rows`** (deduped by UUID, with provenance). Optional fields include **`usesPerDay`**, **`atWill`**, **`casterLevel`**, **`classItemId`** (which spellcasting class treats the spell as **Ready to cast** when ambiguous), and **`label`**. The grant’s `spellUuid` should resolve to a spell document; the character should normally have an **embedded** spell item **linked** to that UUID (via `uuid`, `sourceId`, **flags.core.sourceId**, or **flags.thirdera.sourceSpellUuid** set when using the actor’s **add spell** helpers). The **Granted spells** list offers **Add spell to character** when no embedded match is found—preparation/cast tracking needs that item. On the Spells tab **Known / Available**, **Granted spells** lists **all** merged spell grants (even when the same spell also appears under a class list) so the player can see the **capability grant** channel and cast from it explicitly. **Add to Ready** / shortlist applies to **full-list prepared** casters; **Learned** (or otherwise non–full-list) **non-spontaneous** casters get the same **Prepared** count field as on class Known rows; the sheet also shows that control if **Preparation type** was left at **None** but the list is not the full-list style—prefer setting **Preparation type** to **Prepared** on the class item when the class prepares spells. **Ready to cast** merges capability-granted spells by class routing when they are readied (shortlist, **prepared** count, or spontaneous rules). A **Cast** button appears when a spellcasting class can be resolved. **SLA-style** grants (**at-will** or **uses/day**): the **Granted spells** row uses **`actor.system.cgsSpellGrantCasts`** (keyed by merged grant `spellUuid`) for daily use counts, separate from the embedded spell’s **`system.cast`** and from class slots; casting from that row passes **`viaCgsGrant: true`** into **`castSpell`**. Grants without those flags use normal spontaneous/prepared rules when cast from the grant row’s standard **Cast** control. **Take rest** / **Reset cast counts** clear both embedded spell cast totals and **`cgsSpellGrantCasts`** when the user resets casts.
- **Items:** Race, feat, class feature, armor, weapon, and equipment sheets group structured effects under **Capability grants** with subsection headings: **Senses** (`system.cgsGrants.senses`), **Spell and SLA grants** for `spellGrant` entries in `system.cgsGrants.grants`, **typed defenses** (`immunity`, `energyResistance`, `damageReduction`), and **extra creature types and subtypes** (`creatureTypeOverlay` / `subtypeOverlay` referencing **Creature Type** or **Subtype** documents — drag from the sidebar or pick from the list; use compendium or world entries so the grant resolves to a real definition). Feats apply while owned; armor, equipment, and weapons apply when equipped or wielded by default, or when **carried** if `system.mechanicalApplyScope` is set to `carried` (same rule as GMS `system.changes` on that item). When `grants` is non-empty, it remains authoritative alongside the simple sense list (maintainer plans). Conditions use **`system.cgsGrants.grants`** for structured effects such as sense suppression.
- **Further detail:** See **[Compendium guide](compendium-guide.md)** for pack-level notes (e.g. races) and **Capability grants (CGS) in pack JSON** (authoring keys such as **`spellKey`**, **`targetCreatureTypeKeys`**, **`mechanicalCreatureGateTypeKeys`**, resolved to compendium UUIDs on GM **ready**). Internal design: `.cursor/plans/cgs-implementation.md` / `cgs-phased-implementation.md` for merge rules and extension.

### Initiative and combat

- **`system.json`:** The `initiative` property is the roll formula string passed to Foundry’s combat pipeline (e.g. `Combatant.getInitiativeRoll`). Third Era sets it to **`1d20 + @attributes.initiative.bonus`**. `@` references resolve against **`actor.getRollData()`**, which returns the actor’s prepared **system** data, so the static bonus stays one source of truth with the sheet.
- **Derived bonus:** In character and NPC `prepareDerivedData`, **`attributes.initiative.bonus`** = Dexterity modifier + **`getActiveModifiers(actor).totals.initiative`** (GMS key **`initiative`** from feats, conditions, equipped items, etc.).
- **Document class:** Do **not** override **`rollInitiative`** on **ThirdEraActor** unless the implementation ends by delegating to **`super.rollInitiative(options)`** for the normal combat path; otherwise the combat tracker will not receive rolled totals.
- **Sheet:** **Roll initiative** on the character and NPC Combat tabs (`data-action="rollInitiativeCombat"`) calls **`await this.actor.rollInitiative({ createCombatants: true })`** (`module/sheets/actor-sheet.mjs`). Requires a viewed scene for combatant creation; notifications use **`THIRDERA.SheetCombat.*`** in `lang/en.json`.

### Rest and natural healing

- **Code:** `module/applications/take-rest-dialog.mjs` — `TakeRestDialog` (ApplicationV2 + HandlebarsApplicationMixin), opened from the character sheet (**Spells → Ready to cast → Take rest…**). Template: `templates/apps/take-rest-dialog.hbs`. Strings use `THIRDERA.Rest.*` in `lang/en.json`.
- **Apply path:** Optional `applyDamageOrHealing(..., "healing")` with amount from `getRestHealingAmount(actor)`; optional bulk `system.cast: 0` / `system.prepared: 0` on spell items; `ChatMessage.create` with actor as speaker; notifications on close; sheet re-render when provided.
- **Formula:** `getRestHealingAmount(actor)` = effective character level (from `details.totalLevel` or `details.level`, minimum 1) + `getActiveModifiers(actor).totals.naturalHealingPerDay` + non-negative integer `details.naturalHealingBonus`.
- **NPCs:** No Take rest control on the NPC sheet (characters only).

### Compendiums (`packs/` and `module/logic/compendium-loader.mjs`)

See **[Compendium guide](compendium-guide.md)** for the full guide.

- Declared in `system.json` with `ownership`. Pack names use **underscores** (e.g. `thirdera_races`) for V14.
- Content in LevelDB; JSON in `packs/` is imported by `CompendiumLoader`. Collection IDs: `{systemId}.{packName}`.
- Unlock before create/update. Remove invalid `_id`; use `Document.createDocuments()` / `updateDocuments()` with `{pack: pack.collection}`. Loader can update by name/key for content fixes.
- **Current:** Races (7), Classes (11), Skills (36), Feats (86), Armor (18), Weapons (59), Equipment (67), Spells (SRD 0–9), Schools, Conditions, Creature Types, Subtypes, Features, **Monsters (SRD NPC starter set)** — Actor pack `thirdera_monsters` (`packs/monsters/`); see [Compendium guide](compendium-guide.md) (Monster compendium section).

## Foundry VTT v13 - Critical Technical Notes

- **Module caching:** Foundry caches JS **server-side**. Browser refresh does not reload server modules. **Restart Foundry** after changing `.mjs` files if changes don't appear.
- **Capturing old values in hooks:** In `updateItem`/`updateActor` hooks the document is already updated. Capture old values in **preUpdate** (e.g. in a Map keyed by document id). Empty string is a valid captured value; don't use `document.system.field` as "old" in update hooks.
- **Data preparation order:** (1) Actor TypeDataModel `prepareBaseData`, (2) Actor `prepareBaseData`, (3) `prepareEmbeddedDocuments` (each item's full prepareData), (4) Actor TypeDataModel `prepareDerivedData`, (5) Actor `prepareDerivedData`. So embedded item `prepareDerivedData` runs **before** the actor's - put cross-cutting logic (e.g. class skill status, armor check penalty) in the **actor's** `prepareDerivedData`.
- **Item ownership:** Items on actors are **embedded copies**, not references. Deleting a sidebar item does not affect actor-owned copies.
- **Schema:** `defineSchema()` is lazily evaluated; safe to use `CONFIG.THIRDERA`; use `choices: () => CONFIG.THIRDERA.sizes` for dynamic choices.
- **Dialog API:** `Dialog.render(true)` is **not** a Promise. Attach handlers after render (e.g. `requestAnimationFrame` + `setTimeout`); prefer event delegation.
- **Item stacking:** Stack when same name/type, same `containerId`, same `equipped`, same type-specific props; containers don't stack. Use helpers like `_canStackItems`, `_findStackableItem`, `_splitItemStack`; quantity UI for actions on stacks.

### Spell cast chat (message flags: save, concentration, spell penetration)

When a character casts a spell, the posted chat message includes **`flags.thirdera.spellCast`** with:

| Field | Purpose |
| ----- | ------- |
| `dc` | Save DC (number) |
| `saveType` | `"fort"` \| `"ref"` \| `"will"` \| `null` |
| `spellName`, `spellUuid` | Display and document reference |
| `targetActorUuids` | Optional: UUIDs of targeted actors when casting with tokens selected |
| `spellLevel` | Spell level (0–9) for this cast |
| `classItemId` | Embedded class item id on the caster |
| `casterLevel` | Caster level for that class at cast time |
| `srKey` | Raw spell resistance setting from the spell item (`system.spellResistance`); drives cast-chat spell penetration when `spellAllowsPenetrationRoll` is true |

**Spell resistance helpers** (`module/logic/spell-resistance-helpers.mjs`): `getActorSpellResistance(actor)` returns the numeric SR for **NPCs** (`system.statBlock.spellResistance`) and **characters** (`system.details.spellResistance`), otherwise `0`. `spellAllowsPenetrationRoll(srKey)` is `true` only for `yes` and `yes-harmless`. For `yes-harmless`, willingness and “harmless” are adjudicated at the table: the GM skips or ignores the roll when SR does not apply.

**Spell penetration roll:** `ThirdEraActor#rollSpellPenetration({ casterLevel, spellResistance, label })` (`module/documents/actor.mjs`) rolls **`1d20 + casterLevel`** (CL truncated; non-finite CL → 0) against the given **SR** (truncated, non-negative). SRD: the check **succeeds if the total meets or exceeds SR**. Chat flavor shows CL bonus, “vs SR *N*”, and **Success** / **Failure** (same styling as spell saves). Invalid non-numeric `spellResistance` aborts with a notification and returns `null`.

**Spell penetration from cast chat** (`module/logic/spell-sr-from-chat.mjs`): When `srKey` allows automation and `casterLevel` is a finite number, the **owner** of the message speaker (or a GM) sees penetration controls. If `targetActorUuids` includes at least one actor with **SR > 0**, one button per such target (**Spell penetration vs *Name* (SR *N*)**) rolls immediately vs that target’s current SR. Otherwise a single **Spell penetration…** button opens a dialog listing **character** and **NPC** actors with SR > 0 that the user may **observe** (GMs see all). Right‑click the message → **Roll spell penetration…** opens the same target picker. The roll always uses the **speaker** as the caster (`rollSpellPenetration` on that actor).

**Legacy cast messages and caster level:** Chat messages created **before** `spellCast.casterLevel` was stored, or any message where `casterLevel` is missing or not a finite number, **do not** show spell penetration automation (the SR line in the card may still display for reference). **`casterLevel` may be `0`** (finite); in that case controls still appear and the roll uses `1d20 + 0`. There is no separate combat-track integration—same cast-chat behavior whether or not a combat is active.

The **Roll save** button and context menu (`module/logic/spell-save-from-chat.mjs`) use `dc`, `saveType`, and `targetActorUuids`. **Concentration** (`module/logic/concentration-from-chat.mjs`) uses `spellLevel` and the message **speaker** as the caster: **Concentration (defensive)** rolls vs DC 15 + spell level (see `module/logic/concentration-dcs.mjs`); **Concentration (other)…** opens a dialog for damage-based DC (10 + damage + spell level) or a custom DC. Right‑click the message → **Roll Concentration…** opens the same dialog. Only the **owner** of the speaker actor (or a GM) sees these controls. Rolls use `ThirdEraActor#rollConcentrationCheck` (`module/documents/actor.mjs`), which requires a Concentration skill item or a modifier-only Concentration entry. Extenders can rely on this flag shape when adding custom spell-cast messages or tools that react to spell casts.

**Pure helpers (Vitest):** Flag and roll parsing used by the chat UIs also live in import-safe modules for reuse and tests: **`spell-save-from-chat-helpers.mjs`** (`getSpellCastDataFromMessage`), **`concentration-from-chat-helpers.mjs`** (`parseConcentrationOtherInputs`), **`spell-sr-from-chat-helpers.mjs`** (`getSpellPenetrationCastFlags`), **`apply-damage-healing-chat-helpers.mjs`** (`getApplyDataFromRollFields` for roll messages). **`test/README.md`** lists coverage; hook registration remains in the `*-from-chat.mjs` / `apply-damage-healing-entry-points.mjs` entry files.
