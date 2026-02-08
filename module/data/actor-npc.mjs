const { HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;
import { computeAC } from "./_ac-helpers.mjs";

/**
 * Data model for D&D 3.5 NPC actors
 * @extends {foundry.abstract.TypeDataModel}
 */
export class NPCData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            // Ability Scores (same as character)
            abilities: new SchemaField({
                str: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                dex: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                con: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                int: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                wis: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                cha: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    mod: new NumberField({ required: true, integer: true, initial: 0 })
                })
            }),

            // NPC Details (simplified)
            details: new SchemaField({
                type: new StringField({ required: true, blank: true, initial: "" }),
                cr: new StringField({ required: true, blank: true, initial: "1" }),
                alignment: new StringField({ required: true, blank: true, initial: "" }),
                size: new StringField({ required: true, blank: false, initial: "Medium", choices: () => CONFIG.THIRDERA.sizes })
            }),

            // Hit Points
            attributes: new SchemaField({
                hp: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
                    max: new NumberField({ required: true, integer: true, min: 1, initial: 1 })
                }),
                ac: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    touch: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    flatFooted: new NumberField({ required: true, integer: true, min: 0, initial: 10 }),
                    misc: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                initiative: new SchemaField({
                    bonus: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                speed: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 30 })
                })
            }),

            // Saving Throws
            saves: new SchemaField({
                fort: new SchemaField({
                    base: new NumberField({ required: true, integer: true, initial: 0 }),
                    total: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                ref: new SchemaField({
                    base: new NumberField({ required: true, integer: true, initial: 0 }),
                    total: new NumberField({ required: true, integer: true, initial: 0 })
                }),
                will: new SchemaField({
                    base: new NumberField({ required: true, integer: true, initial: 0 }),
                    total: new NumberField({ required: true, integer: true, initial: 0 })
                })
            }),

            // Combat Stats
            combat: new SchemaField({
                bab: new NumberField({ required: true, integer: true, initial: 0 }),
                grapple: new NumberField({ required: true, integer: true, initial: 0 })
            }),

            // Biography/Description
            biography: new HTMLField({ required: true, blank: true })
        };
    }

    /**
     * Prepare derived data for the NPC
     */
    prepareDerivedData() {
        // Calculate ability modifiers
        for (const [key, ability] of Object.entries(this.abilities)) {
            ability.mod = Math.floor((ability.value - 10) / 2);
        }

        // Calculate initiative
        this.attributes.initiative.bonus = this.abilities.dex.mod;

        // Calculate saves
        this.saves.fort.total = this.saves.fort.base + this.abilities.con.mod;
        this.saves.ref.total = this.saves.ref.base + this.abilities.dex.mod;
        this.saves.will.total = this.saves.will.base + this.abilities.wis.mod;

        // Calculate grapple
        this.combat.grapple = this.combat.bab + this.abilities.str.mod;

        // Calculate AC values from equipped armor, dex, size, and misc
        computeAC(this);
    }
}
