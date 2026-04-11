import { describe, expect, it } from "vitest";
import { legacyAbilityAdjustmentsToChanges } from "../../../module/logic/race-legacy-migration.mjs";

describe("legacyAbilityAdjustmentsToChanges", () => {
    it("returns empty for null/undefined/non-object", () => {
        expect(legacyAbilityAdjustmentsToChanges(null)).toEqual([]);
        expect(legacyAbilityAdjustmentsToChanges(undefined)).toEqual([]);
        expect(legacyAbilityAdjustmentsToChanges("x")).toEqual([]);
    });

    it("skips zero and NaN", () => {
        expect(
            legacyAbilityAdjustmentsToChanges({
                str: 0,
                dex: 2,
                con: NaN,
                int: 0,
                wis: 0,
                cha: 0
            })
        ).toEqual([{ key: "ability.dex", value: 2, label: "" }]);
    });

    it("maps elf-style adjustments in stable order str→cha", () => {
        const rows = legacyAbilityAdjustmentsToChanges({
            str: 0,
            dex: 2,
            con: -2,
            int: 0,
            wis: 0,
            cha: 0
        });
        expect(rows).toEqual([
            { key: "ability.dex", value: 2, label: "" },
            { key: "ability.con", value: -2, label: "" }
        ]);
    });

    it("includes half-orc str bonus before dex", () => {
        const rows = legacyAbilityAdjustmentsToChanges({
            str: 2,
            dex: 0,
            con: 0,
            int: -2,
            wis: 0,
            cha: 0
        });
        expect(rows[0]).toEqual({ key: "ability.str", value: 2, label: "" });
        expect(rows[1]).toEqual({ key: "ability.int", value: -2, label: "" });
    });
});
