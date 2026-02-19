import { getSpellsForDomain } from "../logic/domain-spells.mjs";

/**
 * Extended Actor document class for Third Era
 * @extends {Actor}
 */
export class ThirdEraActor extends Actor {

    /**
     * Augment the basic actor data with additional dynamic data.
     */
    prepareData() {
        super.prepareData();
    }

    /**
     * Prepare character data that doesn't depend on items or effects
     */
    prepareBaseData() {
        super.prepareBaseData();
    }

    /**
     * Prepare character data that depends on items and effects
     */
    prepareDerivedData() {
        super.prepareDerivedData();

        const actorData = this;
        const systemData = actorData.system;
        const flags = actorData.flags.thirdera || {};

        // Make separate methods for each Actor type (character, npc, etc.) to keep
        // things organized
        if (actorData.type === 'character') this._prepareCharacterData(actorData);
        if (actorData.type === 'npc') this._prepareNPCData(actorData);
    }

    /**
     * Prepare Character specific derived data
     */
    _prepareCharacterData(actorData) {
        const systemData = actorData.system;

        // Add any additional character-specific calculations here
        // For now, the data model handles most calculations
    }

    /**
     * Prepare NPC specific derived data
     */
    _prepareNPCData(actorData) {
        const systemData = actorData.system;

        // Add any additional NPC-specific calculations here
    }

    /**
     * Roll a skill check
     * @param {string} skillName - The name of the skill to roll
     */
    async rollSkillCheck(skillName) {
        const skill = this.items.find(i => i.type === 'skill' && i.name === skillName);

        if (!skill) {
            ui.notifications.warn(`Skill ${skillName} not found on actor.`);
            return null;
        }

        const skillData = skill.system;
        const abilityMod = this.system.abilities[skillData.ability]?.mod || 0;
        const ranks = skillData.ranks || 0;
        const misc = skillData.modifier?.misc || 0;
        const total = abilityMod + ranks + misc;

        const roll = await new Roll(`1d20 + ${total}`).roll();

        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            flavor: `${skillName} Check`
        });

        return roll;
    }

    /**
     * Roll an ability check
     * @param {string} abilityId - The ability score to roll (str, dex, con, int, wis, cha)
     */
    async rollAbilityCheck(abilityId) {
        const ability = this.system.abilities[abilityId];

        if (!ability) {
            ui.notifications.warn(`Ability ${abilityId} not found.`);
            return null;
        }

        const roll = await new Roll(`1d20 + ${ability.mod}`).roll();

        const abilityName = CONFIG.THIRDERA?.AbilityScores?.[abilityId] || abilityId.toUpperCase();

        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            flavor: `${abilityName} Check`
        });

        return roll;
    }

    /**
     * Roll a saving throw
     * @param {string} saveId - The save to roll (fort, ref, will)
     */
    async rollSavingThrow(saveId) {
        const save = this.system.saves[saveId];

        if (!save) {
            ui.notifications.warn(`Save ${saveId} not found.`);
            return null;
        }

        const roll = await new Roll(`1d20 + ${save.total}`).roll();

        const saveName = CONFIG.THIRDERA?.Saves?.[saveId] || saveId.toUpperCase();

        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            flavor: `${saveName} Save`
        });

        return roll;
    }

    /**
     * Roll initiative for this actor
     */
    async rollInitiative(options = {}) {
        const initBonus = this.system.attributes.initiative.bonus;

        const roll = await new Roll(`1d20 + ${initBonus}`).roll();

        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            flavor: "Initiative"
        });

        return roll;
    }

    /**
     * Cast a spell: increment cast count and post a chat message with Save DC breakdown and spell resistance.
     * Used by the sheet Cast button and (Phase 2) by hotbar macros.
     * @param {Item} spellItem       The spell item to cast (must be type "spell" on this actor)
     * @param {Object} options
     * @param {string} options.classItemId  The class item ID (from spellcastingByClass) for DC and slot context
     * @param {number|string} options.spellLevel  Spell level 0-9 for this class
     * @returns {Promise<boolean>}   True if cast was applied and message posted
     */
    async castSpell(spellItem, { classItemId, spellLevel }) {
        if (!spellItem || spellItem.type !== "spell") return false;
        if (this.type !== "character") return false;

        const systemData = this.system;
        const spellcastingByClass = systemData.spellcastingByClass;
        if (!Array.isArray(spellcastingByClass)) return false;

        const classData = spellcastingByClass.find(c => c.classItemId === classItemId);
        if (!classData) return false;

        const level = typeof spellLevel === "string" ? parseInt(spellLevel, 10) : spellLevel;
        if (Number.isNaN(level) || level < 0 || level > 9) return false;

        // Domain spells: identified by name match to class's domain spell list at this level. They use domain slots only (1 per level), not regular slots/prepared.
        let domainSpellsAtLevel = classData.domainSpellsByLevel?.[level] ?? classData.domainSpellsByLevel?.[String(level)] ?? [];
        let domainSpellNamesAtLevel = new Set(
            domainSpellsAtLevel.map((e) => (e.spellName || "").toLowerCase().trim()).filter(Boolean)
        );
        let isDomainSpell = domainSpellNamesAtLevel.has((spellItem.name || "").toLowerCase().trim());

        // Fallback: when derived data had no domain spell list (e.g. prepared on server without getSpellsForDomain), resolve client-side so the first cast uses domain logic instead of prepared.
        if (!isDomainSpell && classData.domains?.length && typeof getSpellsForDomain === "function") {
            const spellNameLower = (spellItem.name || "").trim().toLowerCase();
            const fallbackNames = new Set();
            for (const dom of classData.domains) {
                const domainKey = (dom.domainKey || "").trim();
                if (!domainKey) continue;
                try {
                    const granted = getSpellsForDomain(domainKey);
                    for (const entry of granted) {
                        if (entry.level === level && (entry.spellName || "").trim()) {
                            fallbackNames.add((entry.spellName || "").trim().toLowerCase());
                        }
                    }
                } catch (_) { /* ignore */ }
            }
            if (fallbackNames.has(spellNameLower)) {
                isDomainSpell = true;
                domainSpellNamesAtLevel = fallbackNames;
            }
        }

        // Optional slot check: warn if no slot available, do not block
        const preparationType = classData.preparationType;
        const spellsPerDay = classData.spellsPerDay || {};
        const slotsAtLevel = spellsPerDay[level] ?? spellsPerDay[String(level)] ?? 0;
        const domainSlotsAtLevel = classData.domainSpellSlots?.[level] ?? classData.domainSpellSlots?.[String(level)] ?? 0;

        if (isDomainSpell) {
            // Domain spells use domain slots only (typically 1 per level). Do not count against regular prepared/spontaneous slots.
            let domainCastSum = 0;
            for (const item of this.items) {
                if (item.type !== "spell") continue;
                if (!domainSpellNamesAtLevel.has((item.name || "").toLowerCase().trim())) continue;
                domainCastSum += (item.system.cast ?? 0);
            }
            // Only warn when they would exceed (not when using the last slot). Avoid warning when domainSlotsAtLevel is 0 (data fallback should grant 1).
            const wouldExceed = domainSlotsAtLevel > 0 && domainCastSum >= domainSlotsAtLevel;
            if (wouldExceed) {
                ui.notifications.warn(game.i18n.format("THIRDERA.Spells.NoSlotsRemaining", { spell: spellItem.name }));
            }
        } else if (preparationType === "spontaneous") {
            const { SpellData } = await import("../data/item-spell.mjs");
            const spellListKey = classData.spellListKey;
            let castSum = 0;
            for (const item of this.items) {
                if (item.type !== "spell") continue;
                if (domainSpellNamesAtLevel.has((item.name || "").toLowerCase().trim())) continue; // exclude domain spells from regular slot count
                const itemLevel = SpellData.getLevelForClass(item.system, spellListKey);
                if (itemLevel === level) castSum += (item.system.cast ?? 0);
            }
            const remaining = Math.max(0, slotsAtLevel - castSum);
            if (remaining <= 0) {
                ui.notifications.warn(game.i18n.format("THIRDERA.Spells.NoSlotsRemaining", { spell: spellItem.name }));
            }
        } else if (preparationType === "prepared") {
            const prepared = spellItem.system.prepared ?? 0;
            const cast = spellItem.system.cast ?? 0;
            if (prepared <= 0 || cast >= prepared) {
                ui.notifications.warn(game.i18n.format("THIRDERA.Spells.NoPreparedCastRemaining", { spell: spellItem.name }));
            }
        }

        const currentCast = spellItem.system.cast ?? 0;
        await spellItem.update({ "system.cast": currentCast + 1 });

        const abilityMod = classData.abilityMod ?? 0;
        const abilityName = CONFIG.THIRDERA?.AbilityScores?.[classData.castingAbility] ?? classData.castingAbility ?? "";
        const totalDC = 10 + level + abilityMod;
        const abilityModSigned = abilityMod >= 0 ? `+${abilityMod}` : String(abilityMod);
        const srKey = spellItem.system.spellResistance ?? "";
        const srLabel = (CONFIG.THIRDERA?.spellResistanceChoices?.[srKey] ?? srKey) || "-";

        const actorName = this.name;
        const spellName = spellItem.name;
        const castsLabel = game.i18n.localize("THIRDERA.Spells.CastMessageCastsVerb");
        const dcPayload = { spellLevel: level, abilityMod: abilityModSigned, abilityName, total: totalDC };
        const srPayload = { value: srLabel };
        const dcLine = game.i18n.format("THIRDERA.Spells.SaveDCBreakdown", dcPayload);
        const srLine = game.i18n.format("THIRDERA.Spells.SpellResistanceLine", srPayload);

        const content = `<div class="thirdera cast-message">
  <p><strong>${actorName}</strong> ${castsLabel} <strong>${spellName}</strong>.</p>
  <div class="cast-dc-breakdown">${dcLine}</div>
  <p>${srLine}</p>
</div>`;

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content
        });

        return true;
    }
}
