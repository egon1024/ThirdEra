import { describe, it, expect } from "vitest";
import {
    RACE_STOCK_DELTA_REV,
    getRaceStockDeltaRowsForName,
    mergeRaceStockDeltaIntoChanges,
    raceMechanicalChangesEqual,
    normalizeMechanicalChangeRow,
    getRaceStockDeltaRevOnDoc,
    raceDocLinkedToThirderaRacesStock
} from "../../../module/logic/race-srd-changes-merge.mjs";

describe("race-srd-changes-merge", () => {
    it("exports positive revision", () => {
        expect(RACE_STOCK_DELTA_REV).toBeGreaterThanOrEqual(1);
    });

    it("getRaceStockDeltaRowsForName returns Elf skill rows", () => {
        const rows = getRaceStockDeltaRowsForName("Elf");
        expect(rows).toHaveLength(3);
        expect(rows.map((r) => r.key)).toEqual(["skill.listen", "skill.search", "skill.spot"]);
    });

    it("getRaceStockDeltaRowsForName is empty for Dwarf and unknown names", () => {
        expect(getRaceStockDeltaRowsForName("Dwarf")).toEqual([]);
        expect(getRaceStockDeltaRowsForName("Homebrew")).toEqual([]);
    });

    it("mergeRaceStockDeltaIntoChanges appends rows when key missing", () => {
        const existing = [
            { key: "ability.dex", value: 2, label: "" },
            { key: "ability.con", value: -2, label: "" }
        ];
        const delta = getRaceStockDeltaRowsForName("Elf");
        const merged = mergeRaceStockDeltaIntoChanges(existing, delta);
        expect(merged).toHaveLength(5);
        expect(merged.filter((r) => r.key === "skill.listen")[0].value).toBe(2);
    });

    it("mergeRaceStockDeltaIntoChanges does not duplicate an existing key", () => {
        const existing = [
            { key: "ability.dex", value: 2, label: "" },
            { key: "skill.listen", value: 1, label: "house" }
        ];
        const delta = getRaceStockDeltaRowsForName("Elf");
        const merged = mergeRaceStockDeltaIntoChanges(existing, delta);
        const listen = merged.filter((r) => r.key === "skill.listen");
        expect(listen).toHaveLength(1);
        expect(listen[0].value).toBe(1);
    });

    it("raceMechanicalChangesEqual ignores order", () => {
        const a = [
            { key: "skill.a", value: 1, label: "" },
            { key: "skill.b", value: 2, label: "x" }
        ];
        const b = [
            { key: "skill.b", value: 2, label: "x" },
            { key: "skill.a", value: 1, label: "" }
        ];
        expect(raceMechanicalChangesEqual(a, b)).toBe(true);
    });

    it("normalizeMechanicalChangeRow trims key and label", () => {
        expect(normalizeMechanicalChangeRow({ key: " skill.x ", value: 3, label: " L " })).toEqual({
            key: "skill.x",
            value: 3,
            label: "L"
        });
    });

    it("getRaceStockDeltaRevOnDoc uses getProperty when provided", () => {
        const utils = {
            getProperty: (obj, path) => {
                if (!obj || typeof path !== "string") return undefined;
                return path.split(".").reduce((o, key) => (o != null ? o[key] : undefined), obj);
            }
        };
        const doc = { flags: { thirdera: { raceStockDeltaRev: 2 } } };
        expect(getRaceStockDeltaRevOnDoc(doc, utils)).toBe(2);
        expect(getRaceStockDeltaRevOnDoc({ flags: {} }, utils)).toBe(0);
    });

    it("raceDocLinkedToThirderaRacesStock is true for pack id, uuid, or compendium sourceId", () => {
        const utils = {
            getProperty: (obj, path) => {
                if (!obj || typeof path !== "string") return undefined;
                return path.split(".").reduce((o, key) => (o != null ? o[key] : undefined), obj);
            }
        };
        expect(raceDocLinkedToThirderaRacesStock({ pack: "thirdera.thirdera_races" }, utils)).toBe(true);
        expect(
            raceDocLinkedToThirderaRacesStock(
                { uuid: "Compendium.thirdera.thirdera_races.Item.abc123" },
                utils
            )
        ).toBe(true);
        expect(
            raceDocLinkedToThirderaRacesStock(
                { flags: { core: { sourceId: "Compendium.thirdera.thirdera_races.Item.xyz" } } },
                utils
            )
        ).toBe(true);
        expect(raceDocLinkedToThirderaRacesStock({ name: "Elf", pack: "", uuid: "Item.x" }, utils)).toBe(false);
    });
});
