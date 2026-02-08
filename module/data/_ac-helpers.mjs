/**
 * Shared AC calculation logic for Character and NPC data models.
 *
 * D&D 3.5 SRD AC formula (subset implemented here):
 *   AC = 10 + armor bonus + shield bonus + dex mod (capped) + size mod + misc
 *   Touch AC = 10 + dex mod (capped) + size mod + misc
 *   Flat-Footed AC = AC but dex contribution clamped to min(dex, 0)
 */

/**
 * Compute AC values and a human-readable breakdown from the actor's system data.
 * Mutates `system.attributes.ac` in place (value, touch, flatFooted, breakdown).
 *
 * @param {TypeDataModel} system  The actor's system data (CharacterData or NPCData).
 *                                Must have: parent.items, abilities.dex.mod, details.size,
 *                                attributes.ac.misc
 */
export function computeAC(system) {
    const ac = system.attributes.ac;
    const dexMod = system.abilities.dex.mod;
    const sizeName = system.details.size;
    const sizeMod = CONFIG.THIRDERA.sizeModifiers?.[sizeName] ?? 0;
    const misc = ac.misc ?? 0;

    // Gather equipped armor items
    let armorBonus = 0;
    let shieldBonus = 0;
    let armorName = null;
    let shieldName = null;
    let effectiveMaxDex = null; // null = unlimited

    for (const item of system.parent.items) {
        if (item.type !== "armor") continue;
        if (item.system.equipped !== "true") continue;

        const bonus = item.system.armor.bonus ?? 0;
        const maxDex = item.system.armor.maxDex; // null means no limit
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

        // Effective maxDex is the lowest maxDex across all equipped armor/shields
        if (maxDex !== null) {
            effectiveMaxDex = effectiveMaxDex === null
                ? maxDex
                : Math.min(effectiveMaxDex, maxDex);
        }
    }

    // Cap dex modifier by effective maxDex
    const cappedDex = effectiveMaxDex !== null
        ? Math.min(dexMod, effectiveMaxDex)
        : dexMod;

    // Flat-footed: lose positive dex bonus (negative dex still applies)
    const flatFootedDex = Math.min(dexMod, 0);
    const cappedFlatFootedDex = effectiveMaxDex !== null
        ? Math.min(flatFootedDex, effectiveMaxDex)
        : flatFootedDex;

    // Calculate totals
    ac.value = 10 + armorBonus + shieldBonus + cappedDex + sizeMod + misc;
    ac.touch = 10 + cappedDex + sizeMod + misc;
    ac.flatFooted = 10 + armorBonus + shieldBonus + cappedFlatFootedDex + sizeMod + misc;

    // Build breakdown for display (modifiers only; base 10 shown separately in template)
    const breakdown = [];

    if (armorBonus !== 0) {
        breakdown.push({ label: armorName, value: armorBonus });
    }
    if (shieldBonus !== 0) {
        breakdown.push({ label: shieldName, value: shieldBonus });
    }

    // Show dex line with max-dex note if capped
    const dexLabel = (effectiveMaxDex !== null && dexMod > effectiveMaxDex)
        ? `Dex (max ${signedInt(effectiveMaxDex)})`
        : "Dex";
    if (cappedDex !== 0) {
        breakdown.push({ label: dexLabel, value: cappedDex });
    }

    if (sizeMod !== 0) {
        breakdown.push({ label: "Size", value: sizeMod });
    }
    if (misc !== 0) {
        breakdown.push({ label: "Misc", value: misc });
    }

    ac.breakdown = breakdown;
}

/** Format an integer with explicit sign ("+2", "-1", "+0"). */
function signedInt(n) {
    return n >= 0 ? `+${n}` : `${n}`;
}
