import { getEffectiveDamage } from "../data/_damage-helpers.mjs";

/**
 * Build a plain `system` object for armor / equipment / weapon item sheets.
 * `item.system` is a TypeDataModel — `{ ...systemData }` does not copy nested fields, which breaks Handlebars.
 *
 * @param {unknown} systemData - `item.system` (TypeDataModel or plain)
 * @returns {Record<string, unknown>}
 */
export function buildPlainGearSystemForItemSheet(systemData) {
    const plain =
        systemData && typeof /** @type {{ toObject?: (v: boolean) => Record<string, unknown> }} */ (systemData).toObject === "function"
            ? /** @type {{ toObject: (v: boolean) => Record<string, unknown> }} */ (systemData).toObject(false)
            : { ...(typeof systemData === "object" && systemData !== null ? systemData : {}) };
    plain.changes = Array.isArray(systemData?.changes)
        ? systemData.changes.map((c) => (c && typeof c === "object" ? { ...c } : c))
        : [];
    const gate = systemData?.mechanicalCreatureGateUuids;
    plain.mechanicalCreatureGateUuids = Array.isArray(gate) ? [...gate] : [];
    const cg = systemData?.cgsGrants;
    plain.cgsGrants = {
        grants: Array.isArray(cg?.grants) ? cg.grants.map((g) => (g && typeof g === "object" ? { ...g } : g)) : [],
        senses: Array.isArray(cg?.senses) ? cg.senses.map((s) => (s && typeof s === "object" ? { ...s } : s)) : []
    };
    const ovr = systemData?.cgsGrantOverrides;
    plain.cgsGrantOverrides = {
        grants: Array.isArray(ovr?.grants) ? ovr.grants.map((g) => (g && typeof g === "object" ? { ...g } : g)) : [],
        senses: Array.isArray(ovr?.senses) ? ovr.senses.map((s) => (s && typeof s === "object" ? { ...s } : s)) : []
    };
    plain.cgsTemplateUuid = typeof systemData?.cgsTemplateUuid === "string" ? systemData.cgsTemplateUuid : "";
    const dmg = plain.damage;
    if (dmg && typeof dmg === "object" && typeof dmg.dice === "string") {
        const props = plain.properties;
        const size =
            props && typeof props === "object" && typeof props.size === "string" && props.size.length > 0
                ? props.size
                : "Medium";
        plain.damage = { ...dmg, effectiveDice: getEffectiveDamage(dmg.dice, size) };
    }
    return plain;
}
