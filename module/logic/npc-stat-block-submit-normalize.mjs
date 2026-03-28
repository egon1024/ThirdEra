/**
 * Coerce one natural attack row's presetAttackBonus after form submit.
 * @param {object} atk
 */
function coercePresetAttackBonus(atk) {
    if (!atk || typeof atk !== "object") return;
    const p = atk.presetAttackBonus;
    if (p === "" || p === undefined) {
        atk.presetAttackBonus = null;
        return;
    }
    if (p === null) return;
    if (typeof p === "number" && Number.isFinite(p)) {
        atk.presetAttackBonus = Math.trunc(p);
        return;
    }
    if (typeof p === "string") {
        const t = p.trim();
        if (t === "") atk.presetAttackBonus = null;
        else if (/^-?\d+$/.test(t)) atk.presetAttackBonus = parseInt(t, 10);
        else atk.presetAttackBonus = null;
    }
}

/**
 * Coerce NPC stat block natural attack `presetAttackBonus` values coming from form submit.
 * Hidden inputs use `value=""` when null; Foundry NumberField rejects "" for nullable integer fields.
 *
 * **Call this before `document.validate()`** on sheet submit (`_prepareSubmitData`), not after —
 * validation runs in Foundry's `_prepareSubmitData` before `_processSubmitData`.
 *
 * **Shape:** `foundry.utils.expandObject` builds `naturalAttacks` as a plain object `{0: {...}, 1: {...}}`,
 * not a JavaScript Array — both must be handled.
 *
 * @param {object} submitData Form-expanded object (mutated in place).
 */
export function normalizeNpcStatBlockNaturalAttackPresetBonuses(submitData) {
    const attacks = submitData?.system?.statBlock?.naturalAttacks;
    if (attacks == null || typeof attacks !== "object") return;
    if (Array.isArray(attacks)) {
        for (const atk of attacks) coercePresetAttackBonus(atk);
        return;
    }
    for (const key of Object.keys(attacks)) {
        coercePresetAttackBonus(attacks[key]);
    }
}
