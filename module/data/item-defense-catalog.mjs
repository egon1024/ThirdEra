const { HTMLField, StringField } = foundry.data.fields;

/**
 * Authoring item for extended typed-defense vocabulary (homebrew / modules).
 * Each entry maps one key used in grants (`catalogKey`) to a display label (item name) for merged CGS readouts.
 * It does not store mechanical numbers (e.g. DR amount, resistance value); those live on grants on feats/items/actors.
 * Keys must match strings stored on CGS grants (`tag`, `energyType`, `bypass`);
 * labels override CONFIG defaults for merged actor display.
 * @extends {foundry.abstract.TypeDataModel}
 */
export class DefenseCatalogData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            /** Token matching CGS grant payloads (e.g. fire, poison, adamantine, magic) — not the item document id. */
            catalogKey: new StringField({ required: true, blank: true, initial: "", label: "Text on items that grant the defense" }),
            catalogKind: new StringField({
                required: true,
                blank: false,
                initial: "immunityTag",
                choices: () => ({
                    immunityTag: "Immunity tag",
                    energyType: "Energy type",
                    energyResistance: "Energy resistance (type label)",
                    drBypass: "DR bypass"
                }),
                label: "Applies to"
            }),
            description: new HTMLField({ required: true, blank: true, label: "Description" })
        };
    }
}
