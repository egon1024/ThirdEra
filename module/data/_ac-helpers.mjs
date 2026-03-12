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
 * @param {{ totals: Object.<string, number>, breakdown: Object.<string, Array<{label: string, value: number}> }} [modifierBag]  Unified modifier bag from getActiveModifiers(actor). Optional; null/undefined = no modifiers.
 */
export function computeAC(system, modifierBag = null) {
    const ac = system.attributes.ac;
    const conditionAc = modifierBag?.totals?.ac ?? 0;
    const acBreakdown = modifierBag?.breakdown?.ac ?? [];
    const loseDexToAc = (modifierBag?.totals?.acLoseDex ?? 0) !== 0;
    const rawDexMod = system.abilities.dex.mod;
    const dexMod = loseDexToAc ? Math.min(rawDexMod, 0) : rawDexMod;
    const sizeName = system.details.size;
    const sizeMod = CONFIG.THIRDERA.sizeModifiers?.[sizeName] ?? 0;
    const misc = ac.misc ?? 0;

    // Natural armor (NPC/monster stat block only)
    const naturalArmor = (system.statBlock && typeof system.statBlock.naturalArmor === "number") ? system.statBlock.naturalArmor : 0;

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

    // Calculate totals (include natural armor and condition modifier)
    ac.value = 10 + naturalArmor + armorBonus + shieldBonus + dexMod + sizeMod + misc + conditionAc;
    ac.touch = 10 + dexMod + sizeMod + misc + conditionAc;
    ac.flatFooted = 10 + naturalArmor + armorBonus + shieldBonus + flatFootedDex + sizeMod + misc + conditionAc;

    // Build breakdown for display (modifiers only; base 10 shown separately in template). Order: Natural, Armor, Shield, Dex, Size, Misc, condition.
    const breakdown = [];

    if (naturalArmor !== 0) {
        breakdown.push({ label: "Natural", value: naturalArmor });
    }
    if (armorBonus !== 0) {
        breakdown.push({ label: armorName, value: armorBonus });
    }
    if (shieldBonus !== 0) {
        breakdown.push({ label: shieldName, value: shieldBonus });
    }
    if (dexMod !== 0 || (loseDexToAc && rawDexMod > 0)) {
        let label = "Dex";
        if (loseDexToAc && rawDexMod > 0) label = "Dex (lost)";
        else if (loseDexToAc) label = "Dex (lost)";
        else if (system.abilities.dex.armorMaxDex !== null && system.abilities.dex.mod === system.abilities.dex.armorMaxDex) label = "Dex (Capped)";
        breakdown.push({ label, value: dexMod });
    }
    if (sizeMod !== 0) {
        breakdown.push({ label: "Size", value: sizeMod });
    }
    if (misc !== 0) {
        breakdown.push({ label: "Misc", value: misc });
    }
    for (const entry of acBreakdown) {
        breakdown.push({ label: entry.label, value: entry.value });
    }

    ac.breakdown = breakdown;
}

/**
 * Compute effective speed based on equipped body armor, load, and optional modifier-bag speed multiplier.
 * SRD: medium/heavy armor AND medium/heavy load reduces speed.
 * Mutates `system.attributes.speed.value` to the effective speed.
 *
 * @param {TypeDataModel} system       The actor's system data.
 * @param {Object}        loadEffects  Penalties from getLoadEffects().
 * @param {number|{ totals: Object.<string, number>, breakdown?: Object }} [conditionSpeedMultiplierOrBag]  Multiplier or modifier bag from getActiveModifiers(actor).
 * @param {number}        [baseSpeedFromSource]  If provided, use this as the base speed (avoids re-applying multiplier when prepareDerivedData runs multiple times).
 * @returns {{ reduced: boolean, baseSpeed: number, armorName: string|null, reason: string|null, conditionSpeedReason: string|null }}
 */
export function computeSpeed(system, loadEffects = null, conditionSpeedMultiplierOrBag = 1, baseSpeedFromSource = undefined) {
    const conditionSpeedMultiplier = typeof conditionSpeedMultiplierOrBag === "object" && conditionSpeedMultiplierOrBag?.totals
        ? (conditionSpeedMultiplierOrBag.totals.speedMultiplier ?? 1)
        : (conditionSpeedMultiplierOrBag ?? 1);
    const speedBreakdown = (conditionSpeedMultiplierOrBag?.breakdown?.speedMultiplier) ?? [];
    const baseSpeed = (typeof baseSpeedFromSource === "number" && baseSpeedFromSource >= 0) ? baseSpeedFromSource : system.attributes.speed.value;
    let currentSpeed = baseSpeed;
    let armorName = null;
    let reductionReason = null;
    let conditionSpeedReason = null;

    // First check load-based reduction (apply to local currentSpeed)
    if (loadEffects && loadEffects.speed30 < 30) {
        const loadReducedSpeed = baseSpeed >= 30 ? loadEffects.speed30 : loadEffects.speed20;
        if (loadReducedSpeed < currentSpeed) {
            currentSpeed = loadReducedSpeed;
            reductionReason = "Load";
        }
    }

    // Then check armor-based reduction
    for (const item of system.parent.items) {
        if (item.type !== "armor") continue;
        if (item.system.equipped !== "true") continue;
        if (item.system.armor.type === "shield") continue;

        const armorType = item.system.armor.type;
        if (armorType === "medium" || armorType === "heavy") {
            const armorReducedSpeed = (baseSpeed >= 30) ? item.system.speed.ft30 : item.system.speed.ft20;
            if (armorReducedSpeed < currentSpeed) {
                currentSpeed = armorReducedSpeed;
                armorName = item.name;
                reductionReason = item.name;
            }
            break;
        }
    }

    // Apply condition speed multiplier (e.g. half speed from Blinded)
    if (conditionSpeedMultiplier > 0 && conditionSpeedMultiplier < 1) {
        const before = currentSpeed;
        currentSpeed = Math.max(0, Math.floor(currentSpeed * conditionSpeedMultiplier));
        if (currentSpeed < before) conditionSpeedReason = "Condition";
    }

    system.attributes.speed.value = currentSpeed;

    const conditionLabels = speedBreakdown.map(b => b.label).filter(Boolean);
    const reasonParts = [reductionReason, ...conditionLabels].filter(Boolean);
    const reason = reasonParts.length ? reasonParts.join(", ") : null;

    return {
        reduced: currentSpeed < baseSpeed,
        overloaded: currentSpeed === 0,
        baseSpeed,
        armorName,
        reason,
        conditionSpeedReason
    };
}
