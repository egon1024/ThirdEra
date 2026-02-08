const { StringField, HTMLField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Feat items
 * @extends {foundry.abstract.TypeDataModel}
 */
export class FeatData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            type: new StringField({ required: true, blank: true, initial: "", label: "Feat Type" }), // General, Item Creation, Metamagic, etc.
            prerequisites: new StringField({ required: true, blank: true, initial: "", label: "Prerequisites" }),
            benefit: new HTMLField({ required: true, blank: true, label: "Benefit" }),
            special: new HTMLField({ required: true, blank: true, label: "Special" })
        };
    }
}
