/**
 * Shared armor calculation logic for Character and NPC data models.
 *
 * D&D 3.5 SRD AC formula (subset implemented here):
 *   AC = 10 + armor bonus + shield bonus + dex mod (already capped) + size mod + misc
 *   Touch AC = 10 + dex mod (already capped) + size mod + misc
 *   Flat-Footed AC = AC but dex contribution clamped to min(dex, 0)
 */

/**
 * Calculate the effective maximum Dex bonus imposed by equipped armor/shields AND load.
 *
 * @param {TypeDataModel} system      The actor's system data.
 * @param {number|null}   loadMaxDex  Max Dex cap from current encumbrance.
 * @returns {number|null}  The lowest maxDex across all equipped armor/shields and load, or null if unlimited.
 */
export function getEffectiveMaxDex(system, loadMaxDex = null) {
    let effectiveMaxDex = loadMaxDex;

    for (const item of system.parent.items) {
        if (item.type !== "armor") continue;
        if (item.system.equipped !== "true") continue;
        if (item.system.armor.type === "shield") continue; // SRD: shields don't limit max Dex

        const maxDex = item.system.armor.maxDex;
        if (maxDex !== null) {
            effectiveMaxDex = (effectiveMaxDex === null)
                ? maxDex
                : Math.min(effectiveMaxDex, maxDex);
        }
    }

    return effectiveMaxDex;
}

/**
 * Apply the armor max-Dex cap to the Dex modifier.
 * Stores the uncapped mod and max-Dex value on the dex ability object for display.
 * Must be called after ability mods are calculated but before any derived stats.
 *
 * @param {TypeDataModel} system        The actor's system data.
 * @param {number|null}   effectiveMaxDex  From getEffectiveMaxDex(), or null if unlimited.
 */
export function applyMaxDex(system, effectiveMaxDex) {
    const dex = system.abilities.dex;
    dex.armorMaxDex = effectiveMaxDex; // Store for breakdown display
    if (effectiveMaxDex !== null && dex.mod > effectiveMaxDex) {
        dex.mod = effectiveMaxDex;
    }
}

/**
 * Compute AC values and a human-readable breakdown from the actor's system data.
 * Expects dex.mod to already be capped via applyMaxDex().
 * Mutates `system.attributes.ac` in place (value, touch, flatFooted, breakdown).
 *
 * @param {TypeDataModel} system  The actor's system data (CharacterData or NPCData).
 */
export function computeAC(system) {
    const ac = system.attributes.ac;
    const dexMod = system.abilities.dex.mod;
    const sizeName = system.details.size;
    const sizeMod = CONFIG.THIRDERA.sizeModifiers?.[sizeName] ?? 0;
    const misc = ac.misc ?? 0;

    // Gather equipped armor items (bonuses only; maxDex already applied to dex.mod)
    let armorBonus = 0;
    let shieldBonus = 0;
    let armorName = null;
    let shieldName = null;

    for (const item of system.parent.items) {
        if (item.type !== "armor") continue;
        if (item.system.equipped !== "true") continue;

        const bonus = item.system.armor.bonus ?? 0;
        const isShield = item.system.armor.type === "shield";

        if (isShield) {
            if (bonus > shieldBonus) {
                shieldBonus = bonus;
                shieldName = item.name;
            }
        } else {
            if (bonus > armorBonus) {
                armorBonus = bonus;
                armorName = item.name;
            }
        }
    }

    // Flat-footed: lose positive dex bonus (negative dex still applies)
    const flatFootedDex = Math.min(dexMod, 0);

    // Calculate totals
    ac.value = 10 + armorBonus + shieldBonus + dexMod + sizeMod + misc;
    ac.touch = 10 + dexMod + sizeMod + misc;
    ac.flatFooted = 10 + armorBonus + shieldBonus + flatFootedDex + sizeMod + misc;

    // Build breakdown for display (modifiers only; base 10 shown separately in template)
    const breakdown = [];

    if (armorBonus !== 0) {
        breakdown.push({ label: armorName, value: armorBonus });
    }
    if (shieldBonus !== 0) {
        breakdown.push({ label: shieldName, value: shieldBonus });
    }
    if (dexMod !== 0) {
        // Label could mention capping if armorMaxDex is active
        const label = system.abilities.dex.armorMaxDex !== null && system.abilities.dex.mod === system.abilities.dex.armorMaxDex
            ? "Dex (Capped)"
            : "Dex";
        breakdown.push({ label, value: dexMod });
    }
    if (sizeMod !== 0) {
        breakdown.push({ label: "Size", value: sizeMod });
    }
    if (misc !== 0) {
        breakdown.push({ label: "Misc", value: misc });
    }

    ac.breakdown = breakdown;
}

/**
 * Compute effective speed based on equipped body armor and load.
 * SRD: medium/heavy armor AND medium/heavy load reduces speed.
 * Mutates `system.attributes.speed.value` to the effective speed.
 *
 * @param {TypeDataModel} system       The actor's system data.
 * @param {Object}        loadEffects  Penalties from getLoadEffects().
 * @returns {{ reduced: boolean, baseSpeed: number, armorName: string|null, reason: string|null }}
 *          Info for display purposes.
 */
export function computeSpeed(system, loadEffects = null) {
    const baseSpeed = system.attributes.speed.value;
    let armorName = null;
    let reductionReason = null;

    // First check load-based reduction
    if (loadEffects && loadEffects.speed30 < 30) {
        const loadReducedSpeed = baseSpeed >= 30 ? loadEffects.speed30 : loadEffects.speed20;
        if (loadReducedSpeed < baseSpeed) {
            system.attributes.speed.value = loadReducedSpeed;
            reductionReason = "Load";
        }
    }

    // Then check armor-based reduction (takes the lower value)
    for (const item of system.parent.items) {
        if (item.type !== "armor") continue;
        if (item.system.equipped !== "true") continue;
        if (item.system.armor.type === "shield") continue; // shields don't affect speed

        const armorType = item.system.armor.type;
        if (armorType === "medium" || armorType === "heavy") {
            let armorReducedSpeed = (baseSpeed >= 30) ? item.system.speed.ft30 : item.system.speed.ft20;
            if (armorReducedSpeed < system.attributes.speed.value) {
                system.attributes.speed.value = armorReducedSpeed;
                armorName = item.name;
                reductionReason = item.name;
            }
            break;
        }
    }

    return {
        reduced: system.attributes.speed.value < baseSpeed,
        overloaded: system.attributes.speed.value === 0,
        baseSpeed,
        armorName,
        reason: reductionReason
    };
}
