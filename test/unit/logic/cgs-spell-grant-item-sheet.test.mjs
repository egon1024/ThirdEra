import { describe, it, expect } from "vitest";
import { buildSpellGrantSheetRowsFromGrants } from "../../../module/logic/cgs-spell-grant-item-sheet.mjs";

describe("buildSpellGrantSheetRowsFromGrants", () => {
    it("returns empty for non-array or empty", () => {
        expect(buildSpellGrantSheetRowsFromGrants(null)).toEqual([]);
        expect(buildSpellGrantSheetRowsFromGrants([])).toEqual([]);
    });

    it("skips non-spellGrant categories and preserves grant indices", () => {
        const grants = [
            { category: "sense", senseType: "darkvision" },
            { category: "spellGrant", spellUuid: "Compendium.foo.bar.Item.abc" },
            { category: "spellGrant", spellUuid: "", usesPerDay: 2 },
            { category: "senseSuppression", senseTypes: ["darkvision"] }
        ];
        const rows = buildSpellGrantSheetRowsFromGrants(grants, {
            spellNameForUuid: () => "Fireball"
        });
        expect(rows).toHaveLength(2);
        expect(rows[0].grantIndex).toBe(1);
        expect(rows[0].displayName).toBe("Fireball");
        expect(rows[1].grantIndex).toBe(2);
        expect(rows[1].spellUuid).toBe("");
        expect(rows[1].usesPerDayValue).toBe("2");
        expect(rows[1].displayName).toBe("—");
    });

    it("uses spellNameForUuid only when spellUuid set", () => {
        const grants = [{ category: "spellGrant", spellUuid: "uuid-1" }];
        let seen = "";
        const rows = buildSpellGrantSheetRowsFromGrants(grants, {
            spellNameForUuid: (u) => {
                seen = u;
                return "Named";
            }
        });
        expect(seen).toBe("uuid-1");
        expect(rows[0].displayName).toBe("Named");
    });

    it("coerces caster level from string", () => {
        const grants = [{ category: "spellGrant", spellUuid: "x", casterLevel: "5" }];
        const rows = buildSpellGrantSheetRowsFromGrants(grants);
        expect(rows[0].casterLevelValue).toBe("5");
    });
});
