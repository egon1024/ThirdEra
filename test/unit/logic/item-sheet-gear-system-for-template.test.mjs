import { describe, it, expect } from "vitest";
import { buildPlainGearSystemForItemSheet } from "../../../module/logic/item-sheet-gear-system-for-template.mjs";

describe("buildPlainGearSystemForItemSheet", () => {
    it("uses toObject and preserves nested damage + cgsGrants for TypeDataModel-like sources", () => {
        const systemData = {
            toObject() {
                return {
                    damage: { dice: "1d6", type: "piercing" },
                    mechanicalApplyScope: "equipped",
                    cgsGrants: { grants: [], senses: [] }
                };
            },
            changes: [{ key: "attack", value: 1, label: "" }],
            mechanicalCreatureGateUuids: ["Compendium.x.Item.abc123"],
            cgsGrants: {
                grants: [{ category: "spellGrant", spellKey: "fly", usesPerDay: 3 }],
                senses: [{ type: "darkvision", range: "60 ft" }]
            }
        };
        const plain = buildPlainGearSystemForItemSheet(systemData);
        expect(plain.damage?.dice).toBe("1d6");
        expect(plain.damage?.effectiveDice).toBe("1d6");
        expect(plain.cgsGrants?.grants).toHaveLength(1);
        expect(plain.cgsGrants?.grants[0].spellKey).toBe("fly");
        expect(plain.cgsGrants?.senses[0].type).toBe("darkvision");
        expect(plain.mechanicalCreatureGateUuids).toEqual(["Compendium.x.Item.abc123"]);
        expect(plain.changes).toHaveLength(1);
    });

    it("adds damage.effectiveDice for weapon-sized progression (sheet context omits TypeDataModel derived fields)", () => {
        const systemData = {
            toObject() {
                return {
                    damage: { dice: "1d8", type: "slashing" },
                    properties: {
                        size: "Large",
                        handedness: "oneHanded",
                        melee: "melee",
                        proficiency: "martial"
                    }
                };
            },
            changes: [],
            cgsGrants: { grants: [], senses: [] }
        };
        const plain = buildPlainGearSystemForItemSheet(systemData);
        expect(plain.damage?.effectiveDice).toBe("2d6");
    });

    it("falls back to object spread when toObject is absent", () => {
        const systemData = {
            cost: 5,
            cgsGrants: { grants: [], senses: [{ type: "lowLight", range: "" }] }
        };
        const plain = buildPlainGearSystemForItemSheet(systemData);
        expect(plain.cost).toBe(5);
        expect(plain.cgsGrants?.senses).toHaveLength(1);
    });

    it("copies cgsGrantOverrides and cgsTemplateUuid for item sheet context", () => {
        const systemData = {
            cgsGrants: { grants: [], senses: [] },
            cgsGrantOverrides: { grants: [{ category: "immunity", tag: "sleep" }], senses: [] },
            cgsTemplateUuid: "Compendium.thirdera.thirdera_feats.Item.x"
        };
        const plain = buildPlainGearSystemForItemSheet(systemData);
        expect(plain.cgsGrantOverrides.grants).toHaveLength(1);
        expect(plain.cgsTemplateUuid).toBe("Compendium.thirdera.thirdera_feats.Item.x");
    });
});
