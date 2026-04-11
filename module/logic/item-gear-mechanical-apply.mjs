/**
 * Whether armor, equipment, and weapon items apply GMS `system.changes` and CGS grants from the embedded item.
 * Feats, race, and class features always apply when owned; this helper is only for gear types.
 *
 * Optional **creature gate** (`system.mechanicalCreatureGateUuids`): when non-empty, mechanical effects apply
 * only if the owning actor matches at least one referenced type/subtype UUID via
 * `getEffectiveCreatureTypes` (fixed-point with other gated gear). See `cgs-gear-mechanical-resolution.mjs`.
 *
 * @see docs-site/development.md (Modifier system, Phase 5g)
 */

/** @typedef {"equipped" | "carried"} MechanicalApplyScope */

/** Default: numeric + CGS from gear apply only when equipped (armor/gear) or wielded (weapon). */
export const MECHANICAL_APPLY_SCOPE_EQUIPPED = "equipped";

/** Apply when the item is on the actor’s sheet (inventory), even if not equipped. */
export const MECHANICAL_APPLY_SCOPE_CARRIED = "carried";

/**
 * @param {unknown} raw  `system.mechanicalApplyScope`
 * @returns {MechanicalApplyScope}
 */
export function normalizeMechanicalApplyScope(raw) {
    const s = typeof raw === "string" ? raw.trim() : "";
    if (s === MECHANICAL_APPLY_SCOPE_CARRIED) return MECHANICAL_APPLY_SCOPE_CARRIED;
    return MECHANICAL_APPLY_SCOPE_EQUIPPED;
}

/**
 * Non-empty creature type / subtype document UUIDs for mechanical gate checks.
 *
 * @param {unknown} raw `system.mechanicalCreatureGateUuids`
 * @returns {string[]}
 */
export function normalizeMechanicalCreatureGateUuids(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((u) => (typeof u === "string" ? u.trim() : ""))
        .filter(Boolean);
}

/**
 * Stable id for matching embedded gear across modifier + CGS paths (`id` when present, else `uuid`).
 * @param {{ id?: string, uuid?: string } | null | undefined} item
 * @returns {string}
 */
export function embeddedGearItemStableKey(item) {
    if (!item || typeof item !== "object") return "";
    if (item.id != null && String(item.id).trim() !== "") return String(item.id);
    if (typeof item.uuid === "string" && item.uuid.trim() !== "") return item.uuid.trim();
    return "";
}

/**
 * @param {{ type?: string, system?: Record<string, unknown> } | null | undefined} item
 * @returns {boolean}
 */
export function embeddedGearMechanicalEffectsApply(item) {
    const type = item?.type;
    const sys = item?.system;
    if (type !== "armor" && type !== "equipment" && type !== "weapon") {
        return false;
    }
    const scope = normalizeMechanicalApplyScope(sys?.mechanicalApplyScope);

    if (type === "armor" || type === "equipment") {
        if (scope === MECHANICAL_APPLY_SCOPE_CARRIED) return true;
        return sys?.equipped === "true";
    }
    // weapon
    if (scope === MECHANICAL_APPLY_SCOPE_CARRIED) return true;
    const eq = sys?.equipped;
    return eq === "primary" || eq === "offhand";
}
