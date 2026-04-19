# Compendium Building Guide

This document captures learnings and best practices for creating and managing Foundry VTT compendiums in the ThirdEra system.

## Overview

Compendiums in Foundry VTT are collections of pre-made game content (items, actors, etc.) that can be imported into worlds. ThirdEra uses compendiums to distribute SRD content (races, classes, skills, feats, spells, weapons, armor, equipment, creature features, monsters) so users don't have to manually create every item.

## Compendium Architecture

### Storage Model

**Critical Understanding**: Foundry persists compendium content in database files under each `packs/<name>/` directory. ThirdEra also keeps **JSON source files** in those folders; on world load the system’s **CompendiumLoader** (GM) reads that JSON and creates or **updates** matching compendium documents (including races).

### Races pack (JSON refresh)

On each world load (GM client, **ready**), **CompendiumLoader** refreshes **all** mapped packs from `packs/*.json`, including **Races**: **existing** compendium race documents are **updated** from disk when the stable key (race **name**) matches, so compendium entries track system releases. **Edits you make inside the Races compendium are overwritten** on the next load—use **world** race Items (or another pack you control) for homebrew or experiments you need to keep. **New** race JSON files are still **created** when missing from the pack.

**SRD race mechanical rows (GMS):** On **ready**, the GM client also runs a one-way **merge** (`module/logic/race-srd-changes-merge.mjs`) that appends missing bundled skill/save/hide `system.changes` rows to **existing** race items (Races compendium, world race items, and races **embedded on actors**) when `flags.thirdera.raceStockDeltaRev` is below the current revision (`RACE_STOCK_DELTA_REV` in that module). It does **not** remove or replace documents, does **not** add a row if that modifier **key** already appears in `changes` (so custom values for the same key are left alone), and does **not** touch ability-score rows. **Self-heal:** If the revision flag is already current but a race that **belongs to the Races compendium** (or is embedded with a `thirdera_races` compendium `sourceId`/UUID) is still missing bundled rows for its stock name, the same pass merges those rows in again — so incomplete compendium entries (e.g. Elf with only ability adjustments) are repaired without bumping `RACE_STOCK_DELTA_REV`. Homebrew races in the world that happen to share a stock name are not altered. When you add new stock delta rows for a release, bump `RACE_STOCK_DELTA_REV`. **Regression tests:** `test/unit/data/race-pack-stock-changes.test.mjs` asserts each race JSON still includes every row returned by `getRaceStockDeltaRowsForName` — run `npm test` after editing race packs or sync scripts.

**Other racial traits (HTML):** Stock races ship **`system.otherRacialTraits`** for vision, immunities, weapon familiarity, languages, spell-like abilities, and similar traits that are **not** represented as numeric `system.changes` rows. The field is edited on the race sheet (Details) and shown on the PC sheet **Description** tab. On **ready**, the GM client runs `module/logic/race-qualitative-traits-stock.mjs`: when `flags.thirdera.raceQualitativeTraitsRev` is below the bundled revision, empty fields are filled from stock text keyed by default race **names**, and known obsolete bundled wording may be replaced (see `isStaleBundledQualitativeTraitsHtml` in that module). Custom text is otherwise left as-is while the flag is advanced. Keep the stock map aligned with `packs/races/*.json` when editing shipped prose.

### Bundled compendium sync migration (world upgrades)

Some compendiums are **not** refreshed from disk on every world load when the pack already has index entries (see **Re-import compendium JSON on each load** below). For **selected** packs, Third Era also runs a **one-time migration** on the **first GM `ready`** after a system update when the shipped migration revision advances:

- **World setting (internal):** `bundledCompendiumSyncMigrationRevision` — not shown in the Configure Settings sidebar; stores the last applied migration revision for this world.
- **Behavior:** The GM client shows an **info notification** summarizing created/updated compendium documents (matched by stable key, same as normal JSON import). After success, the world’s revision is updated so the pass does not repeat until the revision is bumped again in a future release.
- **Manual re-sync (console, GM):** `await game.thirdera.bundledCompendiumSync.syncCollectionsFromBundle()` — same bundled JSON apply as the migration **without** changing the migration revision (useful for support or if you add a settings button later). Optional argument: an array of `pack.collection` ids (defaults to the migration list).

Implementation: `module/logic/compendium-bundled-json-sync.mjs` and `CompendiumLoader.loadPackFromJSON(..., { bypassPopulationGate: true })`.

### Compendium Pack Definition (`system.json`)

Each compendium pack must be declared in `system.json` under the `"packs"` array:

```json
{
  "name": "thirdera_races",
  "label": "Races",
  "path": "packs/races",
  "type": "Item",
  "system": "thirdera",
  "ownership": {
    "GAMEMASTER": "OWNER",
    "ASSISTANT": "OWNER",
    "TRUSTED": "OBSERVER",
    "PLAYER": "OBSERVER"
  }
}
```

**Key Fields:**
- `name`: Must use underscores, not dots (e.g., `thirdera_races` not `thirdera.races`) for Foundry V14 compatibility
- `label`: Display name shown in the Compendium sidebar
- `path`: Relative path to the directory containing JSON source files
- `type`: Document type — **`"Item"`** for races, classes, spells, etc.; **`"Actor"`** for the **Monsters (SRD)** pack (`thirdera_monsters`, NPC actors).
- `system`: System ID (`"thirdera"`)
- `ownership`: **REQUIRED** - Without this, compendiums won't be visible in the UI. Defines permissions for each user role.
- `banner`: **Optional.** A file path to a banner image shown behind each compendium entry in the Compendium sidebar (and in the compendium window header when opened). If omitted, Foundry uses the default for the pack type (e.g. the same generic Item banner for all Item packs).

#### Compendium banner images (per-pack)

You can give each pack its own banner by adding a `"banner"` property to that pack in `system.json`:

```json
{
  "name": "thirdera_armor",
  "label": "Armor",
  "path": "packs/armor",
  "type": "Item",
  "system": "thirdera",
  "banner": "systems/thirdera/assets/banners/armor-banner.webp",
  "ownership": { ... }
}
```

**Image characteristics:**

| Spec | Value |
|------|--------|
| **Recommended dimensions** | **290 × 70** pixels (Foundry's documented size for the sidebar strip). |
| **Aspect** | Landscape; the image is displayed with `object-fit: cover` and `object-position: center`, so it will be cropped to fit. A 290×70 (or proportional) landscape works best. |
| **Where to put files** | Inside the system, e.g. `assets/banners/` (path in `system.json`: `systems/thirdera/assets/banners/your-banner.webp`). |
| **Formats** | WebP, PNG, or JPEG. Foundry core uses `.webp`. |
| **Display** | The image is shown at ~80% opacity with a slight dark overlay; the pack name and icon are centered on top. Design so important elements remain visible with that overlay. |
| **Contexts** | Same image is used in the sidebar list (70px tall) and in the compendium window header when a pack is opened (100px tall). |

### Collection IDs

Foundry VTT uses collection IDs to reference compendium packs. The format is: `{systemId}.{packName}`

Example: For pack name `thirdera_races`, the collection ID is `thirdera.thirdera_races`

**Important**: When looking up packs in code, use the collection ID:
```javascript
const pack = game.packs.get("thirdera.thirdera_races");
```

## Compendium Loader (`module/logic/compendium-loader.mjs`)

The `CompendiumLoader` class programmatically imports JSON files into compendiums.

### Initialization

Called from `thirdera.mjs` on the `Hooks.once("ready")` hook:
```javascript
Hooks.once("ready", () => {
    CompendiumLoader.init();
});
```

### Key Methods

#### `init()`
- Only runs for GM users
- Waits 1 second for compendiums to be fully registered
- Iterates through `FILE_MAPPINGS` to find and populate each pack
- Checks if pack is already populated (skips if entries exist)
- Updates existing items or creates new ones

#### `loadPackFromJSON(pack, fileList, options?)`
- Optional third argument `{ bypassPopulationGate: true }` forces a fetch/update cycle even when the compendium index is already non-empty (used by the bundled sync migration and optional manual sync). Otherwise the world setting **Re-import compendium JSON on each load** must be on for the same effect.
- Returns `{ gateSkipped: true }` when the population gate skipped the load, or `{ gateSkipped: false, created, updated }` after processing (counts may be zero if no JSON matched or no changes were needed).
- Normalizes file paths (removes duplicate `systems/thirdera/` prefixes)
- Fetches JSON files via HTTP (`fetch()`)
- Removes invalid `_id` values (Foundry requires 16-character alphanumeric IDs)
- Unlocks compendium if locked (required to create/update documents)
- **Matches by stable key**: For each document, the loader uses a stable key to decide whether to update an existing compendium entry or create a new one. The key is: `system.conditionId` for conditions, otherwise `system.key` if present, otherwise `name`. This allows renaming a document in JSON (e.g. for disambiguation) without creating duplicates-the same compendium document is updated.
- Uses `Document.createDocuments()` and `Document.updateDocuments()` with `{pack: pack.collection}` option

### FILE_MAPPINGS

Maps collection IDs to arrays of JSON filenames:
```javascript
static FILE_MAPPINGS = {
    "thirdera.thirdera_races": [
        "race-dwarf.json",
        "race-elf.json",
        // ...
    ],
    // ...
};
```

**Important**: Keys must match Foundry's collection IDs (`systemId.packName`).

<a id="monster-npc-compendium-thirdera_monsters"></a>

## Monster (NPC) compendium (`thirdera_monsters`)

<a id="monster-npc-feat-vs-creature-feature"></a>

- **Pack:** `thirdera_monsters` — **`type`: `"Actor"`**, folder `packs/monsters/`.
- **Stable key:** Each NPC must have **`system.key`** (e.g. `monsterGoblin`) so the compendium loader can update the same entry across reloads (same pattern as item `system.key`). **Do not** ship two different JSON files with the same `system.key` (duplicate compendium rows): the loader dedupes updates by preferring the file with **more** embedded `items`, but duplicates are still an authoring bug to remove (e.g. retire or rename one file).
- **Feat vs creature feature (authoring):** When adding or editing embedded items on monsters, **strongly prefer** an embedded **`feat`** when the augmentation could be expressed by **granting the same feat** a PC would take from the **Feats** compendium—same name and benefit via **`system.changes`** (GMS). Use an embedded **`creatureFeature`** only when the effect **cannot** be modeled acceptably as that feat item—for example structured **CGS** (`system.cgsGrants`: senses, typed defenses, SLAs, overlays) or a special quality that is not “the feat” in text or behavior. See **GMS vs CGS** in [Development](development.md) for which pipeline applies. Historical entries or migration slices may differ; **new** authoring should follow this default.
- **Embedded skills / feats / creature features:** When an existing NPC compendium entry is refreshed from bundled JSON, the loader **replaces** the whole embedded **Item** list (delete all embedded Items, then recreate from the JSON `items` array). That avoids Foundry’s bulk-`updateDocuments` merge from **appending** duplicate rows when template items omit stable 16-character `_id`s.
- **Creature type / subtypes (authoring):** Source JSON may use **`system.creatureTypeKey`** (matches **Creature Type** item `system.key`, e.g. `humanoid`, `magicalBeast`) and **`system.subtypeKeys`** (array of **Subtype** item keys, e.g. `goblinoid`, `orc`, `fire`, `extraplanar`, `swarm`, `incorporeal`). On load, the compendium loader resolves these to **`creatureTypeUuid`** and **`subtypeUuids`** using the **Creature Types** and **Subtypes** packs, then removes the authoring keys.
- **Regenerating JSON:** Run `python3 scripts/build-monster-pack-json.py` from the repo root to rewrite the starter SRD monster files after editing the generator.
- **Skills and feats on monsters:** NPC actors embed **`skill`** and **`feat`** items (same shapes as the Skills / Feats packs) so the NPC sheet can show class vs cross-class (**`system.npcClassSkill`** on skills) and totals that include armor/load ACP and feat **GMS** keys (e.g. Alertness’s `skill.listen`). Ranks and **`modifier.misc`** are authored so totals match the SRD/MM entry for each stat block (including racial/size bonuses folded into misc where the system does not compute them automatically). Use optional **`modifier.miscLabel`** so the skill total tooltip names that bonus (e.g. size/MM) instead of a generic “Misc” line. After regenerating monsters from the Python script, run **`node scripts/apply-monster-skills-feats.mjs`** to re-merge those embedded items (the Node script is the source of truth for skill/feat rows; edit `scripts/apply-monster-skills-feats.mjs` to adjust them). That script strips prior embedded **`skill`** / **`feat`** rows using a case-normalized type check and **dedupes by `system.key`**, so reruns or odd legacy rows cannot leave two embedded items for the same skill.

<a id="creature-features-compendium-thirdera_creature_features"></a>

## Creature Features compendium (`thirdera_creature_features`)

- **Pack:** `thirdera_creature_features` — **`type`: `"Item"`**, folder `packs/creature-features/`, declared **before** the **Monsters** pack in `system.json` so future monster JSON can resolve references to creature-feature documents during compendium load.
- **Purpose:** Reusable **creature feature** items model SRD-style special qualities (optional **Ex / Su / Sp** tag on `system.abilityKind`), prose in **`system.description`**, numeric mechanical rows in **`system.changes`** (same canonical GMS keys as feats and conditions), and structured capability rows in **`system.cgsGrants`** (CGS — senses, spell-like grants, typed defenses, overlays), mirroring class feature / feat item shapes.
- **Stable key:** Each JSON file should set **`system.key`** (e.g. `rendTroll`) so the compendium loader updates the same entry across reloads, consistent with feats and monster actors.
- **Loader:** Add new filenames to **`CompendiumLoader.FILE_MAPPINGS`** under `"thirdera.thirdera_creature_features"` in `module/logic/compendium-loader.mjs` (same pattern as other Item packs). Maintainer notes for parallel authoring: `scripts/creature-feature-seed-authoring.md` and `scripts/creature-feature-seed-manifest-1.json`.
- **Sheets:** Item type id is **`creatureFeature`**; the sheet template path is **`templates/item/item-creatureFeature-sheet.hbs`** (same rule as `creatureType` → `item-creatureType-sheet.hbs`: the filename uses the exact `type` string). The sheet supports Description, Details (ability kind, mechanical effects table, CGS blocks). **`system.key`** is not shown on the sheet; it is set from pack JSON or auto-generated when creating a new item (for compendium matching and cross-references). When a creature feature item is **owned by an actor**, **`system.changes`** merge into the numeric modifier bag (GMS) and **`system.cgsGrants`** merge into capability grants (CGS), the same way as embedded feats — see [Development](development.md).
- **World template → embedded copies:** Saving a **world** (or compendium-unpacked) creature feature whose sheet is **not** opened from an actor pushes **`system.changes`**, **`system.cgsGrants`**, and the rest of the item payload to every embedded copy on actors that match by **`sourceId`** (or by **name**, same fallback as world feats), then refreshes those actors — parity with world **feat** sync in the item sheet.
- **Curated seed set (examples):** initiative and attack or save bonuses (numeric **Mechanical effects**), Hide skill bonus, **blindsight** and **darkvision** at **60 / 90 / 120 ft.**, low-light, scent, blindsense, tremorsense (under **Capability grants**), poison immunity, **sleep / paralysis / stunning / disease** immunities, **acid / cold / electricity / fire** energy resistance (e.g. 10), **DR 2/—**, **DR 5/magic**, **DR 10/magic**, **Multiattack** (`creatureMultiattack`) with empty **Mechanical effects** and prose that explains SRD natural-attack behavior vs the NPC sheet’s **Natural attacks** list and optional **preset attack bonus**, plus prose-first special attacks (**improved grab**, **constrict**, **swallow whole**, **rend**, **pounce**, **rake**, **trample**, **blood drain**) and **fast healing 1** (table-tracked until a dedicated GMS key exists). Some seeds exist for legacy or migration reasons; for **feat-identical** bonuses on monsters, prefer embedded **`feat`** items per the **Monster (NPC) compendium** bullet [Feat vs creature feature (authoring)](#monster-npc-feat-vs-creature-feature). Pack descriptions use **What it does (SRD)** and **ThirdEra** sections with **player-facing sheet labels**, not internal storage field names.
- **Selective feat → creature feature migration (monster pack JSON):** Maintainer-approved rows live in **`scripts/creature-feature-feat-migration-manifest.json`**. Apply (or re-check) with **`node scripts/migrate-monster-embedded-feats-to-creature-features.mjs`** from the repo root; use **`--dry-run`** to print actions without writing files. The script replaces listed embedded **`feat`** items with **`creatureFeature`** clones from `packs/creature-features/` matched by **`system.key`**. **New manifest slices** should follow the [feat vs creature feature authoring rule](#monster-npc-feat-vs-creature-feature) (prefer **`feat`** when the effect is the same as a PC feat). A row may set optional **`monsterPackBasename`** (a `packs/monsters/` filename only) when duplicate NPC **`system.key`** values would otherwise resolve to the wrong JSON file. This is a **data-only** change to `packs/monsters/*.json`; worlds keep existing imported monster actors until those documents are re-imported or recreated.

## JSON File Structure

### Required Fields

All compendium JSON files must follow this structure:

```json
{
  "_id": "item-id",
  "name": "Item Name",
  "type": "itemType",
  "img": "icons/svg/icon.svg",
  "system": {
    // Type-specific data matching the TypeDataModel schema
  },
  "flags": {},
  "folder": null,
  "sort": 0
}
```

### ID Handling

**Critical**: Foundry VTT requires `_id` values to be exactly 16 alphanumeric characters. JSON files with descriptive IDs (like `"race-dwarf"`) will cause validation errors.

**Solution**: The loader removes invalid `_id` values before importing, allowing Foundry to generate valid IDs automatically:
```javascript
if (jsonData._id && !jsonData._id.match(/^[a-zA-Z0-9]{16}$/)) {
    delete jsonData._id;
}
```

### Icon Paths

Icons must use paths that exist in Foundry VTT's icon set. Common paths:
- `icons/svg/sword.svg` - Weapons, combat feats
- `icons/svg/shield.svg` - Armor, defensive feats
- `icons/svg/target.svg` - Ranged weapons, archery feats
- `icons/svg/aura.svg` - Magic, spells, metamagic feats
- `icons/svg/book.svg` - Knowledge, skills, item creation feats
- `icons/svg/temple.svg` - Holy symbols, religious items
- `icons/svg/pawprint.svg` - Animals, mounted combat
- `icons/svg/eye.svg` - Perception, awareness
- `icons/svg/invisible.svg` - Stealth, hidden things

**Icon Validation**: Verify icons exist in your Foundry installation's public icon set (e.g. `resources/app/public/icons/svg/` under the Foundry app directory) before using them.

### Spell Compendium Format

Spell compendium JSON should use the **current** schema (not legacy fields) so content does not depend on migration.

- **School**: Use `schoolKey`, `schoolName`, `schoolSubschool`, and `schoolDescriptors` (do not use the legacy `school` string).
  - `schoolKey`: One of the 8 SRD school keys: `abjuration`, `conjuration`, `divination`, `enchantment`, `evocation`, `illusion`, `necromancy`, `transmutation` (same as `CONFIG.THIRDERA.schools` and the Schools compendium item keys).
  - `schoolName`: Display name (e.g. `"Evocation"`, `"Conjuration"`).
  - `schoolSubschool`: Optional subschool in parentheses, e.g. `"(Healing)"`, `"(Creation)"`, `"(Compulsion)"`; use `""` if none.
  - `schoolDescriptors`: Array of descriptor tags in brackets, e.g. `["[Fire]"]`, `["[Mind-Affecting]"]`; use `[]` if none.
- **levelsByClass**: One entry per class list that has the spell. Each entry: `classKey` (from `CONFIG.THIRDERA.spellListKeys`: `sorcererWizard`, `bard`, `cleric`, `druid`, `paladin`, `ranger`), `className` (display name, e.g. `"Sorcerer/Wizard"`), and `level` (0–9). Migration can backfill `className` from CONFIG if omitted.
- **levelsByDomain**: One entry per **cleric domain** that includes the spell (SRD cleric domain spell lists). Each entry: `domainKey` (must match a domain item's `system.key` in the Domains compendium, e.g. `knowledge`, `fire`, `healing`), `domainName` (display name, e.g. `"Knowledge"`), and `level` (1–9; domain spells are never 0-level). Use `[]` only when the spell does not appear on any SRD domain list. **All new spell JSONs must set levelsByDomain** by checking the SRD domain spell tables (e.g. d20srd.org cleric domains). Domain spell lists are **derived from spell levelsByDomain** (single source of truth); domain compendium JSONs do **not** include a `spells` array.
- **spellResistance**: Use only machine-readable values: `""`, `"yes"`, `"no"`, `"yes-harmless"`, `"no-object"`, `"see-text"`. For automation, `yes-harmless` is treated like `yes` for offering a penetration control: the GM decides when SR actually applies (e.g. unwilling targets). See [Development reference](development.md) (section *Spell cast chat*).
- **Components**: Use `"true"` / `"false"` strings for verbal, somatic, material, focus, divineFocus; `xp` as number. **Always populate `materialDescription`** when material or focus is true: put the SRD material component and/or focus text here (e.g. "Gold dust worth 25 gp." or "Focus: A pair of platinum rings (worth at least 50 gp each)..."). When both apply, combine in one string (e.g. "Material: Incense worth at least 25 gp. Focus: A set of marked sticks..."). Older compendium spells (0-level, 1st-level) may still have empty `materialDescription`; backfill from the SRD when editing those spells.
- **IDs**: Omit `_id` or use a valid 16-character alphanumeric ID; the loader strips invalid IDs.

Icon strategy: use a single default (e.g. `icons/svg/aura.svg`) or a small set by school; verify paths in Foundry's icon set.

### Domain Compendium Format

Domain items have `system.description` and `system.key` only. Domain spell lists are **not** stored on the domain; they are derived at runtime from spell items' `levelsByDomain` (world items + spells compendium). Domain compendium JSONs must **not** include a `spells` array.

## Compendium Locking

Compendiums are **locked by default** in Foundry VTT. You must unlock them before creating or updating documents:

```javascript
if (pack.locked) {
    await pack.configure({ locked: false });
}
```

## Updating Existing Content

The loader supports updating existing compendium entries:

1. Fetches existing documents from the compendium
2. **Matches by stable key** (not name alone): `system.conditionId` for conditions, otherwise `system.key` if set, otherwise `name`. So you can change a document's `name` in JSON (e.g. to "Evasion (Rogue)") and the loader will update the same compendium document as long as `system.key` is unchanged.
3. Updates existing items or creates new ones
4. Uses `Document.updateDocuments()` for updates, `Document.createDocuments()` for new items

This allows updating compendium content (e.g., fixing icons or disambiguating display names) without creating duplicates.

### Key convention for new content

**New document keys should use UUIDs** (or UUID-like unique identifiers). Human-readable keys that are similar across documents (e.g. `evasion` in multiple classes) can cause confusion; UUIDs keep each document's key globally distinct and avoid collisions when names are alike. Existing keys remain as-is; this convention applies to new compendium entries and should be followed when adding content.

**Class Features compendium:** Feature document names in the compendium may include "(ClassName)" for disambiguation (e.g. "Evasion (Rogue)" vs "Evasion (Monk)"). Character sheet, class sheet, and level-up flow show the short name (e.g. "Evasion") from the class data (`featName`), not the compendium document name.

## Common Issues and Solutions

### Compendiums Not Visible

**Problem**: Compendiums don't appear in the Compendium sidebar.

**Solution**: Add `ownership` field to pack definition in `system.json`. Without it, Foundry won't display the compendium.

### "Pack not found" Errors

**Problem**: `game.packs.get(packName)` returns `undefined`.

**Solution**: Use the collection ID format: `thirdera.thirdera_races` not just `thirdera_races`.

### Path Duplication (404 Errors)

**Problem**: File paths like `systems/thirdera/systems/thirdera/packs/...` cause 404 errors.

**Solution**: Normalize paths by removing existing `systems/thirdera/` prefix:
```javascript
let normalizedPath = pack.metadata.path;
if (normalizedPath.startsWith('systems/thirdera/')) {
    normalizedPath = normalizedPath.replace(/^systems\/thirdera\//, '');
}
const basePath = `systems/thirdera/${normalizedPath}`;
```

### Invalid ID Validation Errors

**Problem**: `DataModelValidationError: _id: must be a valid 16-character alphanumeric ID`

**Solution**: Remove invalid `_id` values from JSON before importing. Foundry will generate valid IDs automatically.

### "importDocuments is not a function"

**Problem**: Trying to use `pack.importDocuments()`.

**Solution**: Use `Document.createDocuments()` with pack option:
```javascript
await DocumentClass.implementation.createDocuments(documents, {pack: pack.collection});
```

### "locked compendium" Errors

**Problem**: Cannot create documents in locked compendium.

**Solution**: Unlock the compendium before creating documents:
```javascript
if (pack.locked) {
    await pack.configure({ locked: false });
}
```

### Icon or content updates not appearing after restart

**Problem**: You changed JSON (e.g. `img` paths) and restarted Foundry, but the compendium still shows old icons or content.

**Cause**: Foundry stores compendium data in **LevelDB files** (`.ldb`, `CURRENT`, `LOG`, `MANIFEST-*`, etc.) inside each pack directory. The loader updates existing documents by name; if the server or index keeps serving cached data, or updates don't persist as expected, the pack continues to show old values.

**Solution**: Clear the pack's LevelDB cache so the loader re-imports from JSON (it will create all documents fresh). **Do this with Foundry fully stopped.**

1. Stop Foundry (close the app or stop the headless process).
2. From the repo root, remove only the LevelDB files in the pack directory (do **not** delete the `.json` source files):

   ```bash
   # Class Features pack
   rm -f packs/features/*.ldb packs/features/CURRENT packs/features/LOCK packs/features/LOG packs/features/LOG.old packs/features/MANIFEST-*
   ```

3. Start Foundry and load the world. The loader will see an empty pack and run `createDocuments()` for all JSON files, so the new `img` and content will appear.

To clear another pack (e.g. `packs/races`), use the same pattern: delete `*.ldb`, `CURRENT`, `LOCK`, `LOG`, `LOG.old`, `MANIFEST-*` in that directory only.

## Best Practices

1. **Always include `ownership`** in pack definitions
2. **Use underscores in pack names** (not dots) for V14 compatibility
3. **Remove invalid `_id` values** from JSON before importing
4. **Unlock compendiums** before creating/updating documents
5. **Use collection IDs** (`systemId.packName`) when looking up packs
6. **Normalize file paths** to avoid duplication
7. **Update existing items** by name to support content updates
8. **Verify icon paths** exist in Foundry's icon set
9. **Match JSON structure** to the TypeDataModel schema exactly
10. **Test after changes** - restart Foundry and verify compendiums populate correctly

## Current Compendium Status

### Complete
- **Races**: 7 items (all SRD races); compendium entries **update from `packs/races/*.json`** on each GM world load (see Races pack section above). Numeric racial modifiers use **`system.changes`** (same entries as feats/conditions: `ability.str` … `ability.cha`, `skill.<key>`, saves, etc.); legacy `abilityAdjustments` in old worlds is migrated on load. Shipped data includes **unconditional** SRD racial skill and save adjustments where they map to a single canonical key (e.g. elf +2 Listen/Search/Spot, halfling +1 Fort/Ref/Will and +2 Climb/Jump/Listen/Move Silently, Small races’ +4 Hide). Situational bonuses (dwarf vs poison/spells, elf vs enchantment, attack vs favored enemies, thrown-only attacks, stone-only Craft/Appraise, etc.) are **not** encoded as flat `changes` rows so the bag is not overstated—handle those at the table or in future structured grants (CGS). **`system.cgsGrants.senses`** (race sheet) and optional **`system.cgsGrants.grants`** supply CGS when this race is owned on a character; numeric ability adjustments stay in **`changes`**. **`system.otherRacialTraits`** holds rich text for additional racial qualities (vision, languages, immunities, etc.); see the Races pack section above.
- **Classes**: 11 items (all SRD base classes)
- **Skills**: 36 items (all SRD skills)
- **Feats**: 86 items (all SRD feats - General, Fighter Bonus, Metamagic, Item Creation). Most feats stay **GMS** (`system.changes`) or prose; add **`system.cgsGrants`** when the SRD grants a fixed spell-like ability or typed defense that maps cleanly to a CGS category (use **`spellKey`** until the compendium resolver fills **`spellUuid`**).
- **Class features** (`packs/features/`): exemplar **`system.cgsGrants`** rows ship for unambiguous SRD cases—**`spellGrant`** + **`spellKey`** (e.g. paladin Detect Evil at will, monk Abundant Step 1/day as *dimension door*), **`immunity`** tags (e.g. poison, disease). Many features remain prose-only until automation warrants a structured row.
- **Armor**: 18 items (SRD armor types, shields, plus **adamantine** breastplate and full plate exemplars with **`cgsGrants`** damage reduction)
- **Weapons**: 59 items (SRD weapons plus **javelin of lightning** exemplar with **`spellGrant`** / **`spellKey`**)
- **Spells**: 500+ items (SRD 0–9)

### Incomplete
- **Equipment**: 67 JSON items (mundane adventuring gear plus a small **magic** slice—goggles of night, rings, winged boots—with **`system.cgsGrants`** and **`mechanicalApplyScope`** where appropriate). General SRD equipment coverage remains incremental, not exhaustive.

## Capability grants (CGS) in pack JSON

Structured grants belong in **`system.cgsGrants`** (and spell target restrictions on **`system.targetCreatureType*`**), not in numeric **`system.changes`**. See [Development — Capability grants](development.md#capability-grants-structured-effects-parallel-to-the-modifier-system) for categories and merge behavior.

### Stable keys vs compendium UUIDs

Foundry assigns **document UUIDs** when compendium items are created. Pack **source JSON** under `packs/` usually does **not** include those UUIDs. Authors therefore use **stable keys** that match **`system.key`** on Creature Type, Subtype, and Spell items; the GM **ready** hook runs **`CompendiumLoader.resolveCgsReferenceKeysInPacks()`** (after JSON import) and writes resolved UUIDs into the live compendium documents.

| Location | Authoring fields | Resolved to |
|----------|------------------|-------------|
| Spells | **`system.key`** (slug, e.g. `holdPerson` — use `node scripts/add-spell-keys-from-filename.mjs` after adding spells) | Used to resolve **`spellGrant.spellKey`** in other items |
| Spells | **`system.targetCreatureTypeKeys`**, **`system.targetCreatureSubtypeKeys`** (match **`system.key`** on type/subtype items) | **`system.targetCreatureTypeUuids`** (types and subtypes share one list for targeting) |
| Armor, weapons, equipment | **`system.mechanicalCreatureGateTypeKeys`**, **`system.mechanicalCreatureGateSubtypeKeys`** | **`system.mechanicalCreatureGateUuids`** |
| **`cgsGrants.grants`** on feats, features, races, conditions, gear | **`spellKey`** on `{ "category": "spellGrant", … }`; **`typeKey`** / **`subtypeKey`** on overlay grants | **`spellUuid`**, **`typeUuid`**, **`subtypeUuid`** |

Git remains the source of truth: keep **keys** in JSON; compendium copies gain UUIDs at runtime. Re-import pack JSON (system setting **Re-import compendium JSON on each load**) to refresh from disk, then resolution runs again.

### Feats and class features (Phase 2 pack authoring)

- **Class features** are the primary place for fixed **spell-like** lines from the SRD (paladin/monk/etc.): add **`spellGrant`** with **`spellKey`** matching **`system.key`** on the spell item (see `feature-paladin-detect-evil.json`, `feature-monk-abundant-step.json`). Use **`atWill`: true** or **`usesPerDay`** when the rules match a single static bucket; skip or document in **`label`** when uses scale oddly (e.g. weekly **remove disease**) so the sheet does not over-claim automation.
- **Feats** use the same **`cgsGrants`** shape; the core SRD feat list rarely grants a single fixed SLA, so most entries omit CGS until a clear case appears (metamagic, numeric bonuses, and open-ended choices stay out of CGS).

### Gear (Phase 3 — armor, weapons, equipment)

- **Armor / weapons / equipment** share **`system.cgsGrants`** (senses on the **`senses`** array; **`spellGrant`**, **`energyResistance`**, **`damageReduction`**, etc. in **`grants`**) and optional **`system.mechanicalApplyScope`** (`equipped` vs `carried`) per Phase 5g. See **`armor-breastplate-adamantine.json`**, **`equipment-magic-goggles-of-night.json`**, **`weapon-magic-javelin-of-lightning.json`** for authoring patterns.
- **Numeric** enhancement bonuses, competence bonuses to skills, and AC from armor still belong in **`system.changes`** (GMS), not duplicated as fake CGS rows.
- **`mechanicalCreatureGateTypeKeys`** / **`SubtypeKeys`** on gear resolve to **`mechanicalCreatureGateUuids`** on GM ready (same pass as spell key resolution).

### Helper scripts (repo root)

- **`node scripts/add-spell-keys-from-filename.mjs`** — sets **`system.key`** on every `packs/spells/spell-*.json` from the filename stem (`spell-hold-person` → `holdPerson`).
- **`node scripts/cgs-seed-spell-target-type-keys.mjs`** — optional starter list of **`targetCreatureTypeKeys`** for common SRD type-limited spells; extend the map as you add more.
- **`node scripts/cgs-monster-pack-template.mjs`** — placeholder pointer for large monster-pack CGS batches; see **`scripts/phase6-migrate-monster-pack.mjs`** for a real migration pattern.

## Adding New Compendium Content

1. Create JSON file in appropriate `packs/` subdirectory
2. Match the TypeDataModel schema exactly
3. Use valid Foundry icon paths
4. Remove or omit `_id` (or use valid 16-char alphanumeric)
5. Add filename to `FILE_MAPPINGS` in `compendium-loader.mjs`
6. Restart Foundry - loader will automatically import/update the content
