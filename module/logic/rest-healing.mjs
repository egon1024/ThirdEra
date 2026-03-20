import { getActiveModifiers } from "./modifier-aggregation.mjs";

/**
 * Daily natural healing amount for the Take rest flow: character level + GMS
 * (`getActiveModifiers(actor).totals.naturalHealingPerDay`) + `details.naturalHealingBonus`.
 *
 * @param {Actor} actor
 * @returns {number}
 */
export function getRestHealingAmount(actor) {
    const details = actor?.system?.details ?? {};
    const rawLevel = details.totalLevel ?? details.level ?? 1;
    const levelNum = Number(rawLevel);
    const level = Number.isFinite(levelNum) && levelNum >= 1 ? Math.floor(levelNum) : 1;
    const gms = getActiveModifiers(actor).totals.naturalHealingPerDay ?? 0;
    const bonus = Number(details.naturalHealingBonus);
    const safeBonus = Number.isFinite(bonus) && bonus >= 0 ? Math.floor(bonus) : 0;
    return level + gms + safeBonus;
}
