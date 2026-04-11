import { describe, expect, it } from "vitest";
import { migrateDataCgsGrants } from "../../../module/data/cgs-grants-migrate-helpers.mjs";

describe("migrateDataCgsGrants", () => {
    it("does not add plain cgsGrants when only ==cgsGrants is present; normalizes nested arrays", () => {
        const source = {
            "==cgsGrants": {
                grants: [{ id: 1 }],
                senses: [{ type: "darkvision", range: "60" }]
            }
        };
        migrateDataCgsGrants(source);
        expect("cgsGrants" in source).toBe(false);
        expect(source["==cgsGrants"].grants).toEqual([{ id: 1 }]);
        expect(source["==cgsGrants"].senses).toEqual([{ type: "darkvision", range: "60" }]);
    });

    it("fills missing grants/senses arrays on ==cgsGrants object", () => {
        const source = { "==cgsGrants": {} };
        migrateDataCgsGrants(source);
        expect(source["==cgsGrants"].grants).toEqual([]);
        expect(source["==cgsGrants"].senses).toEqual([]);
    });

    it("does not add plain cgsGrants when the key is absent (partial Item.system update safe)", () => {
        const source = { equipped: "true" };
        migrateDataCgsGrants(source);
        expect("cgsGrants" in source).toBe(false);
    });

    it("initializes plain cgsGrants when the key is present but nullish", () => {
        const source = { cgsGrants: null };
        migrateDataCgsGrants(source);
        expect(source.cgsGrants).toEqual({ grants: [], senses: [] });
    });

    it("with senses:false, ==cgsGrants only normalizes grants", () => {
        const source = { "==cgsGrants": { grants: [1] } };
        migrateDataCgsGrants(source, { senses: false });
        expect(source["==cgsGrants"].grants).toEqual([1]);
        expect("senses" in source["==cgsGrants"]).toBe(false);
    });

    it("with senses:false, does not add cgsGrants when the key is absent", () => {
        const source = { conditionId: "foo" };
        migrateDataCgsGrants(source, { senses: false });
        expect("cgsGrants" in source).toBe(false);
    });
});
