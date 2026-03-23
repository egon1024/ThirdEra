/**
 * Numeric spell resistance on actors and policy for spell-penetration automation (Track B).
 * Consumers: `ThirdEraActor#rollSpellPenetration`, cast-chat SR UI (`spell-sr-from-chat.mjs`).
 */

/**
 * @param {unknown} value
 * @returns {number} Non-negative integer; 0 when missing or non-finite
 */
function _normalizeSr(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.trunc(n));
}

/**
 * Spell resistance score for a Third Era actor (character or NPC).
 * @param {Actor} actor
 * @returns {number}
 */
export function getActorSpellResistance(actor) {
    if (!actor?.system) return 0;
    if (actor.type === "npc") {
        return _normalizeSr(actor.system.statBlock?.spellResistance);
    }
    if (actor.type === "character") {
        return _normalizeSr(actor.system.details?.spellResistance);
    }
    return 0;
}

/**
 * Whether automation may offer a spell penetration roll for this spell’s SR line.
 *
 * - **`yes`:** SR applies per SRD table; allow penetration UI.
 * - **`yes-harmless`:** SRD allows SR for harmless spells mainly when the creature is **unwilling**.
 *   The system does not know willingness at cast time. We still return `true` so the table can
 *   roll when SR applies; the GM ignores or skips the roll for willing targets. (Matches plan:
 *   visible control + GM override rather than hard-coding “skip SR”.)
 * - **`no`**, **`no-object`**, **`see-text`**, empty string (`""`): no automation (chat SR line stays informational).
 * - **Unknown** keys: treat like non-automated (defensive default).
 *
 * Keys align with `CONFIG.THIRDERA.spellResistanceChoices` / spell `system.spellResistance`.
 *
 * @param {string} [srKey] - Raw value from the spell item or `flags.thirdera.spellCast.srKey`
 * @returns {boolean}
 */
export function spellAllowsPenetrationRoll(srKey) {
    const key = srKey ?? "";
    if (key === "yes") return true;
    if (key === "yes-harmless") return true;
    return false;
}
