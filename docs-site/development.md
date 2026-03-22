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

- **ThirdEraActor** (actor.mjs) - Extends `Actor`. Roll methods: `rollAbilityCheck`, `rollSavingThrow`, `rollSkillCheck`. **Initiative** uses Foundry’s inherited `Actor.rollInitiative` (no override) so combatants and chat messages stay in sync with the combat tracker. Delegates to type-specific `_prepareCharacterData` / `_prepareNPCData`.
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

### Spell cast chat (message flags: save, concentration)

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
| `srKey` | Raw spell resistance setting from the spell item (`system.spellResistance`) for future automation |

The **Roll save** button and context menu (`module/logic/spell-save-from-chat.mjs`) use `dc`, `saveType`, and `targetActorUuids`. **Concentration** (`module/logic/concentration-from-chat.mjs`) uses `spellLevel` and the message **speaker** as the caster: **Concentration (defensive)** rolls vs DC 15 + spell level (see `module/logic/concentration-dcs.mjs`); **Concentration (other)…** opens a dialog for damage-based DC (10 + damage + spell level) or a custom DC. Right‑click the message → **Roll Concentration…** opens the same dialog. Only the **owner** of the speaker actor (or a GM) sees these controls. Rolls use `ThirdEraActor#rollConcentrationCheck` (`module/documents/actor.mjs`), which requires a Concentration skill item or a modifier-only Concentration entry. Extenders can rely on this flag shape when adding custom spell-cast messages or tools that react to spell casts.

## Testing Apply damage/healing (Phase 2)

Manual test steps for the Apply damage/healing entry points (chat, sheet, “to this token”, macro).

1. **Setup**
   - Load the Third Era system and a world (e.g. 3rd-era-testworld).
   - Have at least one character and one NPC (or two tokens) with HP (value/max) and, for NPCs, temp HP if needed.
   - Place tokens on a scene so you can select them.

2. **Apply from sheet (targets from selection)**
   - Open a character or NPC sheet; go to the **Combat** tab.
   - Confirm **“Apply damage/healing”** is visible.
   - Select one or more tokens on the canvas that have HP.
   - Click **“Apply damage/healing”**. The Apply dialog should open with those tokens listed as targets, amount blank, type Damage/Healing.
   - Enter an amount, choose Damage or Healing, click **Apply**. Confirm HP (and temp HP for damage) update and a short notification appears.
   - Repeat with no tokens selected: dialog should open with no targets (and show “Select one or more tokens…”).

3. **Apply to this token (single target from sheet)**
   - Open the sheet of an actor that has at least one token on the current scene.
   - On the Combat tab, confirm **“Apply to this token”** is visible (only when the actor has a token in the scene).
   - Click **“Apply to this token”**. The Apply dialog should open with that actor as the only target, amount blank.
   - Enter amount, apply; confirm that actor’s HP updates.

4. **Apply from chat (amount from roll)**
   - Roll damage or healing from the sheet (e.g. weapon damage, or a manual roll that posts to chat with a “Damage” or “Healing” flavor).
   - On the chat message, confirm an **“Apply”** button appears.
   - Select one or more target tokens (they will be used when the dialog opens).
   - Click **“Apply”**. The Apply dialog should open with amount pre-filled from the roll total and type Damage or Healing inferred from the message flavor.
   - Confirm targets (from selection), adjust if needed, click **Apply**; confirm HP updates.
   - Right‑click the same message and confirm the context menu includes **“Apply”**; choose it and confirm the same behavior.

5. **Macro / console**
   - In the console or a macro, run `game.thirdera.applyDamageHealing.openDialog()`. Dialog should open with targets from current selection.
   - Run `game.thirdera.applyDamageHealing.openWithOptions({ amount: 5, mode: "healing" })`. Dialog should open with amount 5, Healing, and targets from selection.
   - Run `game.thirdera.applyDamageHealing.openWithOptions({ targetActors: [actor] })` with an actor reference. Dialog should open with that actor as the only target.

6. **Permissions**
   - As a player, select a token you do not own. Open Apply from sheet or chat and try to apply. You should be blocked or see a “no permission” message if the system restricts applying to tokens you cannot edit.

## Testing Apply damage/healing (Phase 3)

Manual test steps for temp HP (damage to temp first), nonlethal damage, and healing that reduces nonlethal (SRD: heal lethal first, remainder heals nonlethal).

1. **Setup**
   - Use the same world and tokens as Phase 2. Ensure at least one NPC has **Temp HP** > 0 (set on Combat tab) and note current HP value/max and temp.

2. **Temp HP — damage to temp first**
   - Select a token with temp HP (e.g. 5 temp, 10/10 HP). Open Apply damage/healing (sheet or macro), enter an amount less than temp (e.g. 3), choose **Damage**, click **Apply**.
   - **Expected:** Only temp HP decreases (e.g. 5 → 2). Current HP stays 10. Notification: “Applied 3 damage to 1 target(s).”
   - Apply damage greater than remaining temp (e.g. 5 more). **Expected:** Temp goes to 0, remainder reduces current HP (e.g. 10 → 8). Notification as above.
   - Optionally apply damage that would reduce HP below 0: **Expected:** HP is clamped to −9 (dying) or 0 (dead) per SRD.

3. **Nonlethal damage**
   - Select a token with 0 nonlethal. Open Apply dialog, enter amount (e.g. 4), choose **Damage**, check **“Apply as nonlethal damage”**, click **Apply**.
   - **Expected:** Current HP and temp HP unchanged. **Nonlethal** on the sheet (Combat tab) and in the header (if present) shows 4. Notification: “Applied 4 nonlethal damage to 1 target(s).”
   - Apply more nonlethal (e.g. 3). **Expected:** Nonlethal is cumulative (e.g. 4 → 7). HP and temp still unchanged.
   - Confirm the “Apply as nonlethal damage” checkbox is visible when **Damage** is selected and hidden when **Healing** is selected (including after switching the type radio).

4. **Healing — lethal first, remainder heals nonlethal**
   - Use a token with current HP below max and some nonlethal (e.g. 6/10 HP, 5 nonlethal). Open Apply dialog, enter 3, choose **Healing**, click **Apply**.
   - **Expected:** Lethal is healed first: 6 → 9 HP. No remainder, so nonlethal stays 5.
   - Apply 5 healing. **Expected:** 1 point heals lethal (9 → 10), 4 points reduce nonlethal (5 → 1). Final: 10/10 HP, 1 nonlethal.
   - Apply 2 more healing. **Expected:** No lethal to heal; both points reduce nonlethal (1 → 0). Final: 10/10 HP, 0 nonlethal.

5. **Sheets and macro**
   - On character and NPC sheets, Combat tab: confirm **Nonlethal** field is present and editable. In header, when nonlethal > 0, confirm “(N NL)” appears (e.g. “(5 NL)”).
   - In console run `game.thirdera.applyDamageHealing.openWithOptions({ amount: 2, mode: "damage", nonlethal: true })`. **Expected:** Dialog opens with amount 2, Damage selected, “Apply as nonlethal damage” checked. Apply and confirm nonlethal increases on target.

## Testing Apply damage/healing (Phase 4)

Manual test steps for combined attack & damage roll and Apply using the damage total; and for `openWithOptions` passing `nonlethal`.

1. **openWithOptions nonlethal (Phase 3 completion)**
   - In console run `game.thirdera.applyDamageHealing.openWithOptions({ amount: 2, mode: "damage", nonlethal: true })`.
   - **Expected:** Dialog opens with amount 2, Damage selected, **“Apply as nonlethal damage” checked**. Apply and confirm nonlethal increases on the selected target.

2. **Attack & Damage button**
   - Open a character or NPC sheet; go to the Combat tab and the weapons list.
   - Confirm a third roll button (burst icon) with title **“Attack & Damage”** appears next to the Attack (d20) and Damage (d6) buttons for each weapon.
   - Click **“Attack & Damage”** for a weapon. **Expected:** One chat message is posted containing both an attack roll and a damage roll, with flavor like “Longsword Attack & Damage (Primary)”.

3. **Apply from combined message**
   - After posting an Attack & Damage message, confirm an **“Apply”** button appears on that message.
   - Select one or more target tokens on the canvas.
   - Click **“Apply”**. **Expected:** The Apply dialog opens with the **damage roll total** (not attack + damage) in the Amount field and Damage selected.
   - Click **Apply** and confirm the target’s HP decreases by that damage total (temp HP first if present).

4. **Separate damage message unchanged**
   - Roll only damage from the sheet (Damage d6 button). Confirm the Apply button still appears and uses the single roll total (unchanged from Phase 2).

## Testing initiative and combat tracker

Manual regression for system initiative formula, Foundry combat integration, sheet button, and GMS **`initiative`** contributions.

1. **Formula and sheet display**
   - Open a character with known Dex mod and no extra initiative modifiers. On **Combat**, note **Initiative** bonus; it should equal Dex mod.
   - Add a feat or condition with **`initiative`** in mechanical effects (e.g. Improved Initiative +4). Reload/reprepare; bonus should be Dex + total from modifiers (tooltip/breakdown if shown).

2. **Combat tracker and core controls**
   - As GM, start or select an encounter on the current scene. Add tokens, use Foundry’s combat tracker to **roll initiative** (or “Roll NPCs”).
   - **Expected:** Rolled total matches **1d20 +** the actor’s **`attributes.initiative.bonus`** (same as sheet). Chat uses Foundry’s initiative flavor; combatant **initiative** values update.

3. **Sheet — Roll initiative**
   - With tokens for the actor on the scene and an active combat, open the character or NPC sheet → **Combat** → **Roll initiative**.
   - **Expected:** Combatants created for tokens if missing; this actor’s combatants roll; tracker totals match the formula. If there is no active scene, the sheet should warn (switch to a scene first).

4. **Linked vs unlinked tokens**
   - Repeat from the sheet with a **linked** token and an **unlinked** duplicate if applicable; confirm Foundry’s usual per-combatant behavior (one roll per combatant tied to the correct actor/token context).

5. **No active combat / permissions**
   - With no encounter started, **Roll initiative** should surface Foundry’s “no active combat” style warning (or system notification), not a silent failure.
   - As a player, only combatants you own should roll when using tracker or sheet (Foundry skips others).

6. **Contributors — optional local checklist**
   - The repository **gitignores** `docs/` for optional local notes. You may copy this section into `docs/testing/initiative-and-combat-tracker-testing.md` if you keep checklists there; the committed source of this checklist is this page.

**Compendium / world copies:** Updated SRD feat JSON in the system pack (e.g. Improved Initiative `changes`) applies on loader refresh; **world copies** of the same feat may need re-import or manual **`changes`** to pick up pack fixes.

## Testing concentration from chat

Manual regression for defensive concentration, custom/damage DC dialog, context menu, validation, permissions, and missing Concentration skill. **Code:** `module/logic/concentration-from-chat.mjs`, `module/logic/concentration-dcs.mjs`, `ThirdEraActor#rollConcentrationCheck` in `module/documents/actor.mjs`.

1. **Setup**
   - Load the Third Era system; hard-refresh the browser (`Ctrl+Shift+R`) after pulling changes.
   - Use a PC you **own** (or GM) with spellcasting and at least one spell on **Ready to cast**.
   - Ensure the actor has a **Concentration** skill item **or** a **modifier-only** Concentration entry (Attributes → Skills, “Other skill modifiers”).

2. **Cast message and buttons**
   - Cast a spell from **Ready to cast**. Confirm the chat card shows **Concentration (defensive)** (tooltip: DC 15 + spell level) and **Concentration (other)…**.

3. **Defensive roll**
   - Click **Concentration (defensive)**. **Expected:** Chat roll with “Defensive casting” in the flavor, **vs DC** = 15 + that spell’s level, success/failure vs that DC.

4. **Other dialog — damage DC**
   - Click **Concentration (other)…**; enter **Damage** = `7`, leave **Custom DC** empty; **Roll**. **Expected:** DC = 10 + 7 + spell level; flavor mentions damage while casting.

5. **Other dialog — custom DC**
   - Open again; leave **Damage** empty; **Custom DC** = `18`; **Roll**. **Expected:** vs DC 18; “Custom DC” style label in flavor.

6. **Both fields (damage wins)**
   - Set **Damage** = `5` and **Custom DC** = `99`; **Roll**. **Expected:** DC uses 10 + 5 + spell level, not 99.

7. **Validation**
   - Leave both fields empty; **Roll**. **Expected:** Warning; dialog stays open. Enter valid values and roll successfully.
   - Invalid **Damage** (negative or non-numeric): warning, dialog stays open.

8. **Context menu**
   - Right‑click the cast message → **Roll Concentration…**. **Expected:** Same dialog as **Concentration (other)…**.

9. **Permissions**
   - As a user who is **not** GM and **not** owner of the caster: concentration controls should **not** appear on that message (or should not apply).

10. **No Concentration configured**
    - On an actor without Concentration skill and without modifier-only Concentration, attempt a roll. **Expected:** `THIRDERA.Concentration.NoSkillItem` notification; no roll.

**Optional local copy:** The repo **gitignores** `docs/` for contributor-only notes. You may copy this section into `docs/testing/concentration-from-chat-testing.md` if you keep checklists there; the committed source is this page.
