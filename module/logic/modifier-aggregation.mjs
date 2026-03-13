/**
 * Unified modifier aggregation for ThirdEra.
 * Any source (conditions, feats, race, equipped items, future types) can contribute
 * modifiers by adhering to the modifier-source interface. This module provides the
 * canonical key set, provider registry, and getActiveModifiers(actor).
 *
 * @see .cursor/plans/generalized-modifier-system.md
 * @see docs-site/development.md (Modifier system)
 */

import { getConditionItemsMapSync } from "./condition-helpers.mjs";

// ---------------------------------------------------------------------------
// Canonical modifier key set
// ---------------------------------------------------------------------------

/** Fixed modifier keys (AC, saves, attack, speed, acLoseDex). */
const FIXED_MODIFIER_KEYS = new Set([
    "ac", "acLoseDex", "speedMultiplier",
    "saveFort", "saveRef", "saveWill",
    "attack", "attackMelee", "attackRanged"
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
 * Get status IDs from an effect (Set, Array, or source object).
 * Foundry stores statuses as a Set on the document; during data prep or from source we may see an array.
 *
 * @param {Object} effect  ActiveEffect document or plain effect object
 * @returns {string[]}
 */
function getEffectStatusIds(effect) {
    if (!effect) return [];
    const s = effect.statuses;
    if (s instanceof Set) return Array.from(s);
    if (Array.isArray(s)) return s;
    const src = effect._source ?? effect.toObject?.() ?? effect;
    const raw = src?.statuses;
    if (Array.isArray(raw)) return raw;
    if (raw instanceof Set) return Array.from(raw);
    const legacyId = effect.flags?.core?.statusId ?? effect.getFlag?.("core", "statusId");
    if (legacyId) return [legacyId];
    return [];
}

/**
 * Get the list of effect objects to use for condition resolution.
 * During data prep the document may expose effects differently; use both document collection and source.
 */
function getActorEffectsList(actor) {
    const fromDoc = actor?.effects ?? [];
    const docIsCollection = fromDoc && typeof fromDoc.size === "number" && typeof fromDoc.entries === "function";
    const docList = docIsCollection ? Array.from(fromDoc) : (Array.isArray(fromDoc) ? fromDoc : []);
    if (docList.length > 0) return docList;
    const src = actor?._source ?? actor?.toObject?.() ?? {};
    const fromSource = src?.effects;
    const sourceList = Array.isArray(fromSource) ? fromSource : [];
    return sourceList.length > 0 ? sourceList : docList;
}

// ---------------------------------------------------------------------------
// Race provider (adapter: actor's race item abilityAdjustments → contribution)
// ---------------------------------------------------------------------------

/**
 * Provider that returns one contribution for the actor's race (if any), converting
 * abilityAdjustments into the canonical change shape (ability.str, ability.dex, ...).
 * No schema change to race; uses existing abilityAdjustments.
 *
 * @param {Actor} actor
 * @returns {Array<{ label: string, changes: Array<{ key: string, value: number }> }>}
 */
function raceModifierProvider(actor) {
    const raceItem = actor?.items?.find(i => i.type === "race");
    if (!raceItem) return [];
    const adj = raceItem.system?.abilityAdjustments;
    if (!adj) return [];
    const changes = [];
    for (const abil of ABILITY_KEYS) {
        const value = Number(adj[abil]);
        if (Number.isNaN(value) || value === 0) continue;
        changes.push({ key: `ability.${abil}`, value });
    }
    if (changes.length === 0) return [];
    return [{ label: raceItem.name || "Race", changes }];
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
                    value: Number(c.value)
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
 * and applies (feat: always when owned; equipment/armor/weapon: when equipped — Phase 5).
 *
 * @param {Actor} actor
 * @returns {Array<{ label: string, changes: Array<{ key: string, value: number, label?: string }> }>}
 */
function itemsModifierProvider(actor) {
    const items = actor?.items ?? [];
    const out = [];
    for (const item of items) {
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
        // Phase 5: equipment/armor/weapon when equipped
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
    reg.push(raceModifierProvider);
    reg.push(itemsModifierProvider);
}
