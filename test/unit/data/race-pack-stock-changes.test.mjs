import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    getRaceStockDeltaRowsForName,
    mergeRaceStockDeltaIntoChanges,
    normalizeMechanicalChangeRow
} from "../../../module/logic/race-srd-changes-merge.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RACES_DIR = path.resolve(__dirname, "../../../packs/races");

/**
 * Regression: `packs/races/*.json` is the authoring source for new compendium entries.
 * Scripts that rewrite race JSON must preserve `system.changes` rows that match
 * `getRaceStockDeltaRowsForName` (Elf, Gnome, Half-Elf, Halfling). Worlds with existing
 * compendium races rely on `RACE_STOCK_DELTA_REV` merges instead of JSON refresh.
 */
describe("packs/races stock mechanical rows (regression)", () => {
    const files = fs.readdirSync(RACES_DIR).filter((f) => f.endsWith(".json"));

    it("discovers race JSON files", () => {
        expect(files.length).toBeGreaterThanOrEqual(7);
    });

    for (const file of files) {
        it(`${file} contains every bundled stock-delta row for its name`, () => {
            const raw = fs.readFileSync(path.join(RACES_DIR, file), "utf8");
            const doc = JSON.parse(raw);
            expect(doc.type).toBe("race");
            const name = doc.name;
            const changes = Array.isArray(doc.system?.changes) ? doc.system.changes : [];
            const delta = getRaceStockDeltaRowsForName(name);
            for (const row of delta) {
                const match = changes.find((c) => normalizeMechanicalChangeRow(c).key === row.key);
                expect(match, `missing change key ${row.key} on ${name}`).toBeTruthy();
                const n = normalizeMechanicalChangeRow(match);
                expect(n.value).toBe(row.value);
                expect(n.label).toBe((row.label || "").trim());
            }
        });
    }

    it("merge restores Elf skills when only abilities remain (simulates wiped compendium)", () => {
        const existing = [
            { key: "ability.dex", value: 2, label: "" },
            { key: "ability.con", value: -2, label: "" }
        ];
        const merged = mergeRaceStockDeltaIntoChanges(existing, getRaceStockDeltaRowsForName("Elf"));
        expect(merged.some((r) => r.key === "skill.listen" && r.value === 2)).toBe(true);
        expect(merged.some((r) => r.key === "skill.search" && r.value === 2)).toBe(true);
        expect(merged.some((r) => r.key === "skill.spot" && r.value === 2)).toBe(true);
    });
});
