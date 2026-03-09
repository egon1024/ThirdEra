# Character sheet

The character sheet is the main interface for player characters. It is organized into tabs; each tab focuses on one area of the character.

## Tabs

- **Description** - Biography and character background. Use the **Edit** button in the header to edit the biography.
- **Attributes** - Contains several subtabs:
  - **Details** - Size, experience points, and next-level threshold.
  - **Scores & Saves** - Ability scores, modifiers, and saving throws.
  - **Skills** - Skill list with ranks, class/cross-class, and modifiers. Skills are derived from your classes and race (class skills, cross-class cost, max ranks).
  - **Feats** - Feats the character has. You can add feats by dragging from compendiums or the Items directory.
  - **Class Features** - Class features granted by your classes, shown by level.
- **Classes** - Class levels and level history. Add a class by dragging a class item from a compendium onto the sheet. The **Level History** panel shows each level’s hit points, class features, feats, and skills gained. You can remove the last level of a class (with optional XP adjustment) from here.
- **Spells** - Spellcasting by class: known/prepared spells, slots per day, domain spells (if any), and cast/prepared counts. See [Spellcasting](#spellcasting) below.
- **Combat** - Hit points, initiative, AC (with breakdown), conditions, and combat-related actions.

The header shows the character’s portrait and token image; you can click the token image to set the prototype token image used on the map.

## Level-up

When the character gains a level in a class:

1. Use **Add Level** (or the level-up flow) for that class.
2. Choose hit points (roll or fixed).
3. Allocate **skill points** for the new level (class and cross-class costs apply).
4. If the character gains a **feat** at this level (e.g. 1st, 3rd, 6th, or a fighter bonus feat), choose one from the list. The list only shows feats the character qualifies for; feats that are not yet available are listed separately with their requirements.
5. Finish to commit the level. Class features, auto-granted feats (e.g. Improved Unarmed Strike for monk), and domain spells (for clerics) are applied automatically where applicable.

Level-down is available from the **Classes** tab: use **Remove Level** on the last level of a class. You can choose to leave XP unchanged or set it to the midpoint or minimum of the new level.

## Skills

Skills come from the character’s classes (class skills) and race (some skills may be excluded). Ranks are tracked per level; the sheet shows total ranks, class vs cross-class, and modifiers. Skill points at each level are determined by class and Intelligence modifier (×4 at 1st level for most classes).

## Feats

Feats can be added by dragging from the Feats compendium (or world items) onto the character sheet. Prerequisites (required feats, BAB, ability scores) are enforced when selecting a feat during level-up; dragging a feat onto the sheet bypasses prerequisite checks (GM override). The sheet shows which feats were gained at which level and supports class-granted bonus feats (e.g. fighter, wizard).

## Spellcasting

If a character has one or more classes with spellcasting enabled:

- **Spells** tab shows a block per spellcasting class: caster type (arcane/divine), preparation style (prepared or spontaneous), spell DC, and slots per day.
- **Known / Available** sub-tab lists spells by class and level; for prepared casters (e.g. wizard) you set how many of each spell are prepared. **Ready to cast** sub-tab shows the shortlist of spells you can cast and their remaining uses.
- **Domain spells** (e.g. cleric domains) appear in a separate section, are always prepared, and use domain slots. They are added automatically when you add a domain to the class.
- Use **Reset prepared** to clear prepared counts and **Reset cast counts (rest)** to restore daily cast usage after a rest.
- **Cast** on a spell in Ready to cast posts the spell to chat with save DC and spell resistance; you can drag a spell to the macro bar to create a “Cast: &lt;Spell&gt;” macro.

Spells are added to the character by dragging from the Spells compendium (or from the Spell List browser). Classes with a “learned” spell list (e.g. wizard) do not auto-add all spells when you add the class; you add spells to the character as the character learns them.

## Experience and level

Current XP and the next-level threshold are on **Attributes → Details**. The sheet header can show an XP progress bar. When you remove a class level, the level-down dialog offers to adjust XP to the midpoint or minimum of the new level.
