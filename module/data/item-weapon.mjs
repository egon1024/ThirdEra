import { getEffectiveDamage } from "./_damage-helpers.mjs";

const { NumberField, SchemaField, StringField, HTMLField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Weapon items
 * @extends {foundry.abstract.TypeDataModel}
 */
export class WeaponData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            damage: new SchemaField({
                dice: new StringField({ required: true, blank: false, initial: "1d8", label: "Damage Dice" }),
                type: new StringField({ required: true, blank: true, initial: "", label: "Damage Type" })
            }),

            critical: new SchemaField({
                range: new NumberField({ required: true, integer: true, min: 1, initial: 20, label: "Threat Range" }),
                multiplier: new NumberField({ required: true, integer: true, min: 2, initial: 2, label: "Critical Multiplier" })
            }),

            range: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Range (ft)" }),

            properties: new SchemaField({
                melee: new StringField({ required: true, blank: false, initial: "melee", label: "Weapon Type" }), // melee or ranged
                handedness: new StringField({ required: true, blank: false, initial: "oneHanded", choices: () => CONFIG.THIRDERA.weaponHandedness, label: "Handedness" }),
                size: new StringField({ required: true, blank: false, initial: "Medium", choices: () => CONFIG.THIRDERA.sizes, label: "Size" }),
                proficiency: new StringField({ required: true, blank: true, initial: "simple", label: "Proficiency" }) // simple, martial, exotic
            }),

            cost: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Cost (gp)" }),
            weight: new NumberField({ required: true, nullable: false, min: 0, initial: 0, label: "Weight (lbs)" }),
            quantity: new NumberField({ required: true, integer: true, min: 0, initial: 1, label: "Quantity" }),

            equipped: new StringField({ required: true, blank: false, initial: "none", label: "Equipped" })
        };
    }

    /** @override */
    prepareDerivedData() {
        this.damage.effectiveDice = getEffectiveDamage(this.damage.dice, this.properties.size);
    }
}
