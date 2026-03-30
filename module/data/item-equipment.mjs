import { migrateDataCgsGrants } from "./cgs-grants-migrate-helpers.mjs";

const { ArrayField, BooleanField, HTMLField, NumberField, ObjectField, SchemaField, StringField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Equipment/Gear items
 * @extends {foundry.abstract.TypeDataModel}
 */
export class EquipmentData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            quantity: new NumberField({ required: true, integer: true, min: 0, initial: 1, label: "Quantity" }),
            cost: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Cost (gp)" }),
            weight: new NumberField({ required: true, nullable: false, min: 0, initial: 0, label: "Weight (lbs)" }),

            equipped: new StringField({ required: true, blank: false, initial: "false", label: "Equipped" }),

            /** Optional mechanical modifiers when equipped (generalized modifier system). Same key set as conditions/feats. */
            changes: new ArrayField(new SchemaField({
                key: new StringField({ required: true, blank: true, initial: "", label: "Key" }),
                value: new NumberField({ required: true, initial: 0, label: "Value" }),
                label: new StringField({ required: false, blank: true, initial: "", label: "Label" })
            }), { required: false, initial: [], label: "Modifiers" }),

            // Container properties
            isContainer: new BooleanField({ required: true, initial: false, label: "Is Container" }),
            containerCapacity: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Container Capacity (lbs)" }),
            weightMode: new StringField({ required: true, blank: false, initial: "full", choices: () => ({ full: "Full Weight", fixed: "Fixed Weight", reduced: "Reduced Weight" }), label: "Weight Mode" }),
            freeRetrieval: new StringField({ required: true, blank: false, initial: "false", label: "Free Retrieval" }),

            // Track which container this item is in (if any)
            containerId: new StringField({ required: true, blank: true, initial: "", label: "Container ID" }),

            /** CGS grants while this gear is equipped (mirrors `changes` + GMS). */
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
        migrateDataCgsGrants(source);
        return super.migrateData(source);
    }
}
