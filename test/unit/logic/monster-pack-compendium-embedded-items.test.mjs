import { describe, expect, it } from "vitest";
import {
    dedupeMonsterPackActorUpdateRowsPreferMoreEmbeddedItems,
    stripEmbeddedItemsFromActorUpdateRows
} from "../../../module/logic/monster-pack-compendium-embedded-items.mjs";

describe("stripEmbeddedItemsFromActorUpdateRows", () => {
    it("removes items from each row, preserving _id and system", () => {
        const rows = [
            { _id: "abc", type: "npc", name: "Ape", items: [{ name: "Alertness" }], system: { key: "monsterApe" } },
            { _id: "def", type: "npc", items: [] }
        ];
        const out = stripEmbeddedItemsFromActorUpdateRows(rows);
        expect(out).toEqual([
            { _id: "abc", type: "npc", name: "Ape", system: { key: "monsterApe" } },
            { _id: "def", type: "npc" }
        ]);
    });

    it("returns empty array for non-array input", () => {
        expect(stripEmbeddedItemsFromActorUpdateRows(undefined)).toEqual([]);
        expect(stripEmbeddedItemsFromActorUpdateRows(null)).toEqual([]);
    });
});

describe("dedupeMonsterPackActorUpdateRowsPreferMoreEmbeddedItems", () => {
    it("keeps one row per compendium _id, preferring more embedded items (Dire Ape duplicate JSON case)", () => {
        const full = {
            _id: "AmgDxiIDe0wpZ3za",
            type: "npc",
            system: { key: "monsterDireApe" },
            items: [{ t: 1 }, { t: 2 }, { t: 3 }, { t: 4 }, { t: 5 }]
        };
        const stub = { _id: "AmgDxiIDe0wpZ3za", type: "npc", system: { key: "monsterDireApe" }, items: [] };
        const out = dedupeMonsterPackActorUpdateRowsPreferMoreEmbeddedItems([full, stub]);
        expect(out).toHaveLength(1);
        expect(out[0].items).toHaveLength(5);
    });

    it("prefers later row when it has strictly more items", () => {
        const a = { _id: "x", type: "npc", items: [{}, {}] };
        const b = { _id: "x", type: "npc", items: [{}, {}, {}] };
        const out = dedupeMonsterPackActorUpdateRowsPreferMoreEmbeddedItems([a, b]);
        expect(out).toHaveLength(1);
        expect(out[0].items).toHaveLength(3);
    });

    it("keeps first max when two rows tie on item count", () => {
        const a = { _id: "x", type: "npc", name: "First", items: [{ k: 1 }] };
        const b = { _id: "x", type: "npc", name: "Second", items: [{ k: 2 }] };
        const out = dedupeMonsterPackActorUpdateRowsPreferMoreEmbeddedItems([a, b]);
        expect(out).toHaveLength(1);
        expect(out[0].name).toBe("First");
    });

    it("does not merge different actor ids", () => {
        const rows = [
            { _id: "a", type: "npc", items: [{}] },
            { _id: "b", type: "npc", items: [{}, {}] }
        ];
        expect(dedupeMonsterPackActorUpdateRowsPreferMoreEmbeddedItems(rows)).toEqual(rows);
    });
});
