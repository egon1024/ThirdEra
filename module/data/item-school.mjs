const { StringField, HTMLField, ArrayField, SchemaField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 School of Magic items
 * @extends {foundry.abstract.TypeDataModel}
 */
export class SchoolData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            /** Unique key for references (auto-generated, not shown in UI) */
            key: new StringField({ required: true, blank: true, initial: "", label: "School Key" }),

            /** Schools that are typically prohibited when a wizard specializes in this school. */
            oppositionSchools: new ArrayField(new SchemaField({
                schoolKey: new StringField({ required: true, blank: false, label: "School Key" }),
                schoolName: new StringField({ required: true, blank: true, label: "School Name (display)" })
            }), { initial: [], label: "Opposition Schools" }),

            /** Subschools within this school (e.g., Figment, Glamer for Illusion). */
            subschools: new ArrayField(new StringField({ required: true, blank: true, label: "Subschool" }), { initial: [], label: "Subschools" }),

            /** Descriptor tags commonly associated with this school (e.g., Fire, Mind-Affecting). */
            descriptorTags: new ArrayField(new StringField({ required: true, blank: true, label: "Descriptor" }), { initial: [], label: "Descriptor Tags" })
        };
    }
}
