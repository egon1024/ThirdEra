const { StringField, HTMLField, NumberField, SchemaField, ArrayField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Feat items
 * @extends {foundry.abstract.TypeDataModel}
 */
export class FeatData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            key: new StringField({ required: true, blank: true, initial: "", label: "Feat Key" }),

            type: new StringField({ required: true, blank: true, initial: "", label: "Feat Type" }), // General, Item Creation, Metamagic, etc.
            prerequisites: new StringField({ required: true, blank: true, initial: "", label: "Prerequisites" }),
            benefit: new HTMLField({ required: true, blank: true, label: "Benefit" }),
            special: new HTMLField({ required: true, blank: true, label: "Special" }),

            /** Document UUIDs of required feat documents (ID-based references per project rule). */
            prerequisiteFeatUuids: new ArrayField(new StringField({ required: true, blank: true, initial: "" }), { initial: [], label: "Prerequisite Feat UUIDs" }),
            /** Minimum base attack bonus required (0 = no requirement). */
            prerequisiteBAB: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Prerequisite BAB" }),
            /** Minimum ability scores required per ability key (0 = no requirement for that ability). */
            prerequisiteAbilityScores: new SchemaField({
                str: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
                dex: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
                con: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
                int: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
                wis: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
                cha: new NumberField({ required: true, integer: true, min: 0, initial: 0 })
            }, { label: "Prerequisite Ability Scores" }),

            scalingTable: new ArrayField(new SchemaField({
                minLevel: new NumberField({ required: true, integer: true, min: 1, initial: 1, label: "Min Level" }),
                value: new StringField({ required: true, blank: true, initial: "", label: "Value" })
            }), { label: "Scaling Table" })
        };
    }
}
