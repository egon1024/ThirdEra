const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Race items
 * @extends {foundry.abstract.TypeDataModel}
 */
export class RaceData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            size: new StringField({ required: true, blank: false, initial: "Medium", choices: () => CONFIG.THIRDERA.sizes, label: "Size" }),
            speed: new NumberField({ required: true, integer: true, min: 0, initial: 30, label: "Base Land Speed" }),

            abilityAdjustments: new SchemaField({
                str: new NumberField({ required: true, integer: true, initial: 0, label: "Strength" }),
                dex: new NumberField({ required: true, integer: true, initial: 0, label: "Dexterity" }),
                con: new NumberField({ required: true, integer: true, initial: 0, label: "Constitution" }),
                int: new NumberField({ required: true, integer: true, initial: 0, label: "Intelligence" }),
                wis: new NumberField({ required: true, integer: true, initial: 0, label: "Wisdom" }),
                cha: new NumberField({ required: true, integer: true, initial: 0, label: "Charisma" })
            }),

            favoredClass: new StringField({ required: true, blank: true, initial: "", label: "Favored Class" })
        };
    }
}
