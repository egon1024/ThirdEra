const { StringField, HTMLField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Domain items.
 * Domain spells are derived from spell documents' levelsByDomain (see getSpellsForDomain);
 * domain items do not store a spell list.
 * @extends {foundry.abstract.TypeDataModel}
 */
export class DomainData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            key: new StringField({ required: true, blank: true, initial: "", label: "Domain Key" })
        };
    }

    /** @override Strip legacy system.spells; domain spells are now derived from spell levelsByDomain. */
    static migrateData(source) {
        if (Object.prototype.hasOwnProperty.call(source, "spells")) {
            delete source.spells;
        }
        return super.migrateData(source);
    }
}
