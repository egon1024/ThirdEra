const { HTMLField, SchemaField, StringField, NumberField, ArrayField, BooleanField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Class items
 * @extends {foundry.abstract.TypeDataModel}
 */
export class ClassData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            hitDie: new StringField({
                required: true, blank: false, initial: "d8",
                choices: () => CONFIG.THIRDERA.hitDice,
                label: "Hit Die"
            }),

            babProgression: new StringField({
                required: true, blank: false, initial: "average",
                choices: () => CONFIG.THIRDERA.babProgressions,
                label: "BAB Progression"
            }),

            saves: new SchemaField({
                fort: new StringField({
                    required: true, blank: false, initial: "poor",
                    choices: () => CONFIG.THIRDERA.saveProgressions,
                    label: "Fortitude"
                }),
                ref: new StringField({
                    required: true, blank: false, initial: "poor",
                    choices: () => CONFIG.THIRDERA.saveProgressions,
                    label: "Reflex"
                }),
                will: new StringField({
                    required: true, blank: false, initial: "poor",
                    choices: () => CONFIG.THIRDERA.saveProgressions,
                    label: "Will"
                })
            }),

            skillPointsPerLevel: new NumberField({
                required: true, integer: true, min: 0, initial: 2,
                label: "Skill Points per Level"
            }),

            classSkills: new ArrayField(new SchemaField({
                key: new StringField({ required: true, blank: false, label: "Skill Key" }),
                name: new StringField({ required: false, blank: true, label: "Skill Name" })
            }), { label: "Class Skills" }),

            features: new ArrayField(new SchemaField({
                level: new NumberField({ required: true, integer: true, min: 1, initial: 1, label: "Level" }),
                featItemId: new StringField({ required: true, blank: false, label: "Feat Item ID" }),
                featName: new StringField({ required: true, blank: false, label: "Feat Name" }),
                featKey: new StringField({ required: true, blank: false, label: "Feat Key" })
            }), { label: "Class Features" }),

            /** Auto-granted feats at specific class levels. Each entry: level + featUuid (unconditional) or featUuids (conditional). */
            autoGrantedFeats: new ArrayField(new SchemaField({
                level: new NumberField({ required: true, integer: true, min: 1, initial: 1, label: "Level" }),
                featUuid: new StringField({ required: false, blank: true, initial: "", label: "Feat UUID (unconditional)" }),
                featUuids: new ArrayField(new StringField({ required: false, blank: true }), { required: false, initial: [], label: "Feat UUIDs (conditional, first missing)" })
            }), { initial: [], label: "Auto-Granted Feats" }),

            isPrestige: new StringField({
                required: true, blank: false, initial: "false",
                label: "Prestige Class"
            }),

            // Spellcasting configuration
            spellcasting: new SchemaField({
                enabled: new BooleanField({
                    required: true, initial: false,
                    label: "Spellcasting Enabled"
                }),
                /** Key used to look up spell levels in spell.levelsByClass (e.g., sorcererWizard, cleric, druid). Sorcerer and Wizard share "sorcererWizard". */
                spellListKey: new StringField({
                    required: true, blank: true, initial: "",
                    label: "Spell List Key"
                }),
                casterType: new StringField({
                    required: true, blank: false, initial: "none",
                    choices: () => CONFIG.THIRDERA.casterTypes,
                    label: "Caster Type"
                }),
                preparationType: new StringField({
                    required: true, blank: false, initial: "none",
                    choices: () => CONFIG.THIRDERA.preparationTypes,
                    label: "Preparation Type"
                }),
                /** Full list = automatic access to entire class spell list (e.g. cleric, druid). Learned = must learn spells individually via spellbook or spells known (e.g. wizard, sorcerer, bard). */
                spellListAccess: new StringField({
                    required: true, blank: false, initial: "none",
                    choices: () => CONFIG.THIRDERA.spellListAccessTypes,
                    label: "Spell List Access"
                }),
                castingAbility: new StringField({
                    required: true, blank: false, initial: "none",
                    choices: () => CONFIG.THIRDERA.castingAbilities,
                    label: "Casting Ability"
                }),
                /** When true, this class supports domains (e.g. Cleric). Character sheet shows domain add/remove and domain spells. Third-party classes can set this. */
                supportsDomains: new StringField({
                    required: true, blank: false, initial: "false",
                    choices: () => ({ true: "Yes", false: "No" }),
                    label: "Domains Apply"
                }),
                domains: new ArrayField(new SchemaField({
                    domainItemId: new StringField({ required: true, blank: false, label: "Domain Item ID" }),
                    domainName: new StringField({ required: true, blank: false, label: "Domain Name" }),
                    domainKey: new StringField({ required: true, blank: false, label: "Domain Key" })
                }), { label: "Domains" }),
                spellsPerDayTable: new ArrayField(new SchemaField({
                    classLevel: new NumberField({
                        required: true, integer: true, min: 1, max: 20,
                        label: "Class Level"
                    }),
                    spellLevel0: new NumberField({
                        required: true, integer: true, min: 0, initial: 0,
                        label: "0th Level"
                    }),
                    spellLevel1: new NumberField({
                        required: true, integer: true, min: 0, initial: 0,
                        label: "1st Level"
                    }),
                    spellLevel2: new NumberField({
                        required: true, integer: true, min: 0, initial: 0,
                        label: "2nd Level"
                    }),
                    spellLevel3: new NumberField({
                        required: true, integer: true, min: 0, initial: 0,
                        label: "3rd Level"
                    }),
                    spellLevel4: new NumberField({
                        required: true, integer: true, min: 0, initial: 0,
                        label: "4th Level"
                    }),
                    spellLevel5: new NumberField({
                        required: true, integer: true, min: 0, initial: 0,
                        label: "5th Level"
                    }),
                    spellLevel6: new NumberField({
                        required: true, integer: true, min: 0, initial: 0,
                        label: "6th Level"
                    }),
                    spellLevel7: new NumberField({
                        required: true, integer: true, min: 0, initial: 0,
                        label: "7th Level"
                    }),
                    spellLevel8: new NumberField({
                        required: true, integer: true, min: 0, initial: 0,
                        label: "8th Level"
                    }),
                    spellLevel9: new NumberField({
                        required: true, integer: true, min: 0, initial: 0,
                        label: "9th Level"
                    })
                }), { label: "Spells Per Day Table" }),
                /** Optional. For spontaneous casters (e.g. Sorcerer, Bard): max spells known per class level and spell level. Same shape as spellsPerDayTable. When empty, no limit is enforced. */
                spellsKnownTable: new ArrayField(new SchemaField({
                    classLevel: new NumberField({
                        required: true, integer: true, min: 1, max: 20,
                        label: "Class Level"
                    }),
                    spellLevel0: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "0th Level" }),
                    spellLevel1: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "1st Level" }),
                    spellLevel2: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "2nd Level" }),
                    spellLevel3: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "3rd Level" }),
                    spellLevel4: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "4th Level" }),
                    spellLevel5: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "5th Level" }),
                    spellLevel6: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "6th Level" }),
                    spellLevel7: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "7th Level" }),
                    spellLevel8: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "8th Level" }),
                    spellLevel9: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "9th Level" })
                }), { initial: [], label: "Spells Known Table" })
            })
        };
    }

    /**
     * Calculate BAB contribution for a given level count and progression type.
     * @param {number} level          Number of class levels
     * @param {string} progression    "good", "average", or "poor"
     * @returns {number}
     */
    static computeBAB(level, progression) {
        switch (progression) {
            case "good": return level;
            case "average": return Math.floor(level * 3 / 4);
            case "poor": return Math.floor(level / 2);
            default: return 0;
        }
    }

    /**
     * Calculate base save contribution for a given level count and progression type.
     * @param {number} level          Number of class levels
     * @param {string} progression    "good" or "poor"
     * @returns {number}
     */
    static computeBaseSave(level, progression) {
        switch (progression) {
            case "good": return 2 + Math.floor(level / 2);
            case "poor": return Math.floor(level / 3);
            default: return 0;
        }
    }

    /**
     * Get spells per day for a given class level and spell level from the spells per day table.
     * @param {Array} table            The spellsPerDayTable array
     * @param {number} classLevel      The class level (1-20)
     * @param {number} spellLevel      The spell level (0-9)
     * @returns {number}               Number of spells per day, or 0 if not found
     */
    static getSpellsPerDay(table, classLevel, spellLevel) {
        if (!Array.isArray(table) || classLevel < 1 || classLevel > 20 || spellLevel < 0 || spellLevel > 9) {
            return 0;
        }

        const entry = table.find(e => e.classLevel === classLevel);
        if (!entry) return 0;

        const fieldName = `spellLevel${spellLevel}`;
        return entry[fieldName] || 0;
    }

    /**
     * Get spells known (max) for a given class level and spell level from the spells known table.
     * Used for spontaneous casters (e.g. Sorcerer, Bard). Returns 0 if no table or no entry (no limit displayed).
     * @param {Array} table            The spellsKnownTable array
     * @param {number} classLevel      The class level (1-20)
     * @param {number} spellLevel      The spell level (0-9)
     * @returns {number}               Max spells known for that level, or 0 if not found / no limit
     */
    static getSpellsKnown(table, classLevel, spellLevel) {
        if (!Array.isArray(table) || table.length === 0 || classLevel < 1 || classLevel > 20 || spellLevel < 0 || spellLevel > 9) {
            return 0;
        }
        const entry = table.find(e => e.classLevel === classLevel);
        if (!entry) return 0;
        const fieldName = `spellLevel${spellLevel}`;
        return entry[fieldName] || 0;
    }
}
