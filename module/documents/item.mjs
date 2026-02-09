import { getWieldingInfo } from "../data/_damage-helpers.mjs";

/**
 * Extended Item document class for Third Era
 * @extends {Item}
 */
export class ThirdEraItem extends Item {

    /**
     * Augment the basic item data with additional dynamic data.
     */
    prepareData() {
        super.prepareData();
    }

    /**
     * Prepare item data that doesn't depend on other data  
     */
    prepareBaseData() {
        super.prepareBaseData();
    }

    /**
     * Prepare item derived data
     */
    prepareDerivedData() {
        super.prepareDerivedData();

        const itemData = this;
        const systemData = itemData.system;

        // Make separate methods for each Item type
        if (itemData.type === 'weapon') this._prepareWeaponData(itemData);
        if (itemData.type === 'armor') this._prepareArmorData(itemData);
        if (itemData.type === 'spell') this._prepareSpellData(itemData);
        if (itemData.type === 'skill') this._prepareSkillData(itemData);
    }

    /**
     * Prepare Weapon specific derived data
     */
    _prepareWeaponData(itemData) {
        const systemData = itemData.system;

        // Compute wielding info when owned by an actor
        if (this.actor) {
            systemData.wielding = getWieldingInfo(
                systemData.properties.size,
                systemData.properties.handedness,
                this.actor.system.details.size
            );
        }
    }

    /**
     * Prepare Armor specific derived data
     */
    _prepareArmorData(itemData) {
        const systemData = itemData.system;
        // Add any armor-specific calculations here
    }

    /**
     * Prepare Spell specific derived data
     */
    _prepareSpellData(itemData) {
        const systemData = itemData.system;
        // Add any spell-specific calculations here
    }

    /**
     * Prepare Skill specific derived data
     */
    _prepareSkillData(itemData) {
        const systemData = itemData.system;

        // Calculate total skill modifier if on an actor
        if (this.actor) {
            const abilityMod = this.actor.system.abilities[systemData.ability]?.mod || 0;
            const ranks = systemData.ranks || 0;
            const misc = systemData.modifier?.misc || 0;
            systemData.modifier.total = abilityMod + ranks + misc;
        }
    }

    /**
     * Roll weapon damage
     */
    async rollDamage() {
        if (this.type !== 'weapon') {
            ui.notifications.warn("Only weapons can roll damage.");
            return null;
        }

        const weaponData = this.system;
        const damageDice = weaponData.damage.effectiveDice ?? weaponData.damage.dice;

        // Get strength modifier if actor exists and weapon is melee
        let strMod = 0;
        if (this.actor && weaponData.properties.melee === 'melee') {
            strMod = this.actor.system.abilities.str?.mod || 0;
        }

        const roll = await new Roll(`${damageDice} + ${strMod}`).roll();

        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: `${this.name} Damage`
        });

        return roll;
    }

    /**
     * Roll weapon attack
     */
    async rollAttack() {
        if (this.type !== 'weapon') {
            ui.notifications.warn("Only weapons can roll attacks.");
            return null;
        }

        if (!this.actor) {
            ui.notifications.warn("This weapon is not owned by an actor.");
            return null;
        }

        const weaponData = this.system;
        const actorData = this.actor.system;

        // Block attack if weapon can't be wielded due to size mismatch
        if (weaponData.wielding && !weaponData.wielding.canWield) {
            ui.notifications.warn(`${this.name} is too large/small for ${this.actor.name} to wield.`);
            return null;
        }

        // Use precomputed melee/ranged attack totals (includes BAB + ability mod + misc)
        const baseAttack = (weaponData.properties.melee === 'melee')
            ? actorData.combat.meleeAttack.total
            : actorData.combat.rangedAttack.total;
        const sizePenalty = weaponData.wielding?.attackPenalty || 0;
        const attackBonus = baseAttack + sizePenalty;

        const roll = await new Roll(`1d20 + ${attackBonus}`).roll();

        let flavor = `${this.name} Attack`;
        if (sizePenalty) flavor += ` (${sizePenalty} size)`;

        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor
        });

        return roll;
    }
}
