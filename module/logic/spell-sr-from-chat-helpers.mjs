/**
 * Pure read of spell-cast flags for spell penetration (no `message.speakerActor` / permission checks).
 * Entry points stay in `spell-sr-from-chat.mjs`.
 */

import { spellAllowsPenetrationRoll } from "./spell-resistance-helpers.mjs";

/**
 * @typedef {{ casterLevel: number, spellName: string, targetActorUuids: string[] }} SpellPenetrationCastFlags
 */

/**
 * When `flags.thirdera.spellCast` allows a penetration roll and has a finite caster level, return payload fields.
 * Returns `null` if SR key does not allow a roll or caster level is invalid.
 *
 * @param {object|null|undefined} spellCast
 * @returns {SpellPenetrationCastFlags|null}
 */
export function getSpellPenetrationCastFlags(spellCast) {
    if (!spellCast) return null;
    if (!spellAllowsPenetrationRoll(spellCast.srKey ?? "")) return null;
    const casterLevel = spellCast.casterLevel;
    if (typeof casterLevel !== "number" || !Number.isFinite(casterLevel)) return null;
    return {
        casterLevel,
        spellName: spellCast.spellName ?? "",
        targetActorUuids: Array.isArray(spellCast.targetActorUuids) ? spellCast.targetActorUuids : []
    };
}
