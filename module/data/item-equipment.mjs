const { NumberField, StringField, HTMLField } = foundry.data.fields;

/**
 * Data model for D&D 3.5 Equipment/Gear items
 * @extends {foundry.abstract.TypeDataModel}
 */
export class EquipmentData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            description: new HTMLField({ required: true, blank: true, label: "Description" }),

            quantity: new NumberField({ required: true, integer: true, min: 0, initial: 1, label: "Quantity" }),
            cost: new NumberField({ required: true, integer: true, min: 0, initial: 0, label: "Cost (gp)" }),
            weight: new NumberField({ required: true, nullable: false, min: 0, initial: 0, label: "Weight (lbs)" }),

            equipped: new StringField({ required: true, blank: false, initial: "false", label: "Equipped" })
        };
    }
}
