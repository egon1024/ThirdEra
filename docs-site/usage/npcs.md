# NPCs

NPCs (non-player characters) use a dedicated sheet with tabs for description, attributes, combat, and equipment. The sheet is optimized for creatures and monsters rather than full character advancement.

## NPC sheet tabs

- **Description** - Biography and notes for the NPC.
- **Attributes** - **Details** subtab: Challenge Rating, alignment, size, **Creature Type** and **Subtypes** (drag type/subtype items from compendiums). **Scores & Saves** subtab: ability scores and saving throws. **Feats** and **Class Features** subtabs mirror the character sheet: **From class levels** (when the NPC has class levels) and **Feature items on character** for embedded items; click a granted-from-levels row to open the compendium or world feature item. Drag feats or features from compendiums onto the sheet to add embedded items.
- **Combat** - Hit points (including temp HP and nonlethal), AC (including natural armor from the stat block), initiative, and a **Stat block** section (see below). **Roll initiative** (beside the initiative bonus) uses the **active encounter**: it adds this NPC’s tokens to combat if needed and rolls through Foundry’s combat tracker, same as the core tracker controls. **Apply damage/healing** and **Apply to this token** work the same as on the character sheet (see [Applying damage and healing](characters.md#applying-damage-and-healing) in Characters). You can add **Conditions** via the Conditions block (drag condition items or choose from the dropdown). Natural attacks and movement are also configured here.
- **Equipment** - Weapons, armor, and other equipment. Add items by dragging them onto the sheet (there are no “Add weapon/armor” buttons; use drag-and-drop from compendiums or the Items directory).

## Stat block

The **Combat** tab includes a **Stat block** area that mirrors a typical D&D 3.5 stat block:

- **Defense** - Natural armor (applied to AC; the AC breakdown shows “Natural +X” when set).
- **Space and reach** - Defaults (e.g. 5 ft) or custom values.
- **Natural attacks** - List of natural weapons (e.g. bite, claws) with attack dice, damage type, and primary/secondary. Buttons to roll attack and damage are on each entry.
- **Movement** - Land, fly (with maneuverability), swim, burrow, climb. The sheet shows a combined movement line (e.g. “30 ft, fly 60 ft (average)”).
- **Special** - Damage reduction, spell resistance, senses (e.g. darkvision, low-light, scent), and a freeform “Other special abilities” field.
- **Reference** - Environment, organization, treasure, advancement, and level adjustment for reference during play.

These fields are optional; fill in what you need for the creature.

## Conditions

NPCs can have conditions applied the same way as characters: drag a condition from the Conditions compendium (or world) onto the sheet, or select from the Conditions dropdown on the Combat tab. Conditions can affect AC, saves, speed, and attacks when they have mechanical effects defined. Some conditions (e.g. Dead, Dying, Flat-Footed) are derived automatically from hit points or combat state.

## Creature type and subtypes

Creature Type and Subtype are item types with compendiums (**Creature Types** and **Subtypes**). Drag the appropriate type and subtypes onto the NPC’s sheet from the compendium sidebar to set them; they appear in **Attributes → Details**.
