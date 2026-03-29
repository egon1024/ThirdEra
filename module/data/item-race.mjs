import { legacyAbilityAdjustmentsToChanges } from "../logic/race-legacy-migration.mjs";

const { HTMLField, NumberField, SchemaField, StringField, ArrayField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Race items
 * @extends {foundry.abstract.TypeDataModel}
 */
export class RaceData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            size: new StringField({ required: true, blank: false, initial: "Medium", choices: () => CONFIG.THIRDERA.sizes, label: "Size" }),
            speed: new NumberField({ required: true, integer: true, min: 0, initial: 30, label: "Base Land Speed" }),

            /** Numeric modifiers (GMS); same shape as feats/conditions. */
            changes: new ArrayField(new SchemaField({
                key: new StringField({ required: true, blank: true, initial: "", label: "Key" }),
                value: new NumberField({ required: true, initial: 0, label: "Value" }),
                label: new StringField({ required: false, blank: true, initial: "", label: "Label" })
            }), { required: false, initial: [], label: "Mechanical effects" }),

            excludedSkills: new ArrayField(new SchemaField({
                key: new StringField({ required: true, blank: false, label: "Skill Key" }),
                name: new StringField({ required: false, blank: true, label: "Skill Name" })
            }), { label: "Excluded Skills" }),

            favoredClass: new StringField({ required: true, blank: true, initial: "", label: "Favored Class" }),

            /** Traits such as vision, immunities, weapon familiarity, languages, and spell-like abilities. */
            otherRacialTraits: new HTMLField({ required: false, blank: true, initial: "", label: "Other racial traits" })
        };
    }

    /** @override */
    static migrateData(source) {
        const hadLegacy = source.abilityAdjustments != null && typeof source.abilityAdjustments === "object";
        if (hadLegacy) {
            const existing = Array.isArray(source.changes) ? source.changes : [];
            if (existing.length === 0) {
                source.changes = legacyAbilityAdjustmentsToChanges(source.abilityAdjustments);
            }
            delete source.abilityAdjustments;
        }
        if (!Array.isArray(source.changes)) {
            source.changes = [];
        }
        if (typeof source.otherRacialTraits !== "string") {
            source.otherRacialTraits = source.otherRacialTraits == null ? "" : String(source.otherRacialTraits);
        }
        return super.migrateData(source);
    }
}
