# Future plans

This page lists planned or possible work. Priorities can change. If you want to contribute, open an issue first so we can align with current focus—see [Contributing](contributing.md).

## In progress or explicitly planned

- **Creature features item type** — Dedicated item type and compendium path for structured monster special qualities (SRD monster pack is complete; this reduces rework vs. freeform stat-block text only). Coordinate via issue or maintainer channel before large contributions so scope matches current priorities.
- **CGS follow-ups** — Core **capability grants** (senses, suppression, spell/SLA grants, typed defenses, overlays, gear apply scope, monster JSON + NPC migration) are **in core**, plus **gear creature-type gates** (`mechanicalCreatureGateUuids`) and optional **custom defense label** items (**`defenseCatalog`**) for extending how immunities, resistances, and DR bypasses read on sheets. **Pack JSON** can author **keys** (`spellKey`, `targetCreatureTypeKeys`, `mechanicalCreatureGateTypeKeys`, …) resolved to compendium UUIDs on load — see [Compendium guide — CGS in pack JSON](compendium-guide.md#capability-grants-cgs-in-pack-json). Remaining work includes further **effective-type consumers** (favored enemy, turning, …), optional incremental **`cgsGrants`** authoring, and **map vision** from effective senses (deferred). **Future idea — grant activation gates:** optional conditions on **whether a grant is active** (merged but suppressed with provenance), e.g. **encumbrance load band** (light / medium / heavy) and **global loadout** (unarmed-only, requires worn armor, disallowed in heavy armor, shield present, etc.) — separate from per-item **`mechanicalApplyScope`** (whether that item’s modifiers and CGS contribute at all). See [Development — Capability grants](development.md#capability-grants-structured-effects-parallel-to-the-modifier-system).
- **Automated testing** — **Vitest** and **`make test`** / **`make test-coverage`** run in **Validate** CI; coverage matrix in **`test/README.md`** (repo root). **Ongoing:** extend tests when touching `module/logic/` and pure helpers. Optional **Quench** (in-Foundry) remains under consideration (see **Under consideration** below). No replacement for manual in-world verification.
- **Equipment compendium** — Complete or refine the Equipment pack. The [Compendium guide](compendium-guide.md) lists it as “Incomplete.”
- **Feat prerequisites by UUID** — Ensure all feat prerequisites use document ID/UUID (not name or key), per the project’s [item-references rule](development.md#item-references). The script `scripts/apply-feat-prerequisites.mjs` is related.

## Character advancement (level-up)

### Extended bonus feat slots

**Supported today:** the level-up flow may offer **one optional** player-chosen feat when **total character level** after the new level is **1, 3, 6, 9, 12, 15, or 18** (SRD general schedule) **and/or** the class being leveled is named **Fighter** (case-insensitive) and that class’s new level matches the **SRD fighter bonus feat** schedule; the picker lists feats that pass **prerequisites**, and **fighter bonus** picks are limited to feats marked **`fighterBonusEligible`**.

**Not in core yet (planned):** **data-driven** extra feat slots on **class** and **race** items (e.g. human +1 feat at 1st, wizard bonus feats at 5th/10th/15th/20th), **multiple** player-chosen feats on the **same** level when rules stack (e.g. Fighter 1 at character level 1), **class feature** definitions that trigger a feat step with **custom eligible pools** (e.g. metamagic-only lists), **stable class identity** (not display name) for fighter-like schedules, **`levelHistory`** (or equivalent) able to record **more than one** chosen feat per level, and **mandatory** feat selection when a slot applies. Implement in **progression / level-up** (`LevelUpFlow` and related data), not CGS. User-facing summary: [Characters — Level-up](usage/characters.md#level-up).

## Combat workflow / support

The goal is smoother at-table combat for playtesting without full rules automation. **For current maintainer priorities** (ordering of automation vs. spell/combat work), open a **[GitHub issue](https://github.com/egon1024/ThirdEra/issues)** or check recent releases—the numbered list below is a **product** roadmap snapshot and may lag individual shipped features.

The following order prioritized playability for playtesters (spell/save flow, initiative, concentration), then character build depth (prestige classes), then higher-level combat (iterative attacks). **Initiative, concentration from cast chat, roll save from spell messages, spell targeting, and mechanical conditions** are **implemented**—see [Development](development.md).

**Already implemented:** Apply damage/heal (Phases 2–4): sheet "Apply damage/healing" and "Apply to this token"; chat "Apply" button; weapon "Attack & Damage"; temp HP, nonlethal, healing (see [Development reference](development.md) and `module/logic/apply-damage-healing*.mjs`). **Roll save from spell message:** Cast messages store save DC and type; "Roll save" button and context menu let the target (or GM) roll the appropriate save vs. DC. **Spell targeting:** When casting from the sheet, selected tokens are recorded as targets on the message; "Roll save (Target name)" buttons allow one-click rolls per target. **Rest and natural healing:** **Take rest…** on Spells → Ready to cast opens a dialog for optional natural healing (level + modifier key `naturalHealingPerDay` + **Attributes → Details** bonus), optional reset of spell cast/prepared counts, and a chat summary (or “no changes”). See [Character sheet — Spellcasting](usage/characters.md#spellcasting) and [Development — Rest and natural healing](development.md#rest-and-natural-healing).

**From this list — still open vs done:**

1. ~~**Initiative and combat tracker**~~ — **Done** (`@attributes.initiative.bonus`, Combat tab **Roll initiative**).
2. ~~**Concentration check**~~ — **Done** (cast chat, defensive/damage DCs; see Development — Spell cast chat).
3. ~~**Conditions with mechanical effects**~~ — **Done** (GMS `changes` on conditions; generalized modifier system on characters and NPCs).
4. **Classes Phase 6** — Prestige classes and prerequisites (BAB, skills, feats, spellcasting level).
5. **Later: Iterative attacks / full attack** — Multiple attacks at BAB +6/+11/+16 (currently single attack per weapon).


**Scope:** Attacks of opportunity, flanking, and grid-facing are left to table ruling or modules; the system does not automate them. The same applies to complex special cases (e.g. full grappling automation). Documenting this keeps scope clear.

## Generalized modifier system and magic items

The **generalized modifier system** (Phases 1–7 complete) provides a single pipeline for any source to apply modifiers to actors: ability scores, skills, AC, saves, attack, speed, etc. Character and NPC both call `getActiveModifiers(actor)` once in `prepareDerivedData`; ability deltas, then AC, speed, saves, attack, and skills use the same modifier bag. Design: [development.md](development.md) (Modifier system). Further extension ideas appear under **Planned extensions** and **Magic item categories** on this page.

**Capability grants (CGS):** The **structured capability-grant channel** (**CGS**) is **in core today**—senses, suppression, spell/SLA grants, typed defenses, creature-type overlays, and related merge/provenance—parallel to numeric GMS. See [Development — Capability grants](development.md#capability-grants-structured-effects-parallel-to-the-modifier-system) for **what is supported vs not yet** (type-based combat automation, map vision from effective senses, etc.). Sense-like and other structured grants belong in **`system.cgsGrants`**, not fake GMS keys; numeric bonuses stay in **`system.changes`**.

**Current sources:** Conditions (via ActiveEffects), race (optional `system.changes`, same as feats), feats (optional `system.changes`), and equipped armor/weapons/equipment (optional `system.changes` when equipped). Skill modifiers and breakdowns, including “modifier-only” skills and a shared key UI (e.g. skill picker), are implemented. Extenders can add providers to `CONFIG.THIRDERA.modifierSourceProviders` or implement `getModifierChanges(actor)` on items; see [Development — Modifier system](development.md#modifier-system-modulelogicmodifier-aggregationmjs).

**Planned extensions:**

- **Class features** — When a class feature is granted (actor has the class at the right level), it could contribute `changes`; a provider would resolve active features from levelHistory and feed them into the same aggregation.
- **Magic items** — All magic item categories below would use the same modifier schema when they grant **numeric** bonuses; sense-like and other structured grants use **CGS** on the item (`system.cgsGrants`) where applicable (see [Development — Capability grants](development.md#capability-grants-structured-effects-parallel-to-the-modifier-system)).

**Magic item categories (depend on modifier system):**

- **Spell-completion (rods, staffs, wands)** — Primarily grant use of specific spell(s) with charges; use the modifier system only if they also grant passive bonuses.
- **General magic items** — Magic armor, weapons, wondrous items (belts, cloaks, etc.) that grant bonuses (+1 AC, +2 Str, +5 Swim, DR 5/magic, etc.). When equipped, their `changes` are applied via the shared pipeline.
- **Artifacts** — Same modifier schema; may have many effects and/or special rules (e.g. one artifact active).
- **Intelligent items** — Same modifier schema for bonuses; add Ego, communication, and conflict behavior on top.
- **Cursed items** — Same modifier schema (often negative); add rules for when they apply (e.g. always active while in inventory, or cannot unequip until uncursed).

## Release and docs setup

- **First release and docs redirect** — Run one full release (merge a PR with a version tag), confirm the release workflow and mike deploy, then run `mike set-default --push latest` once so the docs site root redirects to “latest” (if not already done).

## Under consideration

- **Temporary hit points** — Track and apply temp HP (e.g. from spells, class features) with appropriate ordering vs. normal damage and healing.
- **Below 0 hit points** — Mechanics for being at or below 0 HP: dying, disabled, stable, death at −10 (or variant rules); integration with derived conditions (Dead, Dying, Disabled, Stable) and rest/healing.
- **Losing more than half hit points** — Rules for having lost more than half your HP (e.g. disabled when at 0, or half-HP–based effects); support in sheet and automation where useful.
- **Party XP calculator** — A tool to automatically calculate and award XP for a party (e.g. by CR/EL, or from encounter totals divided by party size).
- **Foundry V14** — Document whether the system is “v13 only” or “v13 with V14 in mind.” Pack names are already V14-friendly; a short compatibility checklist could be added when relevant.
- **Linting** — ESLint or similar could replace the **Validate** workflow’s placeholder **lint** job when stricter PR checks are desired. **Vitest** already runs in CI (see **In progress or explicitly planned** above).
- **Third-party modules** — Document how to build and ship a module that extends ThirdEra, or add a module template, when the need arises.
- **Changelog** — Release notes are currently PR-driven. Optionally add a `CHANGELOG.md` or a “What’s new” page in the docs.
