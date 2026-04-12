/**
 * Pure read of roll chat message fields for Apply damage/healing (no `ChatMessage` / `game`).
 * Phase 2 chat entry points stay in `apply-damage-healing-entry-points.mjs`.
 */

/**
 * @typedef {{ amount: number, mode: "damage"|"healing" }} ApplyRollChatData
 */

/**
 * Derive apply amount/mode from roll message fields (mirrors prior `getApplyDataFromMessage` logic).
 *
 * @param {{ isRoll?: boolean, rolls?: { total?: number }[], flavor?: string|null }} fields
 * @returns {ApplyRollChatData|null}
 */
export function getApplyDataFromRollFields(fields) {
    const { isRoll, rolls, flavor } = fields ?? {};
    if (!isRoll) return null;
    if (!rolls?.length) return null;
    const flavorLc = String(flavor ?? "").toLowerCase();
    const mode = flavorLc.includes("heal") ? "healing" : "damage";

    let total;
    if (rolls.length >= 2 && flavorLc.includes("attack") && flavorLc.includes("damage")) {
        const lastRoll = rolls[rolls.length - 1];
        total = lastRoll && typeof lastRoll.total === "number" ? lastRoll.total : 0;
    } else {
        total = 0;
        for (const roll of rolls) {
            if (roll && typeof roll.total === "number") total += roll.total;
        }
    }
    return { amount: total, mode };
}
