/**
 * Unified modifier aggregation for ThirdEra.
 * Any source (conditions, feats, race via system.changes, equipped items, future types) can contribute
 * modifiers by adhering to the modifier-source interface. This module provides the
 * canonical key set, provider registry, and getActiveModifiers(actor).
 *
 * @see docs-site/development.md (Modifier system), .cursor/plans/future-features.md (GMS out of scope)
 * @see docs-site/development.md (Modifier system)
 */

import { getActorEffectsList, getConditionItemsMapSync, getEffectStatusIds } from "./condition-helpers.mjs";

// ---------------------------------------------------------------------------
// Canonical modifier key set
// ---------------------------------------------------------------------------

/** Fixed modifier keys (AC, saves, attack, initiative, speed, acLoseDex, etc.). */
const FIXED_MODIFIER_KEYS = new Set([
    "ac", "acLoseDex", "speedMultiplier",
    "saveFort", "saveRef", "saveWill",
    "attack", "attackMelee", "attackRanged",
    "naturalHealingPerDay",
    "initiative"
]);

/** Ability keys: ability.str, ability.dex, etc. */
const ABILITY_KEYS = new Set(["str", "dex", "con", "int", "wis", "cha"]);

/**
 * Whether a modifier key is in the canonical set.
 * Canonical keys: fixed set, ability.<abil>, skill.<skillKey>.
 * @param {string} key
 * @returns {boolean}
 */
export function isCanonicalModifierKey(key) {
    const k = (key || "").trim();
    if (!k) return false;
    if (FIXED_MODIFIER_KEYS.has(k)) return true;
    if (k.startsWith("ability.")) {
        const abil = k.slice("ability.".length);
        return ABILITY_KEYS.has(abil);
    }
    if (k.startsWith("skill.")) return true;
    return false;
}

/**
 * Sum numeric values in a `system.changes`-style array for one modifier key (e.g. `ability.dex`).
 * Used for the actor sheet **racial** column: breakdown entries use per-change labels, so filtering
 * `mods.breakdown` by `label === race.name` misses race rows when authors set row labels.
 *
 * @param {Array<{key?: string, value?: unknown}>|undefined|null} changes
 * @param {string} modifierKey  Canonical key to match (trimmed)
 * @returns {number}
 */
export function sumChangeValuesForModifierKey(changes, modifierKey) {
    if (!Array.isArray(changes) || !modifierKey) return 0;
    const want = String(modifierKey).trim();
    if (!want || !isCanonicalModifierKey(want)) return 0;
    let sum = 0;
    for (const c of changes) {
        const k = (c?.key || "").trim();
        if (k !== want) continue;
        const v = Number(c?.value);
        if (!Number.isNaN(v)) sum += v;
    }
    return sum;
}

/**
 * Keys that are combined by multiplication (e.g. speedMultiplier). Default 1 when absent.
 */
const MULTIPLICATIVE_KEYS = new Set(["speedMultiplier"]);

/**
 * Keys where any non-zero value is treated as 1 (boolean-like). Used for acLoseDex.
 */
const MAX_OR_ONE_KEYS = new Set(["acLoseDex"]);

/** Export for CONFIG and docs. */
const MODIFIER_KEY_LIST = [
    ...FIXED_MODIFIER_KEYS,
    ...Array.from(ABILITY_KEYS).map(a => `ability.${a}`),
    "skill.<skillKey>" // pattern: any skill key from CONFIG/skills
];

// ---------------------------------------------------------------------------
// Modifier bag shape
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ModifierBag
 * @property {Object.<string, number>} totals  Per-key total (sum, or product for multiplicative keys, or 0/1 for max-or-one).
 * @property {Object.<string, Array<{label: string, value: number}>>} breakdown  Per-key list of contributions for UI.
 */

/**
 * Run all registered modifier-source providers and merge into one modifier bag.
 * Providers return Array<{ label: string, changes: Array<{ key: string, value: number, label?: string }> }>.
 * Only canonical keys are included. Keys "attack" are applied to both attackMelee and attackRanged.
 *
 * @param {Actor} actor  The actor (character or NPC).
 * @returns {ModifierBag}  { totals, breakdown }
 */
export function getActiveModifiers(actor) {
    const totals = {};
    const breakdown = {};

    const providers = CONFIG.THIRDERA?.modifierSourceProviders ?? [];
    const contributions = [];
    for (const provider of providers) {
        try {
            const result = provider(actor);
            if (Array.isArray(result)) {
                contributions.push(...result);
            } else if (result && Array.isArray(result.contributions)) {
                contributions.push(...result.contributions);
            }
        } catch (e) {
            console.warn("ThirdEra | Modifier provider error:", e);
        }
    }

    for (const { label, changes } of contributions) {
        if (!changes || !Array.isArray(changes)) continue;
        for (const c of changes) {
            const key = (c.key || "").trim();
            const value = Number(c.value);
            if (Number.isNaN(value)) continue;
            const entryLabel = c.label ?? label;

            if (!isCanonicalModifierKey(key)) continue;

            // "attack" contributes to both attackMelee and attackRanged
            const keysToApply = key === "attack" ? ["attackMelee", "attackRanged"] : [key];

            for (const k of keysToApply) {
                if (MAX_OR_ONE_KEYS.has(k)) {
                    const v = value !== 0 ? 1 : 0;
                    if (totals[k] === undefined) totals[k] = 0;
                    if (v > totals[k]) totals[k] = v;
                    if (!breakdown[k]) breakdown[k] = [];
                    if (v) breakdown[k].push({ label: entryLabel, value: v });
                } else if (MULTIPLICATIVE_KEYS.has(k)) {
                    if (totals[k] === undefined) totals[k] = 1;
                    // Only apply when value in (0, 1] (e.g. 0.5 = half speed), matching condition-helpers
                    if (value > 0 && value <= 1) {
                        totals[k] *= value;
                        if (!breakdown[k]) breakdown[k] = [];
                        breakdown[k].push({ label: entryLabel, value });
                    }
                } else {
                    totals[k] = (totals[k] ?? 0) + value;
                    if (!breakdown[k]) breakdown[k] = [];
                    breakdown[k].push({ label: entryLabel, value });
                }
            }
        }
    }

    // Default multiplicative keys to 1 when no contribution
    for (const k of MULTIPLICATIVE_KEYS) {
        if (totals[k] === undefined) totals[k] = 1;
    }

    return { totals, breakdown };
}

// ---------------------------------------------------------------------------
// Conditions provider (adapter: effects → condition items → contributions)
// ---------------------------------------------------------------------------

/**
 * Provider that returns one contribution per active condition (from actor.effects).
 * Uses getConditionItemsMapSync() so safe to call from prepareDerivedData.
 *
 * @param {Actor} actor
 * @returns {Array<{ label: string, changes: Array<{ key: string, value: number }> }>}
 */
function conditionsModifierProvider(actor) {
    const conditionMap = getConditionItemsMapSync();
    const out = [];
    const conditionIdsAdded = new Set(); // One contribution per condition (dedupe across effects)
    const effects = getActorEffectsList(actor);
    for (const effect of effects) {
        const statusIds = getEffectStatusIds(effect);
        if (statusIds.length === 0) continue;
        for (const statusId of statusIds) {
            const conditionId = String(statusId).toLowerCase().trim();
            if (conditionIdsAdded.has(conditionId)) continue;
            const conditionItem = conditionMap.get(conditionId);
            if (!conditionItem) continue;
            const changes = conditionItem.system?.changes ?? [];
            if (changes.length === 0) continue;
            conditionIdsAdded.add(conditionId);
            const label = conditionItem.name || conditionId;
            out.push({
                label,
                changes: changes.map(c => ({
                    key: (c.key || "").trim(),
                    value: Number(c.value),
                    label: (c.label || "").trim() || undefined
                }))
            });
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Item provider (feats, and later equipment/armor/weapon when equipped)
// ---------------------------------------------------------------------------

/**
 * Provider that returns one contribution per owned item that has system.changes
 * and applies (race, feat: always when owned; equipment/armor/weapon: when equipped — Phase 5).
 *
 * @param {Actor} actor
 * @returns {Array<{ label: string, changes: Array<{ key: string, value: number, label?: string }> }>}
 */
export function itemsModifierProvider(actor) {
    const items = actor?.items ?? [];
    const out = [];
    for (const item of items) {
        if (item.type === "race") {
            const changes = item.system?.changes;
            if (!Array.isArray(changes) || changes.length === 0) continue;
            const label = item.name || "Race";
            out.push({
                label,
                changes: changes.map(c => ({
                    key: (c.key || "").trim(),
                    value: Number(c.value),
                    label: (c.label || "").trim() || undefined
                }))
            });
            continue;
        }
        if (item.type === "feat") {
            const changes = item.system?.changes;
            if (!Array.isArray(changes) || changes.length === 0) continue;
            const label = item.name || "Feat";
            out.push({
                label,
                changes: changes.map(c => ({
                    key: (c.key || "").trim(),
                    value: Number(c.value),
                    label: (c.label || "").trim() || undefined
                }))
            });
            continue;
        }
        // Phase 5: armor, weapon, equipment — apply when equipped
        if (item.type === "armor" || item.type === "equipment") {
            if (item.system?.equipped !== "true") continue;
            const changes = item.system?.changes;
            if (!Array.isArray(changes) || changes.length === 0) continue;
            const label = item.name || (item.type === "armor" ? "Armor" : "Equipment");
            out.push({
                label,
                changes: changes.map(c => ({
                    key: (c.key || "").trim(),
                    value: Number(c.value),
                    label: (c.label || "").trim() || undefined
                }))
            });
            continue;
        }
        if (item.type === "weapon") {
            const eq = item.system?.equipped;
            if (eq !== "primary" && eq !== "offhand") continue;
            const changes = item.system?.changes;
            if (!Array.isArray(changes) || changes.length === 0) continue;
            const label = item.name || "Weapon";
            out.push({
                label,
                changes: changes.map(c => ({
                    key: (c.key || "").trim(),
                    value: Number(c.value),
                    label: (c.label || "").trim() || undefined
                }))
            });
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Registration (call from thirdera.mjs init)
// ---------------------------------------------------------------------------

/**
 * Set CONFIG.THIRDERA.modifierKeys and register built-in modifier-source providers.
 * Call once from Hooks.once("init") after CONFIG.THIRDERA exists.
 */
export function registerModifierSourceProviders() {
    if (!CONFIG.THIRDERA) return;
    CONFIG.THIRDERA.modifierKeys = Object.freeze([...MODIFIER_KEY_LIST]);
    const reg = CONFIG.THIRDERA.modifierSourceProviders;
    if (!Array.isArray(reg)) return;
    reg.push(conditionsModifierProvider);
    reg.push(itemsModifierProvider);
}
