const { NumberField, SchemaField, StringField, HTMLField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Skill items
 * @extends {foundry.abstract.TypeDataModel}
 */
export class SkillData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            key: new StringField({ required: true, blank: true, initial: "", label: "Skill Key" }),
            ability: new StringField({ required: true, blank: false, initial: "int", label: "Key Ability" }), // str, dex, con, int, wis, cha
            ranks: new NumberField({ required: true, integer: false, min: 0, initial: 0, label: "Ranks" }),

            modifier: new SchemaField({
                misc: new NumberField({ required: true, integer: true, initial: 0, label: "Misc Modifier" }),
                total: new NumberField({ required: true, integer: false, initial: 0, label: "Total Modifier" })
            }),

            trainedOnly: new StringField({ required: true, blank: false, initial: "false", label: "Trained Only" }),
            armorCheckPenalty: new StringField({ required: true, blank: false, initial: "false", label: "Armor Check Penalty Applies" }),
            exclusive: new StringField({ required: true, blank: false, initial: "false", label: "Exclusive (Class Skill Only)" })
        };
    }
}
