import { getWieldingInfo, getTWFPenalties, getStrMultiplier } from "../data/_damage-helpers.mjs";

/**
 * Extended Item document class for Third Era
 * @extends {Item}
 */
export class ThirdEraItem extends Item {

    /** @override */
    async _preCreate(data, options, user) {
        await super._preCreate(data, options, user);

        // Auto-generate a key if not already set (skills, feats, features, domains)
        if ((data.type === "skill" || data.type === "feat" || data.type === "feature" || data.type === "domain") && !data.system?.key) {
            this.updateSource({ "system.key": foundry.utils.randomID() });
        }
    }

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

        // Normalize legacy equipped values: "true" → "primary", "false" → "none"
        if (systemData.equipped === "true") systemData.equipped = "primary";
        else if (systemData.equipped === "false") systemData.equipped = "none";

        // Compute wielding info when owned by an actor
        if (this.actor) {
            systemData.wielding = getWieldingInfo(
                systemData.properties.size,
                systemData.properties.handedness,
                this.actor.system.details.size
            );

            // Determine TWF state by scanning sibling weapons
            const hand = systemData.equipped; // "none", "primary", or "offhand"
            systemData.twf = { active: false, penalty: 0, label: "" };

            if (hand === "primary" || hand === "offhand") {
                const otherHand = hand === "primary" ? "offhand" : "primary";
                let siblingInOtherHand = null;

                for (const other of this.actor.items) {
                    if (other.id === this.id) continue;
                    if (other.type !== "weapon") continue;
                    // Normalize sibling's equipped value for comparison
                    let otherEquipped = other.system.equipped;
                    if (otherEquipped === "true") otherEquipped = "primary";
                    else if (otherEquipped === "false") otherEquipped = "none";
                    if (otherEquipped === otherHand) {
                        siblingInOtherHand = other;
                        break;
                    }
                }

                // TWF applies when both hands are occupied, or when this weapon
                // is in the off-hand (off-hand attacks are inherently TWF per SRD)
                const twfActive = siblingInOtherHand !== null || hand === "offhand";

                if (twfActive) {
                    // Compute the off-hand weapon's effective handedness on-the-fly
                    const offhandWeapon = hand === "offhand" ? this : siblingInOtherHand;
                    const offhandWielding = getWieldingInfo(
                        offhandWeapon.system.properties.size,
                        offhandWeapon.system.properties.handedness,
                        this.actor.system.details.size
                    );
                    const offhandEffective = offhandWielding.effectiveHandedness || "oneHanded";
                    const penalties = getTWFPenalties(offhandEffective);

                    const myPenalty = hand === "primary" ? penalties.primaryPenalty : penalties.offhandPenalty;
                    systemData.twf = {
                        active: true,
                        penalty: myPenalty,
                        label: `${myPenalty} TWF`
                    };
                }
            }

            // Compute STR damage multiplier
            const effectiveHandedness = systemData.wielding?.effectiveHandedness || systemData.properties.handedness;
            systemData.strMultiplier = getStrMultiplier(hand, effectiveHandedness);
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
     * Prepare Skill specific derived data.
     * Note: Basic total only (ability mod + ranks + misc). Class skill status,
     * max ranks, and armor check penalty are applied later in the actor's
     * prepareDerivedData, which runs after embedded items are prepared.
     */
    _prepareSkillData(itemData) {
        const systemData = itemData.system;

        // Calculate basic total skill modifier if on an actor
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
        // SRD: 0.5x/1.5x multipliers only apply to positive STR bonuses;
        // STR penalties are always applied at full value regardless of hand
        let strMod = 0;
        if (this.actor && weaponData.properties.melee === 'melee') {
            const rawStr = this.actor.system.abilities.str?.mod || 0;
            const multiplier = weaponData.strMultiplier ?? 1;
            strMod = rawStr >= 0 ? Math.floor(rawStr * multiplier) : rawStr;
        }

        const roll = await new Roll(`${damageDice} + ${strMod}`).roll();

        // Build flavor text with hand label
        const handLabels = { primary: "Primary", offhand: "Off-Hand" };
        const handLabel = handLabels[weaponData.equipped] || "";
        let flavor = `${this.name} Damage`;
        if (handLabel) flavor += ` (${handLabel})`;

        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor
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
        const twfPenalty = weaponData.twf?.penalty || 0;
        const attackBonus = baseAttack + sizePenalty + twfPenalty;

        const roll = await new Roll(`1d20 + ${attackBonus}`).roll();

        // Build flavor text with hand label and penalty breakdown
        const handLabels = { primary: "Primary", offhand: "Off-Hand" };
        const handLabel = handLabels[weaponData.equipped] || "";
        let flavor = `${this.name} Attack`;
        if (handLabel) flavor += ` (${handLabel})`;

        const penalties = [];
        if (twfPenalty) penalties.push(`${twfPenalty} TWF`);
        if (sizePenalty) penalties.push(`${sizePenalty} size`);
        if (penalties.length) flavor += ` [${penalties.join(", ")}]`;

        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor
        });

        return roll;
    }
}
