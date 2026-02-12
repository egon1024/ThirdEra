const { StringField, HTMLField, NumberField, SchemaField, ArrayField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Class Feature items
 * @extends {foundry.abstract.TypeDataModel}
 */
export class FeatureData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            key: new StringField({ required: true, blank: true, initial: "", label: "Feature Key" }),

            // Scaling table for features like Sneak Attack (1d6 -> 2d6)
            scalingTable: new ArrayField(new SchemaField({
                minLevel: new NumberField({ required: true, integer: true, min: 1, initial: 1, label: "Min Level" }),
                value: new StringField({ required: true, blank: true, initial: "", label: "Value" })
            }), { label: "Scaling Table" })
        };
    }
}
