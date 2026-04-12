import { migrateDataCgsGrants } from "./cgs-grants-migrate-helpers.mjs";

const { ArrayField, HTMLField, NumberField, ObjectField, SchemaField, StringField } = foundry.data.fields;

/**
 * Data model for reusable creature / monster special qualities (SRD Ex, Su, Sp style abilities).
 * Numeric effects use {@link FeatData}-style `system.changes` (GMS); structured grants use `system.cgsGrants` (CGS).
 * @extends {foundry.abstract.TypeDataModel}
 */
export class CreatureFeatureData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            /** Stable id for compendium matching and cross-references (e.g. monster pack). */
            key: new StringField({ required: true, blank: true, initial: "", label: "Creature Feature Key" }),

            /**
             * SRD-style tag: extraordinary, supernatural, or spell-like; blank when not used.
             * @see CONFIG.THIRDERA.creatureFeatureAbilityKinds
             */
            abilityKind: new StringField({
                required: true,
                blank: true,
                initial: "",
                choices: () => globalThis.CONFIG?.THIRDERA?.creatureFeatureAbilityKinds ?? { "": "—" }
            }),

            /** Optional mechanical modifiers (generalized modifier system); same keys as feats/conditions. */
            changes: new ArrayField(
                new SchemaField({
                    key: new StringField({ required: true, blank: true, initial: "", label: "Key" }),
                    value: new NumberField({ required: true, initial: 0, label: "Value" }),
                    label: new StringField({ required: false, blank: true, initial: "", label: "Label" })
                }),
                { required: false, initial: [], label: "Mechanical effects" }
            ),

            /** Optional structured CGS grants; numeric bonuses stay in `changes` (GMS). */
            cgsGrants: new SchemaField(
                {
                    grants: new ArrayField(new ObjectField(), {
                        required: true,
                        initial: [],
                        label: "Capability grants"
                    }),
                    senses: new ArrayField(
                        new SchemaField({
                            type: new StringField({ required: true, blank: true, initial: "", label: "Sense type" }),
                            range: new StringField({ required: true, blank: true, initial: "", label: "Range" })
                        }),
                        { required: false, initial: [], label: "Senses" }
                    )
                },
                { required: false, label: "Capability grants" }
            )
        };
    }

    /** @override */
    static migrateData(source) {
        try {
            migrateDataCgsGrants(source);
        } catch (err) {
            console.warn("ThirdEra | CreatureFeatureData migrateData (cgsGrants) failed:", err);
        }
        return super.migrateData(source);
    }
}
