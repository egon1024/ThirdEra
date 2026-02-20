const { ArrayField, HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Condition items (SRD condition summary).
 * conditionId is used as the status ID for ActiveEffect and CONFIG.statusEffects.
 * changes: optional mechanical modifiers (Phase 2); keys: ac, acLoseDex, speedMultiplier, saveFort/saveRef/saveWill, attack/attackMelee/attackRanged.
 * @extends {foundry.abstract.TypeDataModel}
 */
export class ConditionData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            /** Unique ID for status effect and Token HUD (e.g. blinded, shaken). Blank allowed so custom items can be created; auto-filled in Item._preCreate. */
            conditionId: new StringField({ required: true, blank: true, initial: "", label: "Condition ID" }),
            description: new HTMLField({ required: true, blank: true, label: "Description" }),
            /** Mechanical effect changes. Key: ac | acLoseDex | speedMultiplier | saveFort | saveRef | saveWill | attack | attackMelee | attackRanged. Value: number (or 1 for acLoseDex). */
            changes: new ArrayField(new SchemaField({
                key: new StringField({ required: true, blank: true, initial: "", label: "Key" }),
                value: new NumberField({ required: true, initial: 0, label: "Value" })
            }), { required: true, initial: [], label: "Mechanical effects" })
        };
    }
}
