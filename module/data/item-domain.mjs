const { StringField, HTMLField, NumberField, SchemaField, ArrayField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Domain items
 * @extends {foundry.abstract.TypeDataModel}
 */
export class DomainData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            key: new StringField({ required: true, blank: true, initial: "", label: "Domain Key" }),

            spells: new ArrayField(new SchemaField({
                level: new NumberField({
                    required: true, integer: true, min: 1, max: 9,
                    label: "Spell Level"
                }),
                spellName: new StringField({
                    required: true, blank: true,
                    label: "Spell Name"
                })
            }), { label: "Domain Spells" })
        };
    }
}
