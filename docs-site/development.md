# Development reference

This page is the single reference for **[contributors](contributing.md)** working in this repository: project overview, architecture, conventions, and operational notes. If you are **extending** the system (adding compendiums, modules, or new content) rather than changing core code, see **[Extending](extending.md)** first.

## Project Overview

ThirdEra is a **Foundry VTT game system** implementing D&D 3.5 Edition using the System Reference Document (SRD). It targets **Foundry VTT v13** and uses the **ApplicationV2 / HandlebarsApplicationMixin** sheet framework (not the legacy Application v1). **Only SRD content is intended to be implemented - no proprietary data outside the SRD.** The system is designed so that third-party compendiums or modules can extend it.

There is no build step, bundler, or package manager **for the system at runtime**. The system is plain ES modules + CSS + Handlebars templates, loaded directly by Foundry VTT at runtime.

**Automated testing** is the **next development priority**: the roadmap expects a small **dev-only** test setup (e.g. Node + a unit-test runner) for pure logic under `module/logic/`, with optional in-Foundry testing (e.g. Quench) documented in [.cursor/plans/future-features.md](../.cursor/plans/future-features.md). Authoritative ordering and scope notes: [.cursor/STATE-OF-WORK.md](../.cursor/STATE-OF-WORK.md) (Planned — Automated testing framework). Automated tests will **complement**, not replace, in-world checks after reload.

## Development Setup

- Symlink or copy this repository into Foundry VTT `Data/systems/` as `thirdera/`. Foundry resolves paths relative to `systems/thirdera/` (e.g. template paths use `"systems/thirdera/templates/..."`).
- **Today:** there is no automated test suite or linter in the repo yet. Verify behavior by reloading the Foundry VTT world in-browser (F5 or "Reload" in developer tools). When the test framework lands, contributor docs here will note how to run it.

## Architecture

### Entry Point

`thirdera.mjs` - Registers all data models, document classes, sheet classes, Handlebars helpers, and partials in `Hooks.once("init")`. Also registers sidebar delete button hooks. Global config: `CONFIG.THIRDERA`.

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
- **ThirdEraItemSheet** (item-sheet.mjs) - Template per item type (`item-${type}-sheet.hbs`). `submitOnChange: true` for auto-saving.

Tab switching is manual via a `changeTab` action (not Foundry's built-in tab system).

### Templates (`templates/`)

- **Actor**: `templates/actor/character-sheet.hbs`, `npc-sheet.hbs`
- **Item**: One per type (`item-weapon-sheet.hbs`, `item-armor-sheet.hbs`, etc.), plus `item-feature-sheet.hbs`
- **Partials**: `templates/partials/editor-box.hbs` (ProseMirror display/edit toggle). See `templates/partials/README.md`.

Context comes from `_prepareContext()`; item lists are pre-sorted in the sheet's `_prepareItems()`.

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

A **unified modifier pipeline** aggregates contributions from conditions, feats, race, equipped items, and future sources into one **modifier bag** per actor. Design and deferred work: [.cursor/plans/future-features.md](../.cursor/plans/future-features.md) (Generalized modifier system — out of scope).

- **Canonical keys:** `CONFIG.THIRDERA.modifierKeys` lists allowed keys (e.g. `ac`, `acLoseDex`, `speedMultiplier`, `saveFort`/`saveRef`/`saveWill`, `attack`/`attackMelee`/`attackRanged`, `naturalHealingPerDay`, **`initiative`**, `ability.str` … `ability.cha`, `skill.<skillKey>`). Only these keys are applied. The **`initiative`** total is summed with Dexterity modifier into `attributes.initiative.bonus` (used by the system initiative formula in `system.json`). The **`naturalHealingPerDay`** total is added to character level and to `actor.system.details.naturalHealingBonus` when computing daily natural healing in the **Take rest** flow (`getRestHealingAmount` in `module/logic/rest-healing.mjs`).
- **Ability and skill keys:** Condition items (and later feats/equipped items) can use `ability.str`, `ability.dex`, etc. and `skill.<skillKey>` (e.g. `skill.hide`) in their `changes` array. The aggregator outputs per-key totals and breakdowns; character `prepareDerivedData` applies ability deltas to each ability’s **effective** (with breakdown), then recomputes **mod** before any other step uses ability mod. Skill modifiers from the bag are applied in the skill loop; modifier-only skills (no ranks) appear in an "Other skill modifiers" block with roll.
- **Provider contract:** A **modifier-source provider** is a function `(actor) => Array<{ label: string, changes: Array<{ key: string, value: number, label?: string }> }>`. The aggregator runs all functions in `CONFIG.THIRDERA.modifierSourceProviders` and merges results.
- **Usage:** Call `getActiveModifiers(actor)` once early in character or NPC `prepareDerivedData` (after base ability values); apply ability deltas and set mod; then use the same modifier bag for AC, speed, saves, attack, initiative, and skills. Race contributes via the built-in race provider (abilityAdjustments → ability.\* changes).

**Extending the modifier system:** You can add new modifier sources in two ways.

1. **Register a provider function.** Push a function to `CONFIG.THIRDERA.modifierSourceProviders`. Each provider has signature `(actor) => Array<{ label: string, changes: Array<{ key: string, value: number, label?: string }> }>`. The aggregator runs all providers and merges contributions; only keys in the canonical set (see `CONFIG.THIRDERA.modifierKeys`) are applied. Example: a module that adds temporary spell effects could register a provider that returns one contribution per active spell with a `changes` array.
2. **Item method `getModifierChanges(actor)`.** On any item type, implement `getModifierChanges(actor)` returning `{ applies: boolean, changes: Array<{ key: string, value: number, label?: string }> }`. The built-in item provider in the registry iterates `actor.items` and, when this method exists, calls it; when `applies === true`, it merges the returned `changes` with `label = item.name`. No change to the aggregator is required. Items can also use optional `system.changes` (same shape) and rely on the default item provider’s type-specific “applies” rules (e.g. feat: always; equipment/armor/weapon: when equipped; race: when this is the actor’s race).

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
- **Current:** Races (7), Classes (11), Skills (36), Feats (86), Armor (16), Weapons (58), Equipment (63), Spells (SRD 0–9), Schools, Conditions, Creature Types, Subtypes, Features.

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
