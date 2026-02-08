const { HTMLField, NumberField, SchemaField, StringField, ArrayField, BooleanField } = foundry.data.fields;
import { getEffectiveMaxDex, applyMaxDex, computeAC } from "./_ac-helpers.mjs";

/**
 * Data model for D&D 3.5 Character actors
 * @extends {foundry.abstract.TypeDataModel}
 */
export class CharacterData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            // Ability Scores
            abilities: new SchemaField({
                str: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Strength" }),
                    mod: new NumberField({ required: true, integer: true, initial: 0, label: "Modifier" })
                }),
                dex: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Dexterity" }),
                    mod: new NumberField({ required: true, integer: true, initial: 0, label: "Modifier" })
                }),
                con: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Constitution" }),
                    mod: new NumberField({ required: true, integer: true, initial: 0, label: "Modifier" })
                }),
                int: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Intelligence" }),
                    mod: new NumberField({ required: true, integer: true, initial: 0, label: "Modifier" })
                }),
                wis: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Wisdom" }),
                    mod: new NumberField({ required: true, integer: true, initial: 0, label: "Modifier" })
                }),
                cha: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Charisma" }),
                    mod: new NumberField({ required: true, integer: true, initial: 0, label: "Modifier" })
                })
            }),

            // Character Details
            details: new SchemaField({
                race: new StringField({ required: true, blank: true, initial: "", label: "Race" }),
                class: new StringField({ required: true, blank: true, initial: "", label: "Class" }),
                level: new NumberField({ required: true, integer: true, min: 1, initial: 1, label: "Level" }),
                alignment: new StringField({ required: true, blank: true, initial: "", label: "Alignment" }),
                deity: new StringField({ required: true, blank: true, initial: "", label: "Deity" }),
                size: new StringField({ required: true, blank: false, initial: "Medium", choices: () => CONFIG.THIRDERA.sizes, label: "Size" }),
                age: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Age" }),
                gender: new StringField({ required: true, blank: true, initial: "", label: "Gender" }),
                height: new StringField({ required: true, blank: true, initial: "", label: "Height" }),
                weight: new StringField({ required: true, blank: true, initial: "", label: "Weight" })
            }),

            // Hit Points
            attributes: new SchemaField({
                hp: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 1, label: "Current HP" }),
                    max: new NumberField({ required: true, integer: true, min: 1, initial: 1, label: "Maximum HP" }),
                    temp: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Temporary HP" })
                }),
                ac: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Armor Class" }),
                    touch: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Touch AC" }),
                    flatFooted: new NumberField({ required: true, integer: true, min: 0, initial: 10, label: "Flat-Footed AC" }),
                    misc: new NumberField({ required: true, integer: true, initial: 0, label: "Misc AC Bonus" })
                }),
                initiative: new SchemaField({
                    bonus: new NumberField({ required: true, integer: true, initial: 0, label: "Initiative Bonus" })
                }),
                speed: new SchemaField({
                    value: new NumberField({ required: true, integer: true, min: 0, initial: 30, label: "Speed (ft)" })
                })
            }),

            // Saving Throws
            saves: new SchemaField({
                fort: new SchemaField({
                    base: new NumberField({ required: true, integer: true, initial: 0, label: "Base Save" }),
                    total: new NumberField({ required: true, integer: true, initial: 0, label: "Total Save" })
                }),
                ref: new SchemaField({
                    base: new NumberField({ required: true, integer: true, initial: 0, label: "Base Save" }),
                    total: new NumberField({ required: true, integer: true, initial: 0, label: "Total Save" })
                }),
                will: new SchemaField({
                    base: new NumberField({ required: true, integer: true, initial: 0, label: "Base Save" }),
                    total: new NumberField({ required: true, integer: true, initial: 0, label: "Total Save" })
                })
            }),

            // Base Attack Bonus
            combat: new SchemaField({
                bab: new NumberField({ required: true, integer: true, initial: 0, label: "Base Attack Bonus" }),
                grapple: new NumberField({ required: true, integer: true, initial: 0, label: "Grapple" })
            }),

            // Biography
            biography: new HTMLField({ required: true, blank: true, label: "Biography" }),

            // Experience Points
            experience: new SchemaField({
                value: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Current XP" }),
                max: new NumberField({ required: true, integer: true, min: 0, initial: 1000, label: "XP for Next Level" })
            })
        };
    }

    /**
     * Prepare derived data for the character
     */
    prepareDerivedData() {
        // Calculate ability modifiers
        for (const [key, ability] of Object.entries(this.abilities)) {
            ability.mod = Math.floor((ability.value - 10) / 2);
        }

        // Apply armor max-Dex cap to Dex modifier before any derived calculations
        const effectiveMaxDex = getEffectiveMaxDex(this);
        applyMaxDex(this, effectiveMaxDex);

        // Calculate initiative
        this.attributes.initiative.bonus = this.abilities.dex.mod;

        // Calculate saves (base + ability modifier)
        this.saves.fort.total = this.saves.fort.base + this.abilities.con.mod;
        this.saves.ref.total = this.saves.ref.base + this.abilities.dex.mod;
        this.saves.will.total = this.saves.will.base + this.abilities.wis.mod;

        // Calculate grapple (BAB + STR mod + size modifier)
        // TODO: Add size modifier calculation
        this.combat.grapple = this.combat.bab + this.abilities.str.mod;

        // Calculate AC values from equipped armor, dex, size, and misc
        computeAC(this);
    }
}
