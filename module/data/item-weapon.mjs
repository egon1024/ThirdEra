import { getEffectiveDamage } from "./_damage-helpers.mjs";

import { migrateDataCgsGrants } from "./cgs-grants-migrate-helpers.mjs";

const { ArrayField, HTMLField, NumberField, ObjectField, SchemaField, StringField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Weapon items
 * @extends {foundry.abstract.TypeDataModel}
 */
export class WeaponData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            damage: new SchemaField({
                dice: new StringField({ required: true, blank: false, initial: "1d8", label: "Damage Dice" }),
                type: new StringField({ required: true, blank: true, initial: "", label: "Damage Type" })
            }),

            critical: new SchemaField({
                range: new NumberField({ required: true, integer: true, min: 1, initial: 20, label: "Threat Range" }),
                multiplier: new NumberField({ required: true, integer: true, min: 2, initial: 2, label: "Critical Multiplier" })
            }),

            range: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Range (ft)" }),

            properties: new SchemaField({
                melee: new StringField({ required: true, blank: false, initial: "melee", label: "Weapon Type" }), // melee or ranged
                handedness: new StringField({ required: true, blank: false, initial: "oneHanded", choices: () => CONFIG.THIRDERA.weaponHandedness, label: "Handedness" }),
                size: new StringField({ required: true, blank: false, initial: "Medium", choices: () => CONFIG.THIRDERA.sizes, label: "Size" }),
                proficiency: new StringField({ required: true, blank: true, initial: "simple", label: "Proficiency" }) // simple, martial, exotic
            }),

            cost: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Cost (gp)" }),
            weight: new NumberField({ required: true, nullable: false, min: 0, initial: 0, label: "Weight (lbs)" }),
            quantity: new NumberField({ required: true, integer: true, min: 0, initial: 1, label: "Quantity" }),

            equipped: new StringField({ required: true, blank: false, initial: "none", label: "Equipped" }),

            /**
             * When GMS `changes` and CGS grants apply: wielded only (default) or while carried on the actor.
             * @see module/logic/item-gear-mechanical-apply.mjs
             */
            mechanicalApplyScope: new StringField({
                required: true,
                blank: false,
                initial: "equipped",
                choices: () => ({ equipped: "When wielded (primary/off-hand)", carried: "When carried (inventory)" }),
                label: "Mechanical effects apply"
            }),

            /** If non-empty, GMS/CGS apply only when the owner matches an effective type/subtype UUID. */
            mechanicalCreatureGateUuids: new ArrayField(new StringField({ required: true, blank: true, initial: "" }), {
                required: false,
                initial: [],
                label: "Mechanical creature type gate"
            }),

            mechanicalCreatureGateTypeKeys: new ArrayField(new StringField({ required: true, blank: true, initial: "" }), {
                initial: [],
                label: "Mechanical gate type keys (pack JSON)"
            }),

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

            /** CGS grants while this weapon is equipped (primary/offhand; mirrors `changes` + GMS). */
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

    /** @override */
    prepareDerivedData() {
        this.damage.effectiveDice = getEffectiveDamage(this.damage.dice, this.properties.size);
    }
}
