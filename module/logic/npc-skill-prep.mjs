/**
 * NPC skill modifier preparation (no skill points, no max ranks).
 * Totals match PCs: ability + ranks + misc + ACP + GMS skill.<key>.
 */

const NPC_MAX_RANKS_DISPLAY = 999;

/**
 * Sum armor check penalty from all equipped armor items on an actor.
 * @param {{ items: Iterable<{ type: string, system: Record<string, unknown> }> }} actor
 * @returns {number}
 */
export function getTotalArmorCheckPenaltyFromItems(actor) {
    let total = 0;
    for (const item of actor.items) {
        if (item.type !== "armor") continue;
        if (item.system?.equipped !== "true") continue;
        total += item.system?.armor?.checkPenalty || 0;
    }
    return total;
}

/**
 * @param {object} loadEffects
 * @param {number} totalArmorCheckPenalty
 * @param {number} acpPenalty - applied value (min of armor sum and load acp when skill uses ACP)
 * @returns {string}
 */
export function acpBreakdownLabel(loadEffects, totalArmorCheckPenalty, acpPenalty) {
    if (acpPenalty === 0) return "Armor ACP";
    const loadAcp = loadEffects?.acp ?? 0;
    if (loadAcp < totalArmorCheckPenalty) {
        return "Load ACP";
    }
    if (loadAcp === totalArmorCheckPenalty && totalArmorCheckPenalty !== 0) {
        return "Armor & Load ACP";
    }
    if (totalArmorCheckPenalty === 0 && loadAcp !== 0) {
        return "Load ACP";
    }
    return "Armor ACP";
}

/**
 * @param {{ system: { abilities: Record<string, { mod?: number }> }, items: Iterable<{ type: string, system: Record<string, unknown> }> }} actor
 * @param {{ totals: Record<string, number>, breakdown: Record<string, Array<{ label: string, value: number }>> }} mods
 * @param {{ acp?: number }} loadEffects
 */
export function prepareNpcSkillItems(actor, mods, loadEffects) {
    const abilities = actor.system?.abilities ?? {};
    const totalArmorCheckPenalty = getTotalArmorCheckPenaltyFromItems(actor);
    const loadAcp = loadEffects?.acp ?? 0;

    const skillItems = actor.items.filter((i) => i.type === "skill");

    for (const skill of skillItems) {
        const sd = skill.system;
        const ranks = sd.ranks || 0;

        sd.isGranted = false;
        // Per-skill toggle on the NPC sheet (system.npcClassSkill); default true when unset
        sd.isClassSkill = sd.npcClassSkill !== false;
        sd.maxRanks = NPC_MAX_RANKS_DISPLAY;
        sd.isForbidden = false;
        sd.forbiddenReason = "";

        let acpPenalty = 0;
        if (sd.armorCheckPenalty === "true") {
            acpPenalty = Math.min(totalArmorCheckPenalty, loadAcp);
        }
        sd.armorPenalty = acpPenalty;

        const abilityMod = abilities[sd.ability]?.mod || 0;
        const misc = sd.modifier?.misc || 0;
        const skillModKey = sd.key ? `skill.${sd.key}` : null;
        const skillMod = skillModKey ? (mods.totals[skillModKey] ?? 0) : 0;
        const skillModBreakdown = skillModKey ? (mods.breakdown[skillModKey] ?? []) : [];
        sd.modifier.total = abilityMod + ranks + misc + acpPenalty + skillMod;

        sd.breakdown = [
            { label: "Ability", value: abilityMod },
            { label: "Ranks", value: ranks }
        ];
        if (misc !== 0) sd.breakdown.push({ label: "Misc", value: misc });
        if (acpPenalty !== 0) {
            const label = acpBreakdownLabel(loadEffects, totalArmorCheckPenalty, acpPenalty);
            sd.breakdown.push({ label, value: acpPenalty });
        }
        for (const entry of skillModBreakdown) {
            sd.breakdown.push({ label: entry.label, value: entry.value });
        }
        sd.modifier.breakdown_formatted = sd.breakdown
            .map((b) => `${b.label}: ${b.value >= 0 ? "+" : ""}${b.value}`)
            .join("\n");
    }
}

/**
 * GMS keys skill.<name> present in the modifier bag but without an embedded skill item.
 * @param {{ totals: Record<string, number>, breakdown: Record<string, Array<{ label: string, value: number }>> }} mods
 * @param {Iterable<{ system?: { key?: string } }>} skillItemsOnActor
 * @returns {Array<{ key: string, fullKey: string, total: number, breakdown: Array<{ label: string, value: number }> }>}
 */
export function buildModifierOnlySkills(mods, skillItemsOnActor) {
    const actorSkillKeys = new Set(
        [...skillItemsOnActor]
            .map((s) => (s.system?.key ?? "").toLowerCase())
            .filter(Boolean)
    );
    const modifierOnlySkills = [];
    const skillKeysFromBag = new Set([
        ...Object.keys(mods.totals || {}).filter((k) => k.startsWith("skill.")),
        ...Object.keys(mods.breakdown || {}).filter((k) => k.startsWith("skill."))
    ]);
    for (const fullKey of skillKeysFromBag) {
        const key = fullKey.slice("skill.".length);
        if (!key || actorSkillKeys.has(key.toLowerCase())) continue;
        const total = mods.totals[fullKey] ?? 0;
        const breakdown = mods.breakdown[fullKey] ?? [];
        modifierOnlySkills.push({ key, fullKey, total, breakdown });
    }
    return modifierOnlySkills;
}
