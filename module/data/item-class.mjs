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
                name: new StringField({ required: true, blank: false, label: "Skill Name" })
            }), { label: "Class Skills" }),

            features: new ArrayField(new SchemaField({
                level: new NumberField({ required: true, integer: true, min: 1, initial: 1, label: "Level" }),
                featItemId: new StringField({ required: true, blank: false, label: "Feat Item ID" }),
                featName: new StringField({ required: true, blank: false, label: "Feat Name" }),
                featKey: new StringField({ required: true, blank: false, label: "Feat Key" })
            }), { label: "Class Features" }),

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
                castingAbility: new StringField({
                    required: true, blank: false, initial: "none",
                    choices: () => CONFIG.THIRDERA.castingAbilities,
                    label: "Casting Ability"
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
                }), { label: "Spells Per Day Table" })
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
}
