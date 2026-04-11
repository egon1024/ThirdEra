import { migrateDataCgsGrants } from "./cgs-grants-migrate-helpers.mjs";

const { ArrayField, HTMLField, NumberField, ObjectField, SchemaField, StringField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Armor items
 * @extends {foundry.abstract.TypeDataModel}
 */
export class ArmorData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            armor: new SchemaField({
                type: new StringField({ required: true, blank: false, initial: "light", label: "Armor Type" }), // light, medium, heavy, shield
                bonus: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Armor Bonus" }),
                maxDex: new NumberField({ required: true, integer: true, nullable: true, initial: null, label: "Max Dex Bonus" }),
                checkPenalty: new NumberField({ required: true, integer: true, max: 0, initial: 0, label: "Armor Check Penalty" }),
                spellFailure: new NumberField({ required: true, integer: true, min: 0, max: 100, initial: 0, label: "Arcane Spell Failure %" })
            }),

            size: new StringField({ required: true, blank: false, initial: "Medium", choices: () => CONFIG.THIRDERA.sizes, label: "Size" }),

            speed: new SchemaField({
                ft30: new NumberField({ required: true, integer: true, min: 0, initial: 30, label: "Speed (30 ft base)" }),
                ft20: new NumberField({ required: true, integer: true, min: 0, initial: 20, label: "Speed (20 ft base)" })
            }),

            cost: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Cost (gp)" }),
            weight: new NumberField({ required: true, nullable: false, min: 0, initial: 0, label: "Weight (lbs)" }),
            quantity: new NumberField({ required: true, integer: true, min: 0, initial: 1, label: "Quantity" }),

            equipped: new StringField({ required: true, blank: false, initial: "false", label: "Equipped" }),

            /**
             * When GMS `changes` and CGS grants apply for this armor: equipped only (default) or while carried on the actor.
             * @see module/logic/item-gear-mechanical-apply.mjs
             */
            mechanicalApplyScope: new StringField({
                required: true,
                blank: false,
                initial: "equipped",
                choices: () => ({ equipped: "When equipped", carried: "When carried (inventory)" }),
                label: "Mechanical effects apply"
            }),

            /**
             * If non-empty, GMS/CGS from this armor apply only when the owning actor’s effective creature
             * type or subtype (union) matches at least one referenced document UUID.
             */
            mechanicalCreatureGateUuids: new ArrayField(new StringField({ required: true, blank: true, initial: "" }), {
                required: false,
                initial: [],
                label: "Mechanical creature type gate"
            }),

            /** Pack JSON authoring: creature type keys → UUIDs on compendium load. */
            mechanicalCreatureGateTypeKeys: new ArrayField(new StringField({ required: true, blank: true, initial: "" }), {
                initial: [],
                label: "Mechanical gate type keys (pack JSON)"
            }),

            /** Pack JSON authoring: subtype keys → UUIDs on compendium load. */
            mechanicalCreatureGateSubtypeKeys: new ArrayField(new StringField({ required: true, blank: true, initial: "" }), {
                initial: [],
                label: "Mechanical gate subtype keys (pack JSON)"
            }),

            /** Optional mechanical modifiers when equipped (generalized modifier system). Same key set as conditions/feats. */
            changes: new ArrayField(new SchemaField({
                key: new StringField({ required: true, blank: true, initial: "", label: "Key" }),
                value: new NumberField({ required: true, initial: 0, label: "Value" }),
                label: new StringField({ required: false, blank: true, initial: "", label: "Label" })
            }), { required: false, initial: [], label: "Modifiers" }),

            // Track which container this item is in (if any)
            containerId: new StringField({ required: true, blank: true, initial: "", label: "Container ID" }),

            /** CGS grants while this armor is equipped (mirrors `changes` + GMS). */
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
        migrateDataCgsGrants(source);
        return super.migrateData(source);
    }
}
