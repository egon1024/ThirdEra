import { migrateDataCgsGrants } from "./cgs-grants-migrate-helpers.mjs";

const { ArrayField, HTMLField, NumberField, ObjectField, SchemaField, StringField } = foundry.data.fields;

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
            }), { label: "Scaling Table" }),

            /** Optional structured CGS grants (senses, …); numeric class features stay in GMS on feats/items as appropriate. */
            cgsGrants: new SchemaField(
                {
                    grants: new ArrayField(new ObjectField(), {
                        required: true,
                        initial: [],
                        label: "Capability grants"
                    }),
                    senses: new ArrayField(
                        new SchemaField({
                            type: new StringField({ required: true, blank: true, initial: "", label: "Sense type" }),
                            range: new StringField({ required: true, blank: true, initial: "", label: "Range" })
                        }),
                        { required: false, initial: [], label: "Senses" }
                    )
                },
                { required: false, label: "Capability grants" }
            )
        };
    }

    /** @override */
    static migrateData(source) {
        try {
            migrateDataCgsGrants(source);
        } catch (err) {
            console.warn("ThirdEra | FeatureData migrateData (cgsGrants) failed:", err);
        }
        return super.migrateData(source);
    }
}
