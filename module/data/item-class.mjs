const { HTMLField, SchemaField, StringField, NumberField } = foundry.data.fields;

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

            isPrestige: new StringField({
                required: true, blank: false, initial: "false",
                label: "Prestige Class"
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
}
