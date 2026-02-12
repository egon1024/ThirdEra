const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;
import { getEffectiveMaxDex, applyMaxDex, computeAC, computeSpeed } from "./_ac-helpers.mjs";
import { getCarryingCapacity, getLoadStatus } from "./_encumbrance-helpers.mjs";

/**
 * Data model for D&D 3.5 NPC actors
 * @extends {foundry.abstract.TypeDataModel}
 */
export class NPCData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            // Ability Scores (same as character)
            abilities: new SchemaField({
                str: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                dex: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                con: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                int: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                wis: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                cha: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                })
            }),

            // NPC Details (simplified)
            details: new SchemaField({
                type: new StringField({ required: true, blank: true, initial: "" }),
                cr: new StringField({ required: true, blank: true, initial: "1" }),
                alignment: new StringField({ required: true, blank: true, initial: "" }),
                size: new StringField({ required: true, blank: false, initial: "Medium", choices: () => CONFIG.THIRDERA.sizes })
            }),

            // Hit Points
            attributes: new SchemaField({
                hp: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
                    max: new NumberField({ required: true, integer: true, min: 1, initial: 1 })
                }),
                ac: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    touch: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    flatFooted: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    misc: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                initiative: new SchemaField({
                    bonus: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                speed: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 30 })
                })
            }),

            // Saving Throws
            saves: new SchemaField({
                fort: new SchemaField({
                    base: new NumberField({ required: true, integer: true, initial: 0 }),
                    total: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                ref: new SchemaField({
                    base: new NumberField({ required: true, integer: true, initial: 0 }),
                    total: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                will: new SchemaField({
                    base: new NumberField({ required: true, integer: true, initial: 0 }),
                    total: new NumberField({ required: true, integer: true, initial: 0 })
                })
            }),

            // Combat Stats
            combat: new SchemaField({
                bab: new NumberField({ required: true, integer: true, initial: 0 }),
                grapple: new NumberField({ required: true, integer: true, initial: 0 }),
                meleeAttack: new SchemaField({
                    misc: new NumberField({ required: true, integer: true, initial: 0 }),
                    total: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                rangedAttack: new SchemaField({
                    misc: new NumberField({ required: true, integer: true, initial: 0 }),
                    total: new NumberField({ required: true, integer: true, initial: 0 })
                })
            }),

            // Biography/Description
            biography: new HTMLField({ required: true, blank: true }),

            // Currency
            currency: new SchemaField({
                pp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Platinum (pp)" }),
                gp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Gold (gp)" }),
                sp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Silver (sp)" }),
                cp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Copper (cp)" })
            })
        };
    }

    /**
     * Prepare derived data for the NPC
     */
    prepareDerivedData() {
        // Calculate ability modifiers
        for (const [key, ability] of Object.entries(this.abilities)) {
            ability.mod = Math.floor((ability.value - 10) / 2);
        }

        // Apply armor max-Dex cap to Dex modifier before any derived calculations
        const effectiveMaxDex = getEffectiveMaxDex(this);
        applyMaxDex(this, effectiveMaxDex);

        // Calculate initiative
        this.attributes.initiative.bonus = this.abilities.dex.mod;

        // Calculate saves
        this.saves.fort.total = this.saves.fort.base + this.abilities.con.mod;
        this.saves.ref.total = this.saves.ref.base + this.abilities.dex.mod;
        this.saves.will.total = this.saves.will.base + this.abilities.wis.mod;

        // Size modifier for attack rolls and grapple
        const sizeMod = CONFIG.THIRDERA.sizeModifiers?.[this.details.size] ?? 0;
        this.combat.sizeMod = sizeMod;

        // Calculate grapple
        this.combat.grapple = this.combat.bab + this.abilities.str.mod;

        // Calculate melee and ranged attack bonuses
        this.combat.meleeAttack.total = this.combat.bab + this.abilities.str.mod + sizeMod + this.combat.meleeAttack.misc;
        this.combat.meleeAttack.breakdown = [
            { label: "BAB", value: this.combat.bab },
            { label: "STR", value: this.abilities.str.mod },
            { label: "Size", value: sizeMod }
        ];

        this.combat.rangedAttack.total = this.combat.bab + this.abilities.dex.mod + sizeMod + this.combat.rangedAttack.misc;
        this.combat.rangedAttack.breakdown = [
            { label: "BAB", value: this.combat.bab },
            { label: "DEX", value: this.abilities.dex.mod },
            { label: "Size", value: sizeMod }
        ];

        // Calculate AC values from equipped armor, dex, size, and misc
        computeAC(this);

        // Apply armor speed reduction (medium/heavy armor)
        computeSpeed(this);

        // Calculate inventory weight and load
        let totalWeight = 0;
        for (const item of this.parent.items) {
            const weight = item.system.weight || 0;
            const quantity = item.system.quantity || 1;
            totalWeight += weight * quantity;
        }

        // Add currency weight if setting enabled
        const trackCoinWeight = game.settings.get("thirdera", "currencyWeight");
        if (trackCoinWeight) {
            const c = this.currency;
            const totalCoins = (c.pp || 0) + (c.gp || 0) + (c.sp || 0) + (c.cp || 0);
            if (totalCoins > 0) {
                totalWeight += Math.floor(totalCoins / 50);
            }
        }

        const capacity = getCarryingCapacity(this.abilities.str.value, this.details.size);
        const load = getLoadStatus(totalWeight, capacity);

        this.inventory = {
            totalWeight,
            capacity,
            load
        };
    }
}
