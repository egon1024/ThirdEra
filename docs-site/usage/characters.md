# Character sheet

The character sheet is the main interface for player characters. It is organized into tabs; each tab focuses on one area of the character.

## Tabs

- **Description** - Biography and character background. Use the **Edit** button in the header to edit the biography.
- **Attributes** - Contains several subtabs:
  - **Details** - Size, experience points, next-level threshold, and **natural healing bonus (per day)** (extra HP recovered when using **Take rest**; see [Spellcasting](#spellcasting)).
  - **Scores & Saves** - Ability scores, modifiers, and saving throws.
  - **Skills** - Skill list with ranks, class/cross-class, and modifiers. Skills are derived from your classes and race (class skills, cross-class cost, max ranks).
  - **Feats** - Feats the character has. You can add feats by dragging from compendiums or the Items directory.
  - **Class Features** - Class features granted by your classes, shown by level.
- **Classes** - Class levels and level history. Add a class by dragging a class item from a compendium onto the sheet. The **Level History** panel shows each level’s hit points, class features, feats, and skills gained. You can remove the last level of a class (with optional XP adjustment) from here.
- **Spells** - Spellcasting by class: known/prepared spells, slots per day, domain spells (if any), and cast/prepared counts. See [Spellcasting](#spellcasting) below.
- **Combat** - Hit points, initiative (bonus matches what you roll; see below), AC (with breakdown), conditions, and combat-related actions. Use **Roll initiative** next to the initiative value to add this actor’s tokens to the **active encounter** (if needed) and roll using Foundry’s combat tracker—the same flow as rolling from the tracker or token UI. You need an active combat and (for creating combatants) a scene on the canvas; the GM can start an encounter on the current scene. You can also apply damage or healing to selected tokens, apply to this character’s token, and roll attack and damage (or a combined Attack & Damage). See [Applying damage and healing](#applying-damage-and-healing) below.

The header shows the character’s portrait and token image; you can click the token image to set the prototype token image used on the map.

## Level-up

When the character gains a level in a class:

1. Use **Add Level** (or the level-up flow) for that class.
2. Choose hit points (roll or fixed).
3. Allocate **skill points** for the new level (class and cross-class costs apply). The flow warns if you overspend the level budget or assign more points to one skill than D&D 3.5 normally allows at that level; remaining points turn red when negative, per-skill overages are highlighted in red with a tooltip, and those overages are still recorded if you keep them. Clicking **Next** with unspent points asks whether you want to continue and keep them unallocated.
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
- Spells that are not on any class list appear under **Manually added spells** in Known. You can add them to **Ready to cast** for a spellcasting class (e.g. Sorcerer) using **Add to ready** (or **Add to ready as** and choose the class when you have multiple). They then appear under that class in Ready to cast and use that class’s DC and spell slots when cast.
- **Domain spells** (e.g. cleric domains) appear in a separate section, are always prepared, and use domain slots. They are added automatically when you add a domain to the class.
- **Take rest…** (Spells → **Ready to cast**) opens a dialog for the day’s rest: optional **natural healing**, optional reset of all spell **cast** counts to 0, and (only if the character has at least one **prepared** spellcasting class) optional reset of all **prepared** counts to 0. Natural healing uses the same HP rules as Combat → Apply healing: amount is **character level** (total level, minimum 1) **plus** any modifier total for the **`naturalHealingPerDay`** key (from feats, conditions, equipped items, race, etc.) **plus** the character’s **natural healing bonus** on **Attributes → Details**. Healing is capped at current max HP; if nothing would change (full HP, no casts to reset, etc.), the posted chat message says there were no changes. You can still use **Reset cast counts (rest)** and **Reset prepared** to apply only those resets without opening the dialog.
- For **spontaneous** casters, each spell row on Ready to cast has a numeric **Cast** field (in addition to the Cast button) so you can correct mistakes or adjust counts manually; **Used** / **Remaining** for the level stay derived from slots minus total cast.
- For prepared casters, use **Reset prepared** to clear prepared counts; use **Reset cast counts (rest)** to restore daily cast usage after a rest (or use **Take rest…** and check only the options you want).
- **Cast** on a spell in Ready to cast posts the spell to chat with save DC and spell resistance; you can drag a spell to the macro bar to create a “Cast: &lt;Spell&gt;” macro.

**Rolling saves from a spell cast:** When the spell has a saving throw (e.g. Fortitude, Reflex, or Will), the cast message in chat shows a **Roll save (…)** button. Click it to open a dialog where you choose which actor rolls the save; the roll is made against the spell's DC. You can also right‑click the message and choose "Roll save vs. spell DC" for the same dialog. If you **select one or more tokens** on the canvas before casting (e.g. the intended targets), the cast message instead lists **Target(s): …** and shows a **Roll save (Name)** button for each target; clicking one rolls that character's or creature's save immediately, with no picker. When no tokens are selected (or when casting from a macro), you get the single Roll save button and picker.

**Concentration from a spell cast:** The same cast message can show **Concentration (defensive)** (DC 15 + spell level, for casting defensively) and **Concentration (other)…** (opens a dialog: damage taken for DC 10 + damage + spell level, or a fixed custom DC). Right‑click the message and choose **Roll Concentration…** for the same dialog as “other.” You must **own** the caster (or be GM). The character needs the **Concentration** skill or a modifier-only Concentration entry under **Attributes → Skills**; otherwise the system warns and does not roll.

**Spell penetration from a spell cast:** For spells whose SR line is **Yes** or **Yes (harmless)** on the spell item, and if you **own** the caster (or are GM), the cast message can show **Spell penetration** buttons. You roll **1d20 + caster level** for this cast vs the target’s SR (meet or beat). If you had **tokens selected** when casting and at least one target has SR greater than zero, you get one button per such target. Otherwise use **Spell penetration…** to pick a creature with SR (you must be able to **observe** that actor unless you are the GM). Harmless spells: the table may still show the button; the GM or players **skip the roll** when the target is willing or SR does not apply—Foundry does not auto-detect willingness. Set **Spell resistance** on **Attributes → Details** for PCs; NPCs use the stat block SR field. **Older cast messages** from before the system stored caster level on the message will not offer penetration buttons; cast again or roll manually if needed (see [Development — Spell cast chat](../development.md#spell-cast-chat-message-flags-save-concentration-spell-penetration)).

Spells are added to the character by dragging from the Spells compendium (or from the Spell List browser). Classes with a “learned” spell list (e.g. wizard) do not auto-add all spells when you add the class; you add spells to the character as the character learns them.

## Applying damage and healing

From the **Combat** tab you can apply damage or healing to tokens without editing HP by hand:

- **Apply damage/healing** — Select one or more tokens on the canvas, then click **Apply damage/healing**. Enter the amount and choose Damage or Healing; temp HP is reduced first for damage, and healing removes lethal damage before reducing nonlethal. You can optionally apply as **nonlethal damage** when dealing damage.
- **Apply to this token** — If this character has a token on the current scene, **Apply to this token** opens the same dialog with that token as the only target (no selection needed).

Weapon rows offer **Attack** (d20), **Damage**, and **Attack & Damage** (one message with both rolls). On any damage or healing roll posted to chat (including Attack & Damage), an **Apply** button appears; select target tokens and click **Apply** to open the dialog with the roll’s total pre-filled. You can also open the dialog from a macro: `game.thirdera.applyDamageHealing.openDialog()` or `game.thirdera.applyDamageHealing.openWithOptions({ targetActors, amount, mode, nonlethal })`.

## Effective creature types (GM tools and macros)

**Supported today:** Third Era computes **mechanical** creature types and subtypes as the **union** of an NPC’s primary **Details** classification (**creature type** + **subtype** UUIDs) and any **CGS overlay** grants (feats, items, conditions, actor mechanics, etc.). That merged view is what sheets show under **Additional creature types (active)** and what the code means by *effective* types (see [Development — Capability grants](../development.md#capability-grants-structured-effects-parallel-to-the-modifier-system)).

- **GMs:** Right-click a **world** actor in the **Actors** sidebar → **Show effective creature types (mechanical)** → notification with resolved type/subtype names.
- **Macros / console** (after the world is **ready**): `game.thirdera.effectiveCreatureTypes.getFromActor(actor)`, `.getDisplayText(actor)`, `.notify(actor)`, plus `.includesUuid` / `.includesAnyUuid` for custom logic.

**Not in core yet:** Automated rules that *depend* on creature type (turning, favored enemy, type-only spells, gear restrictions, etc.) are **not** enforced by the system—you still adjudicate those at the table. **Token vision on the map** does **not** follow CGS effective senses. **Wild shape / full form replacement** is **not** modeled as replacing primary type for all checks (overlays are additive only for now).

When core gains new type-based automation, this page and [Development](development.md) should be updated in the same release so “supported vs not yet” stays accurate.

## Experience and level

Current XP and the next-level threshold are on **Attributes → Details**. The sheet header can show an XP progress bar. When you remove a class level, the level-down dialog offers to adjust XP to the midpoint or minimum of the new level.
