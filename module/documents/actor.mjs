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
}
