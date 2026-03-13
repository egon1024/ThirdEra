# Development reference

This page is the single reference for **[contributors](contributing.md)** working in this repository: project overview, architecture, conventions, and operational notes. If you are **extending** the system (adding compendiums, modules, or new content) rather than changing core code, see **[Extending](extending.md)** first.

## Project Overview

ThirdEra is a **Foundry VTT game system** implementing D&D 3.5 Edition using the System Reference Document (SRD). It targets **Foundry VTT v13** and uses the **ApplicationV2 / HandlebarsApplicationMixin** sheet framework (not the legacy Application v1). **Only SRD content is intended to be implemented - no proprietary data outside the SRD.** The system is designed so that third-party compendiums or modules can extend it.

There is no build step, bundler, or package manager. The system is plain ES modules + CSS + Handlebars templates, loaded directly by Foundry VTT at runtime.

## Development Setup

- Symlink or copy this repository into Foundry VTT `Data/systems/` as `thirdera/`. Foundry resolves paths relative to `systems/thirdera/` (e.g. template paths use `"systems/thirdera/templates/..."`).
- No tests, linters, or build commands. Test by reloading the Foundry VTT world in-browser (F5 or "Reload" in developer tools).

## Architecture

### Entry Point

`thirdera.mjs` - Registers all data models, document classes, sheet classes, Handlebars helpers, and partials in `Hooks.once("init")`. Also registers sidebar delete button hooks. Global config: `CONFIG.THIRDERA`.

### Data Models (`module/data/`)

Each file defines a `TypeDataModel` subclass with static `defineSchema()` using Foundry field classes (`NumberField`, `StringField`, `SchemaField`, `HTMLField`, etc.).

- **Actor types**: `CharacterData` (actor-character.mjs), `NPCData` (actor-npc.mjs)
- **Item types**: `WeaponData`, `ArmorData`, `EquipmentData`, `SpellData`, `FeatData`, `SkillData`, `RaceData`, `ClassData`, `FeatureData`

Derived data (ability modifiers, save totals, grapple, initiative) is calculated in `prepareDerivedData()` on the data models, not on document classes.

### Document Classes (`module/documents/`)

- **ThirdEraActor** (actor.mjs) - Extends `Actor`. Roll methods: `rollAbilityCheck`, `rollSavingThrow`, `rollSkillCheck`, `rollInitiative`. Delegates to type-specific `_prepareCharacterData` / `_prepareNPCData`.
- **ThirdEraItem** (item.mjs) - Extends `Item`. `rollAttack` / `rollDamage` for weapons. Skill totals in `_prepareSkillData` when the item is owned by an actor.

### Sheet Classes (`module/sheets/`)

Both use **ApplicationV2**: `HandlebarsApplicationMixin(ActorSheetV2)` / `HandlebarsApplicationMixin(ItemSheetV2)`.

- **ThirdEraActorSheet** (actor-sheet.mjs) - Single PARTS entry; template swapped in `_configureRenderParts()` by actor type (character vs npc). Actions: static private methods in `DEFAULT_OPTIONS.actions`.
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

### Modifier system (`module/logic/modifier-aggregation.mjs`)

A **unified modifier pipeline** aggregates contributions from conditions, feats, race, equipped items, and future sources into one **modifier bag** per actor. Design: [.cursor/plans/generalized-modifier-system.md](../.cursor/plans/generalized-modifier-system.md).

- **Canonical keys:** `CONFIG.THIRDERA.modifierKeys` lists allowed keys (e.g. `ac`, `acLoseDex`, `speedMultiplier`, `saveFort`/`saveRef`/`saveWill`, `attack`/`attackMelee`/`attackRanged`, `ability.str` … `ability.cha`, `skill.<skillKey>`). Only these keys are applied.
- **Ability and skill keys:** Condition items (and later feats/equipped items) can use `ability.str`, `ability.dex`, etc. and `skill.<skillKey>` (e.g. `skill.hide`) in their `changes` array. The aggregator outputs per-key totals and breakdowns; character `prepareDerivedData` applies ability deltas to each ability’s **effective** (with breakdown), then recomputes **mod** before any other step uses ability mod. Skill modifiers from the bag are applied in a later phase.
- **Provider contract:** A **modifier-source provider** is a function `(actor) => Array<{ label: string, changes: Array<{ key: string, value: number, label?: string }> }>`. The aggregator runs all functions in `CONFIG.THIRDERA.modifierSourceProviders` and merges results.
- **Usage:** Call `getActiveModifiers(actor)` once early in character `prepareDerivedData` (after base ability values); apply ability deltas and set mod; then use the same modifier bag for AC, speed, saves, and attack. Race contributes via the built-in race provider (abilityAdjustments → ability.\* changes). Extenders can push additional provider functions to the registry so new item types or effects participate without editing the aggregator.

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
