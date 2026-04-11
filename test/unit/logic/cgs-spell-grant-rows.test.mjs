import { describe, expect, it, vi } from "vitest";
import * as capAgg from "../../../module/logic/capability-aggregation.mjs";
import { getMergedSpellGrantRowsForActor } from "../../../module/logic/cgs-spell-grant-rows.mjs";

describe("getMergedSpellGrantRowsForActor", () => {
    it("returns actor.system.cgs.spellGrants.rows when non-empty", () => {
        const rows = [{ spellUuid: "Compendium.x.Item.y", sources: [] }];
        const actor = { system: { cgs: { spellGrants: { rows } } } };
        expect(getMergedSpellGrantRowsForActor(actor)).toBe(rows);
    });

    it("returns empty array when system has no spell grant rows and aggregation yields none", () => {
        expect(getMergedSpellGrantRowsForActor({ system: {} })).toEqual([]);
        expect(getMergedSpellGrantRowsForActor({ system: { cgs: { spellGrants: { rows: [] } } } })).toEqual([]);
    });

    it("uses getActiveCapabilityGrants when system rows are empty", () => {
        const merged = [{ spellUuid: "from-fallback", sources: [] }];
        const spy = vi.spyOn(capAgg, "getActiveCapabilityGrants").mockReturnValue({
            spellGrants: { rows: merged }
        });
        const actor = { system: { cgs: { spellGrants: { rows: [] } } } };
        expect(getMergedSpellGrantRowsForActor(actor)).toEqual(merged);
        spy.mockRestore();
    });
});
