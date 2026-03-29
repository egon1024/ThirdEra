import { describe, expect, it } from "vitest";
import {
    extractPackRaceDocId,
    getEffectiveRaceCgsGrants,
    STOCK_RACE_CGS_GRANTS_BY_DOC_ID
} from "../../../module/logic/cgs-stock-race-grants.mjs";

describe("extractPackRaceDocId", () => {
    it("parses compendium uuid and sourceId suffix", () => {
        expect(
            extractPackRaceDocId({
                sourceId: "Compendium.thirdera.thirdera_races.Item.race-dwarf"
            })
        ).toBe("race-dwarf");
        expect(
            extractPackRaceDocId({
                uuid: "Compendium.foo.pack.Item.race-elf"
            })
        ).toBe("race-elf");
    });

    it("parses plain id", () => {
        expect(extractPackRaceDocId({ id: "race-half-orc" })).toBe("race-half-orc");
    });

    it("returns null when no race-* id", () => {
        expect(extractPackRaceDocId({ id: "custom-race", uuid: "Actor.1.Item.abc" })).toBe(null);
        expect(extractPackRaceDocId(null)).toBe(null);
    });
});

describe("getEffectiveRaceCgsGrants", () => {
    it("uses explicit grants when non-empty", () => {
        const item = {
            sourceId: "Compendium.thirdera.thirdera_races.Item.race-dwarf",
            system: {
                cgsGrants: {
                    grants: [{ category: "sense", senseType: "scent", range: "30 ft" }],
                    senses: [{ type: "darkvision", range: "999 ft" }]
                }
            }
        };
        expect(getEffectiveRaceCgsGrants(item)).toEqual([
            { category: "sense", senseType: "scent", range: "30 ft" }
        ]);
    });

    it("maps senses when grants empty", () => {
        const item = {
            system: {
                cgsGrants: {
                    grants: [],
                    senses: [
                        { type: "darkvision", range: "120 ft" },
                        { type: "", range: "x" }
                    ]
                }
            }
        };
        expect(getEffectiveRaceCgsGrants(item)).toEqual([
            { category: "sense", senseType: "darkvision", range: "120 ft" }
        ]);
    });

    it("falls back to stock for known pack id when grants and senses empty", () => {
        const item = {
            sourceId: "Compendium.thirdera.thirdera_races.Item.race-dwarf",
            system: { cgsGrants: { grants: [], senses: [] } }
        };
        const g = getEffectiveRaceCgsGrants(item);
        expect(g).toEqual([...STOCK_RACE_CGS_GRANTS_BY_DOC_ID["race-dwarf"]]);
        expect(g[0]).not.toBe(STOCK_RACE_CGS_GRANTS_BY_DOC_ID["race-dwarf"][0]);
    });

    it("returns empty for human stock id", () => {
        const item = {
            id: "race-human",
            system: { cgsGrants: { grants: [], senses: [] } }
        };
        expect(getEffectiveRaceCgsGrants(item)).toEqual([]);
    });
});
