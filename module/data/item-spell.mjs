const { NumberField, SchemaField, StringField, HTMLField, ArrayField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Spell items
 * @extends {foundry.abstract.TypeDataModel}
 */
export class SpellData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            /** Legacy single level; used as fallback when no levelsByClass entry matches the class */
            level: new NumberField({ required: true, integer: true, min: 0, max: 9, initial: 0, label: "Spell Level (fallback)" }),

            /** Per-class spell levels. Add entries by dragging class items onto the spell sheet. Supports custom and prestige classes. */
            levelsByClass: new ArrayField(new SchemaField({
                classKey: new StringField({ required: true, blank: false, label: "Class Spell List Key" }),
                className: new StringField({ required: true, blank: true, label: "Class Name (display)" }),
                level: new NumberField({ required: true, integer: true, min: 0, max: 9, label: "Spell Level" })
            }), { initial: [], label: "Level by Class" }),

            /** Per-domain spell levels. Add entries by dragging domain items onto the spell sheet. */
            levelsByDomain: new ArrayField(new SchemaField({
                domainKey: new StringField({ required: true, blank: false, label: "Domain Key" }),
                domainName: new StringField({ required: true, blank: true, label: "Domain Name (display)" }),
                level: new NumberField({ required: true, integer: true, min: 1, max: 9, label: "Spell Level" })
            }), { initial: [], label: "Level by Domain" }),
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
        // Backfill className for levelsByClass entries that lack it (legacy data)
        if (source.levelsByClass) {
            const keys = CONFIG.THIRDERA?.spellListKeys || {};
            for (const entry of source.levelsByClass) {
                if (!entry.className && entry.classKey) {
                    entry.className = keys[entry.classKey] ?? entry.classKey;
                }
            }
        }
        return super.migrateData(source);
    }

    /**
     * Get the spell level for a given spell list key.
     * @param {object} spellData     Spell system data (system property of spell item)
     * @param {string} spellListKey  Class spell list key (e.g., sorcererWizard, cleric)
     * @returns {number}             Spell level (0-9), or fallback level if no matching entry
     */
    static getLevelForClass(spellData, spellListKey) {
        if (!spellData) return 0;
        const levelsByClass = spellData.levelsByClass || [];
        const entry = levelsByClass.find(e => e.classKey === spellListKey);
        if (entry != null) return entry.level;
        return spellData.level ?? 0;
    }
}
