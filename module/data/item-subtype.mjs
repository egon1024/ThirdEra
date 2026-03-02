const { HTMLField, StringField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Subtype items (e.g. Fire, Aquatic, Shapechanger).
 * Used by NPCs to reference zero or more subtypes; subtypes affect rules (e.g. Favored Enemy).
 * @extends {foundry.abstract.TypeDataModel}
 */
export class SubtypeData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            key: new StringField({ required: true, blank: true, initial: "", label: "Subtype Key" }),
            description: new HTMLField({ required: true, blank: true, label: "Description" })
        };
    }
}
