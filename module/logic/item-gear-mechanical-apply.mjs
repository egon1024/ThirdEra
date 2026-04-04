/**
 * Whether armor, equipment, and weapon items apply GMS `system.changes` and CGS grants from the embedded item.
 * Feats, race, and class features always apply when owned; this helper is only for gear types.
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
