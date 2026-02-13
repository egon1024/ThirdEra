const { NumberField, SchemaField, StringField, HTMLField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Armor items
 * @extends {foundry.abstract.TypeDataModel}
 */
export class ArmorData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            armor: new SchemaField({
                type: new StringField({ required: true, blank: false, initial: "light", label: "Armor Type" }), // light, medium, heavy, shield
                bonus: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Armor Bonus" }),
                maxDex: new NumberField({ required: true, integer: true, nullable: true, initial: null, label: "Max Dex Bonus" }),
                checkPenalty: new NumberField({ required: true, integer: true, max: 0, initial: 0, label: "Armor Check Penalty" }),
                spellFailure: new NumberField({ required: true, integer: true, min: 0, max: 100, initial: 0, label: "Arcane Spell Failure %" })
            }),

            size: new StringField({ required: true, blank: false, initial: "Medium", choices: () => CONFIG.THIRDERA.sizes, label: "Size" }),

            speed: new SchemaField({
                ft30: new NumberField({ required: true, integer: true, min: 0, initial: 30, label: "Speed (30 ft base)" }),
                ft20: new NumberField({ required: true, integer: true, min: 0, initial: 20, label: "Speed (20 ft base)" })
            }),

            cost: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Cost (gp)" }),
            weight: new NumberField({ required: true, nullable: false, min: 0, initial: 0, label: "Weight (lbs)" }),
            quantity: new NumberField({ required: true, integer: true, min: 0, initial: 1, label: "Quantity" }),

            equipped: new StringField({ required: true, blank: false, initial: "false", label: "Equipped" })
        };
    }
}
