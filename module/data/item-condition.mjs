const { ArrayField, HTMLField, NumberField, ObjectField, SchemaField, StringField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Condition items (SRD condition summary).
 * conditionId is used as the status ID for ActiveEffect and CONFIG.statusEffects.
 * changes: optional mechanical modifiers (Phase 2); keys: ac, acLoseDex, speedMultiplier, saveFort/saveRef/saveWill, attack/attackMelee/attackRanged.
 * cgsGrants: optional structured CGS entries (Phase 5a), e.g. senseSuppression for Blinded.
 * @extends {foundry.abstract.TypeDataModel}
 */
export class ConditionData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            /** Unique ID for status effect and Token HUD (e.g. blinded, shaken). Blank allowed so custom items can be created; auto-filled in Item._preCreate. */
            conditionId: new StringField({ required: true, blank: true, initial: "", label: "Condition ID" }),
            description: new HTMLField({ required: true, blank: true, label: "Description" }),
            /** Mechanical effect changes. Key: ac | acLoseDex | speedMultiplier | saveFort | saveRef | saveWill | attack | attackMelee | attackRanged. Value: number (or 1 for acLoseDex). Optional label for breakdown display. */
            changes: new ArrayField(new SchemaField({
                key: new StringField({ required: true, blank: true, initial: "", label: "Key" }),
                value: new NumberField({ required: true, initial: 0, label: "Value" }),
                label: new StringField({ required: false, blank: true, initial: "", label: "Label" })
            }), { required: true, initial: [], label: "Mechanical effects" }),
            /** Structured capability grants (CGS); emitted when this condition is active on an actor. */
            cgsGrants: new SchemaField(
                {
                    grants: new ArrayField(new ObjectField(), {
                        required: true,
                        initial: [],
                        label: "CGS grants"
                    })
                },
                { required: false, label: "CGS grants" }
            )
        };
    }

    /** @override */
    static migrateData(source) {
        if (!source.cgsGrants || typeof source.cgsGrants !== "object") {
            source.cgsGrants = { grants: [] };
        } else if (!Array.isArray(source.cgsGrants.grants)) {
            source.cgsGrants.grants = [];
        }
        return super.migrateData(source);
    }
}
