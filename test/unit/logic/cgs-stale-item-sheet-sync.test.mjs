import { describe, expect, it } from "vitest";
import {
    buildSystemUpdateSourceChangesFromReturnedItem,
    staleSheetItemDocNeedsSystemResync
} from "../../../module/logic/cgs-stale-item-sheet-sync.mjs";

describe("staleSheetItemDocNeedsSystemResync", () => {
    it("returns false when same object reference", () => {
        const doc = { id: "abc" };
        expect(staleSheetItemDocNeedsSystemResync(doc, doc)).toBe(false);
    });

    it("returns false when ids differ", () => {
        expect(staleSheetItemDocNeedsSystemResync({ id: "a" }, { id: "b" })).toBe(false);
    });

    it("returns false when returned is null", () => {
        expect(staleSheetItemDocNeedsSystemResync({ id: "a" }, null)).toBe(false);
    });

    it("returns true when different instances share id (compendium sheet vs pack cache)", () => {
        const sheetDoc = { id: "feat1" };
        const liveDoc = { id: "feat1" };
        expect(staleSheetItemDocNeedsSystemResync(sheetDoc, liveDoc)).toBe(true);
    });
});

describe("buildSystemUpdateSourceChangesFromReturnedItem", () => {
    it("clones system subtree for updateSource", () => {
        const inner = { cgsGrants: { senses: [{ type: "darkvision", range: "" }], grants: [] } };
        const returned = { _source: { system: inner } };
        const out = buildSystemUpdateSourceChangesFromReturnedItem(returned);
        expect(out.system).toEqual(inner);
        expect(out.system).not.toBe(inner);
        expect(out.system.cgsGrants).not.toBe(inner.cgsGrants);
    });

    it("uses deps.clone when provided", () => {
        const sys = { n: 1 };
        const returned = { _source: { system: sys } };
        const out = buildSystemUpdateSourceChangesFromReturnedItem(returned, {
            clone: (o) => ({ ...o, cloned: true })
        });
        expect(out.system).toEqual({ n: 1, cloned: true });
    });

    it("returns empty system object when missing", () => {
        expect(buildSystemUpdateSourceChangesFromReturnedItem({})).toEqual({ system: {} });
        expect(buildSystemUpdateSourceChangesFromReturnedItem({ _source: {} })).toEqual({ system: {} });
    });
});
