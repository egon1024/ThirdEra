# Future plans

This page lists planned or possible work. Priorities can change. If you want to contribute, open an issue first so we can align with current focus—see [Contributing](contributing.md).

## In progress or explicitly planned

- **Equipment compendium** — Complete or refine the Equipment pack. The [Compendium guide](compendium-guide.md) lists it as “Incomplete.”
- **Feat prerequisites by UUID** — Ensure all feat prerequisites use document ID/UUID (not name or key), per the project’s [item-references rule](development.md#item-references). The script `scripts/apply-feat-prerequisites.mjs` is related.

## Combat workflow / support

The goal is smoother at-table combat for playtesting without full rules automation. The following are candidate features or considerations; prioritization can stay flexible.

- **Apply damage/heal** — Apply the total from a damage or healing roll (in chat or from the sheet) to selected token(s) or a chosen actor. **Phase 2 (entry points)** and **Phase 3 (temp HP, nonlethal)** are implemented: temp HP is damaged first per SRD; optional “Apply as nonlethal damage” in the dialog; healing applies to lethal first, then remainder reduces nonlethal. Chat “Apply” button and context menu; sheet “Apply damage/healing” and “Apply to this token”; macro `game.thirdera.applyDamageHealing.openDialog()` or `openWithOptions({ targetActors, amount, mode, nonlethal })`. See [Testing Apply damage/healing (Phase 2)](development.md#testing-apply-damagehealing-phase-2) and [Phase 3](development.md#testing-apply-damagehealing-phase-3) for manual test steps.
- **Rest and natural healing** — A single flow that resets spell slots and cast counts, plus optional natural healing (e.g. 1 HP per character level per day of rest per SRD).
- **Concentration check** — A quick Concentration check (e.g. button or prompt when casting in a threatened area) with appropriate DCs (defensive casting, damage, etc.).
- **Conditions with mechanical effects** — Ensure condition compendium items have `changes` (AC, saves, speed) populated where applicable so applying Blinded, Shaken, etc. updates the sheet automatically.
- **Roll save from spell message** — From a spell or effect message in chat, let the target (or GM) roll the appropriate save vs. DC and post it.

**Scope:** Attacks of opportunity, flanking, and grid-facing are left to table ruling or modules; the system does not automate them. The same applies to complex special cases (e.g. full grappling automation). Documenting this keeps scope clear.

## Release and docs setup

- **First release and docs redirect** — Run one full release (merge a PR with a version tag), confirm the release workflow and mike deploy, then run `mike set-default --push latest` once so the docs site root redirects to “latest” (if not already done).

## Under consideration

- **Foundry V14** — Document whether the system is “v13 only” or “v13 with V14 in mind.” Pack names are already V14-friendly; a short compatibility checklist could be added when relevant.
- **Testing or linting** — The project has no tests or linters today. ESLint or a minimal test run could be added later if stricter PR checks are desired.
- **Third-party modules** — Document how to build and ship a module that extends ThirdEra, or add a module template, when the need arises.
- **Changelog** — Release notes are currently PR-driven. Optionally add a `CHANGELOG.md` or a “What’s new” page in the docs.
