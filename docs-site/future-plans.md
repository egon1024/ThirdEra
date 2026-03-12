# Future plans

This page lists planned or possible work. Priorities can change. If you want to contribute, open an issue first so we can align with current focus—see [Contributing](contributing.md).

## In progress or explicitly planned

- **Equipment compendium** — Complete or refine the Equipment pack. The [Compendium guide](compendium-guide.md) lists it as “Incomplete.”
- **Feat prerequisites by UUID** — Ensure all feat prerequisites use document ID/UUID (not name or key), per the project’s [item-references rule](development.md#item-references). The script `scripts/apply-feat-prerequisites.mjs` is related.

## Combat workflow / support

The goal is smoother at-table combat for playtesting without full rules automation. The following order prioritizes playability for playtesters (spell/save flow, rest, initiative, concentration), then character build depth (prestige classes), then higher-level combat (iterative attacks).

**Already implemented:** Apply damage/heal (Phases 2–4): sheet "Apply damage/healing" and "Apply to this token"; chat "Apply" button; weapon "Attack & Damage"; temp HP, nonlethal, healing. See [Testing Apply damage/healing](development.md#testing-apply-damagehealing-phase-2).

**Planned (ordered):**

1. **Roll save from spell message** — From a spell or effect message in chat, let the target (or GM) roll the appropriate save vs. DC and post it.
2. **Rest and natural healing** — Single flow: reset spell slots and cast counts, plus optional natural healing (e.g. 1 HP per character level per day of rest per SRD).
3. **Initiative and combat tracker** — Use `@attributes.initiative.bonus` in system initiative formula (for feats like Improved Initiative); add a "Roll initiative" (or "Add to combat & roll initiative") button on the Combat tab that calls Foundry's `Actor.rollInitiative({ createCombatants: true })`.
4. **Concentration check** — Quick Concentration check (button or prompt when casting) with appropriate DCs (defensive casting, damage, etc.).
5. **Classes Phase 6** — Prestige classes and prerequisites (BAB, skills, feats, spellcasting level).
6. **Later: Iterative attacks / full attack** — Multiple attacks at BAB +6/+11/+16 (currently single attack per weapon).


**Scope:** Attacks of opportunity, flanking, and grid-facing are left to table ruling or modules; the system does not automate them. The same applies to complex special cases (e.g. full grappling automation). Documenting this keeps scope clear.

## Generalized modifier system and magic items

A **generalized modifier system** provides a single, shared way for any source (conditions, equipped items, feats, class features, and later spells) to apply modifiers to actors: ability scores, skills, AC, saves, attack, damage reduction, spell resistance, etc. Conditions already use a subset (AC, saves, speed, attack) via a `changes` array and one aggregation in character `prepareDerivedData`. The system would extend the key set and add equipped items (and other sources) so that all modifiers are aggregated in one place with consistent breakdowns.

**Sequencing:** Implementing the generalized modifier system **before** adding magic items (and other modifier-granting content) is recommended. That way each new content type can use and extend the same pipeline instead of duplicating logic; conditions already fit the pattern.

**Consumers of the modifier system:**

- **Conditions** — Already implemented; condition items with a `changes` array apply via ActiveEffects and the existing aggregation.
- **Feats** — When a feat grants numeric bonuses (e.g. Iron Will +2 Will), the feat item can carry a `changes` array; aggregation includes owned feat items so bonuses flow through the same totals and breakdowns.
- **Class features** — When a class feature is granted (actor has the class at the right level), it can contribute `changes` (e.g. explicit bonuses); "active" features are resolved from the actor's classes and levelHistory, then fed into the same aggregation.
- **Magic items** — All magic item categories below use the same modifier schema when they grant bonuses.

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
- **Testing or linting** — The project has no tests or linters today. ESLint or a minimal test run could be added later if stricter PR checks are desired.
- **Third-party modules** — Document how to build and ship a module that extends ThirdEra, or add a module template, when the need arises.
- **Changelog** — Release notes are currently PR-driven. Optionally add a `CHANGELOG.md` or a “What’s new” page in the docs.
