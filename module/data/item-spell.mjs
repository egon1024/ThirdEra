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

            /** School key referencing a School item. Used for specialization, prohibited schools, etc. */
            schoolKey: new StringField({ required: true, blank: true, initial: "", label: "School Key" }),
            /** Display name for the school (stored when school item is assigned). */
            schoolName: new StringField({ required: true, blank: true, initial: "", label: "School Name (display)" }),
            /** Optional subschool, e.g. "(Healing)" for Conjuration (Healing), "Figment" for Illusion. */
            schoolSubschool: new StringField({ required: true, blank: true, initial: "", label: "School Subschool" }),
            /** Descriptor tags, e.g. [Fire], [Mind-Affecting]. Multiple allowed. */
            schoolDescriptors: new ArrayField(new StringField({ required: true, blank: true, label: "Descriptor" }), { initial: [], label: "School Descriptors" }),

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
        // Backfill schoolName from CONFIG when schoolKey exists but schoolName is empty
        if (source.schoolKey && !source.schoolName) {
            const schools = CONFIG.THIRDERA?.schools || {};
            source.schoolName = schools[source.schoolKey] ?? source.schoolKey;
        }
        // Migrate legacy school string to schoolKey / schoolSubschool / schoolDescriptors
        if (source.school && typeof source.school === "string" && !source.schoolKey) {
            const parsed = SpellData.#parseLegacySchoolString(source.school);
            source.schoolKey = parsed.schoolKey;
            source.schoolName = parsed.schoolName;
            source.schoolSubschool = parsed.schoolSubschool;
            source.schoolDescriptors = parsed.schoolDescriptors;
            delete source.school;
        }
        // Migrate legacy schoolDescriptor to schoolSubschool / schoolDescriptors
        if (source.schoolDescriptor !== undefined && source.schoolDescriptor !== null) {
            const parsed = SpellData.#parseLegacyDescriptorString(String(source.schoolDescriptor).trim());
            if (!source.schoolSubschool) source.schoolSubschool = parsed.schoolSubschool;
            if (!source.schoolDescriptors?.length && parsed.schoolDescriptors?.length) {
                source.schoolDescriptors = parsed.schoolDescriptors;
            }
            delete source.schoolDescriptor;
        }
        return super.migrateData(source);
    }

    /**
     * Parse a legacy school string like "Evocation [Fire]" or "Conjuration (Healing) [Good]".
     * @param {string} s
     * @returns {{ schoolKey: string, schoolName: string, schoolSubschool: string, schoolDescriptors: string[] }}
     */
    static #parseLegacySchoolString(s) {
        const result = { schoolKey: "", schoolName: "", schoolSubschool: "", schoolDescriptors: [] };
        const trimmed = s.trim();
        if (!trimmed) return result;
        // Extract subschool (parentheses) and descriptors (brackets)
        const subMatch = trimmed.match(/\(([^)]+)\)/g);
        const descMatch = trimmed.match(/\[([^\]]+)\]/g);
        let base = trimmed;
        if (subMatch) base = base.replace(subMatch.join(" "), "").trim();
        if (descMatch) base = base.replace(descMatch.map((m) => m).join(" "), "").trim();
        base = base.replace(/\s+/g, " ").trim();
        result.schoolKey = base.toLowerCase().replace(/\s+/g, "");
        result.schoolName = base;
        if (subMatch?.length) result.schoolSubschool = subMatch[0]; // e.g. "(Healing)"
        if (descMatch?.length) result.schoolDescriptors = descMatch; // e.g. ["[Fire]", "[Good]"]
        return result;
    }

    /**
     * Parse a legacy schoolDescriptor string into subschool and descriptors.
     * @param {string} s
     * @returns {{ schoolSubschool: string, schoolDescriptors: string[] }}
     */
    static #parseLegacyDescriptorString(s) {
        const result = { schoolSubschool: "", schoolDescriptors: [] };
        if (!s) return result;
        const subMatch = s.match(/\(([^)]+)\)/g);
        const descMatch = s.match(/\[([^\]]+)\]/g);
        if (subMatch?.length) result.schoolSubschool = subMatch[0];
        if (descMatch?.length) result.schoolDescriptors = descMatch;
        // If no brackets/parens, treat as single descriptor (legacy free-text)
        if (!result.schoolSubschool && !result.schoolDescriptors.length && s) {
            result.schoolDescriptors = [s];
        }
        return result;
    }

    /**
     * Format the full school display string (e.g. "Evocation (Creation) [Fire] [Mind-Affecting]").
     * @param {object} system  Spell system data
     * @returns {string}
     */
    static formatSchoolDisplay(system) {
        if (!system?.schoolName) return "";
        let out = system.schoolName;
        if (system.schoolSubschool?.trim()) out += ` ${system.schoolSubschool}`;
        const descs = system.schoolDescriptors ?? [];
        for (const d of descs) {
            if (d?.trim()) out += ` ${d}`;
        }
        return out.trim();
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
