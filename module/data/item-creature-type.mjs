const { HTMLField, SchemaField, StringField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Creature Type items (e.g. Humanoid, Dragon, Undead).
 * Used by NPCs to reference one creature type; type can provide default hit die for stat-block.
 * @extends {foundry.abstract.TypeDataModel}
 */
export class CreatureTypeData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            key: new StringField({ required: true, blank: true, initial: "", label: "Creature Type Key" }),
            defaultHitDie: new StringField({
                required: true,
                blank: true,
                initial: "d8",
                choices: () => CONFIG.THIRDERA?.hitDice ?? { d4: "d4", d6: "d6", d8: "d8", d10: "d10", d12: "d12" },
                label: "Default Hit Die"
            }),
            description: new HTMLField({ required: true, blank: true, label: "Description" })
        };
    }
}
