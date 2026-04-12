/**
 * Pure parsing for “Concentration (other)” dialog (damage-based vs custom DC).
 * DOM wiring stays in `concentration-from-chat.mjs`.
 */

import { damageWhileCastingDc } from "./concentration-dcs.mjs";

/**
 * @typedef {{ ok: true, dc: number, labelKind: "damage", damage: number } | { ok: true, dc: number, labelKind: "custom" } | { ok: false, errorKey: string }} ConcentrationOtherParseResult
 */

/**
 * Parse trimmed damage / custom DC strings from the A4 dialog into a DC (SRD damage-while-casting or custom).
 * Does not call `game.i18n`; callers localize `errorKey` or build labels from `labelKind` + fields.
 *
 * @param {string} [rawDamageStr]
 * @param {string} [rawCustomStr]
 * @param {number} spellLevel
 * @returns {ConcentrationOtherParseResult}
 */
export function parseConcentrationOtherInputs(rawDamageStr, rawCustomStr, spellLevel) {
    const damageStr = String(rawDamageStr ?? "").trim();
    const customStr = String(rawCustomStr ?? "").trim();

    if (damageStr.length > 0) {
        const damage = Number(damageStr);
        if (!Number.isFinite(damage) || damage < 0) {
            return { ok: false, errorKey: "THIRDERA.Concentration.OtherInvalidDamage" };
        }
        const dc = damageWhileCastingDc(damage, spellLevel);
        if (!Number.isFinite(dc)) {
            return { ok: false, errorKey: "THIRDERA.Concentration.OtherInvalidDamage" };
        }
        return { ok: true, dc, labelKind: "damage", damage };
    }

    if (customStr.length > 0) {
        const customDc = Number(customStr);
        if (!Number.isFinite(customDc)) {
            return { ok: false, errorKey: "THIRDERA.Concentration.OtherInvalidCustomDc" };
        }
        return { ok: true, dc: customDc, labelKind: "custom" };
    }

    return { ok: false, errorKey: "THIRDERA.Concentration.OtherNeedDcOrDamage" };
}
