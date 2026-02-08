const { NumberField, SchemaField, StringField, HTMLField, ArrayField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Spell items
 * @extends {foundry.abstract.TypeDataModel}
 */
export class SpellData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            level: new NumberField({ required: true, integer: true, min: 0, max: 9, initial: 0, label: "Spell Level" }),
            school: new StringField({ required: true, blank: true, initial: "", label: "School of Magic" }),

            components: new SchemaField({
                verbal: new StringField({ required: true, blank: false, initial: "false", label: "Verbal" }),
                somatic: new StringField({ required: true, blank: false, initial: "false", label: "Somatic" }),
                material: new StringField({ required: true, blank: false, initial: "false", label: "Material" }),
                focus: new StringField({ required: true, blank: false, initial: "false", label: "Focus" }),
                divineFocus: new StringField({ required: true, blank: false, initial: "false", label: "Divine Focus" }),
                xp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "XP Cost" }),
                materialDescription: new StringField({ required: true, blank: true, initial: "", label: "Material Components" })
            }),

            castingTime: new StringField({ required: true, blank: true, initial: "1 standard action", label: "Casting Time" }),
            range: new StringField({ required: true, blank: true, initial: "", label: "Range" }),
            target: new StringField({ required: true, blank: true, initial: "", label: "Target/Area/Effect" }),
            duration: new StringField({ required: true, blank: true, initial: "", label: "Duration" }),
            savingThrow: new StringField({ required: true, blank: true, initial: "", label: "Saving Throw" }),
            spellResistance: new StringField({ required: true, blank: true, initial: "", label: "Spell Resistance" }),

            prepared: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Times Prepared" }),
            cast: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Times Cast" })
        };
    }

    /** @override */
    static migrateData(source) {
        if (source.components?.xp && typeof source.components.xp === "string") {
            source.components.xp = parseInt(source.components.xp) || 0;
        }
        return super.migrateData(source);
    }
}
