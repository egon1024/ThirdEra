/**
 * Shared armor calculation logic for Character and NPC data models.
 *
 * D&D 3.5 SRD AC formula (subset implemented here):
 *   AC = 10 + armor bonus + shield bonus + dex mod (already capped) + size mod + misc
 *   Touch AC = 10 + dex mod (already capped) + size mod + misc
 *   Flat-Footed AC = AC but dex contribution clamped to min(dex, 0)
 */

/**
 * Calculate the effective maximum Dex bonus imposed by equipped armor/shields.
 * Should be called early in prepareDerivedData() so dex.mod can be capped before
 * any derived calculations (initiative, reflex, skills, AC, etc.).
 *
 * @param {TypeDataModel} system  The actor's system data.
 * @returns {number|null}  The lowest maxDex across all equipped armor/shields, or null if unlimited.
 */
export function getEffectiveMaxDex(system) {
    let effectiveMaxDex = null;

    for (const item of system.parent.items) {
        if (item.type !== "armor") continue;
        if (item.system.equipped !== "true") continue;
        if (item.system.armor.type === "shield") continue; // SRD: shields don't limit max Dex

        const maxDex = item.system.armor.maxDex;
        if (maxDex !== null) {
            effectiveMaxDex = effectiveMaxDex === null
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
        breakdown.push({ label: "Dex", value: dexMod });
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
 * Compute effective speed based on equipped body armor.
 * SRD: medium/heavy armor reduces speed. Light armor and shields do not.
 * Mutates `system.attributes.speed.value` to the effective speed.
 *
 * @param {TypeDataModel} system  The actor's system data.
 * @returns {{ reduced: boolean, baseSpeed: number, armorName: string|null }}
 *          Info for display purposes (passed via _prepareContext).
 */
export function computeSpeed(system) {
    const baseSpeed = system.attributes.speed.value;
    let armorName = null;

    for (const item of system.parent.items) {
        if (item.type !== "armor") continue;
        if (item.system.equipped !== "true") continue;
        if (item.system.armor.type === "shield") continue; // shields don't affect speed

        const armorType = item.system.armor.type;
        if (armorType === "medium" || armorType === "heavy") {
            // Use the armor's stored speed for the matching base speed
            let reducedSpeed;
            if (baseSpeed >= 30) {
                reducedSpeed = item.system.speed.ft30;
            } else {
                reducedSpeed = item.system.speed.ft20;
            }
            if (reducedSpeed < baseSpeed) {
                system.attributes.speed.value = reducedSpeed;
                armorName = item.name;
            }
            break; // only one body armor can be equipped
        }
    }

    return {
        reduced: system.attributes.speed.value < baseSpeed,
        baseSpeed,
        armorName
    };
}
