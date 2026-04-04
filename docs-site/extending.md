# Extending ThirdEra

This page is for **extenders**: anyone adding compendiums, modules, or new content to the system without necessarily changing its core code. It explains how the system is structured so you can add races, classes, feats, spells, or third-party packs that work with ThirdEra.

## Data-driven design

ThirdEra does not hardcode game content. Races, classes, skills, feats, spells, weapons, armor, equipment, schools, conditions, creature types, and subtypes are all **item types** with their own schemas. Characters and NPCs are **actor types** with type-specific data (e.g. ability scores and spellcasting for characters; stat block and creature type for NPCs). Derived values (ability modifiers, saves, AC, initiative) are computed on the data models when documents are prepared.

When you add new content, you use these same item types. The system is designed so that additional compendiums or world items can extend or override content without forking the core code.

## References between documents

References between documents (e.g. “this feat requires that feat”, “this class grants this feature”) must use **document ID or UUID**, not names or keys. That keeps compendium and world documents unambiguous and stable when names or keys change. When you create feats with prerequisites, class features that grant feats, or similar links, store the target document’s ID or UUID.

## Compendiums

The **source of SRD content** (races, classes, feats, spells, etc.) is compendium packs. A **CompendiumLoader** runs when a world is loaded and creates or updates compendium documents from source data, so content can be revised (e.g. name or key changes) without duplicating entries. Third-party compendiums or modules can provide additional content using the same item types and structure.

For how to create and manage compendiums (pack definition, JSON layout, loader behavior), see the **[Compendium guide](compendium-guide.md)** on this site.

## Configuration

Configuration that drives sheets and logic (sizes, damage types, movement maneuverability, etc.) lives in **CONFIG.THIRDERA**. The system uses this at runtime; you do not need to modify it to add new races, classes, or items—they are data, not config.

## Modifier system (adding new sources)

The system uses a **unified modifier pipeline**: conditions, feats, race, and gear items contribute modifiers through a single aggregation (gear defaults to equipped/wielded only; optional `system.mechanicalApplyScope: "carried"` applies `changes` while the item is on the actor’s inventory, with the same flag used for **capability grants** on that item). If you add a new item type or effect that should grant numeric bonuses (e.g. to AC, saves, ability scores, skills), you can plug in without changing core code:

- **Register a provider:** Push a function `(actor) => Array<{ label, changes }>` to `CONFIG.THIRDERA.modifierSourceProviders`. See [Development — Modifier system](development.md#modifier-system-modulelogicmodifier-aggregationmjs) for the full contract and canonical keys.
- **Item method:** Implement `getModifierChanges(actor)` on your item type returning `{ applies, changes }`; the built-in item provider will call it and merge when `applies` is true.

**Natural healing (Take rest):** To grant extra hit points recovered per day of rest, use the canonical modifier key **`naturalHealingPerDay`** in `changes` (same shape as other GMS keys). The **Take rest** dialog sums `getActiveModifiers(actor).totals.naturalHealingPerDay` with character level and the character’s **`system.details.naturalHealingBonus`** field. See [Development — Rest and natural healing](development.md#rest-and-natural-healing) and [Character sheet — Spellcasting](usage/characters.md#spellcasting).

**Initiative (combat):** Use the canonical key **`initiative`** in feat, race, condition, or equipped-item `changes` for flat bonuses or penalties (e.g. Improved Initiative +4, Deafened −4). The character and NPC data models add the aggregated total to Dexterity mod for `attributes.initiative.bonus`. The package **`initiative`** formula in `system.json` must stay aligned with that field (default: `1d20 + @attributes.initiative.bonus`); Foundry evaluates `@` paths from the actor’s roll data (`getRollData()` → system). See [Development — Initiative and combat](development.md#initiative-and-combat).

For GM-facing world options (e.g. track currency weight, audit log, first-level full HP), see **[World configuration](usage/world-configuration.md)** in the Usage section.

## Changing the core code

If you are working on the repository itself (entry points, file layout, conventions, Foundry v13 behavior), use the **[Development](development.md)** page on this site. It is the single reference for architecture, conventions, and operational notes when contributing to the codebase.
