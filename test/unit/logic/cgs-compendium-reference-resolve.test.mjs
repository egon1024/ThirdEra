import { describe, it, expect } from "vitest";
import {
    buildCreatureTypeKeyToUuidMap,
    buildSpellKeyToUuidMap,
    resolveSpellTargetCreatureKeys,
    resolveMechanicalCreatureGateKeys,
    resolveCgsGrantReferenceKeys
} from "../../../module/logic/cgs-compendium-reference-resolve.mjs";

describe("cgs-compendium-reference-resolve", () => {
    it("buildCreatureTypeKeyToUuidMap maps keys", () => {
        const m = buildCreatureTypeKeyToUuidMap([
            { system: { key: "humanoid" }, uuid: "u1" },
            { system: { key: "animal" }, uuid: "u2" }
        ]);
        expect(m.get("humanoid")).toBe("u1");
        expect(m.get("animal")).toBe("u2");
    });

    it("buildSpellKeyToUuidMap maps spell keys", () => {
        const m = buildSpellKeyToUuidMap([{ system: { key: "darkvision" }, uuid: "s1" }]);
        expect(m.get("darkvision")).toBe("s1");
    });

    it("resolveSpellTargetCreatureKeys merges type and subtype keys into uuid list", () => {
        const typeM = new Map([["humanoid", "T1"]]);
        const subM = new Map([["aquatic", "S1"]]);
        const r = resolveSpellTargetCreatureKeys(
            {
                targetCreatureTypeKeys: ["humanoid"],
                targetCreatureSubtypeKeys: ["aquatic"],
                targetCreatureTypeUuids: ["existing"]
            },
            typeM,
            subM
        );
        expect(r).not.toBeNull();
        expect(new Set(r.targetCreatureTypeUuids)).toEqual(new Set(["existing", "T1", "S1"]));
        expect(r.clearTypeKeys).toBe(true);
        expect(r.clearSubtypeKeys).toBe(true);
    });

    it("resolveSpellTargetCreatureKeys does not clear keys when a key is unmapped", () => {
        const typeM = new Map([["humanoid", "T1"]]);
        const subM = new Map();
        const r = resolveSpellTargetCreatureKeys(
            {
                targetCreatureTypeKeys: ["humanoid", "missingType"],
                targetCreatureSubtypeKeys: [],
                targetCreatureTypeUuids: []
            },
            typeM,
            subM
        );
        expect(r.clearTypeKeys).toBe(false);
        expect(r.targetCreatureTypeUuids).toContain("T1");
    });

    it("resolveMechanicalCreatureGateKeys merges gate keys", () => {
        const typeM = new Map([["dwarf", "D1"]]);
        const subM = new Map();
        const r = resolveMechanicalCreatureGateKeys(
            { mechanicalCreatureGateTypeKeys: ["dwarf"], mechanicalCreatureGateUuids: [] },
            typeM,
            subM
        );
        expect(r.mechanicalCreatureGateUuids).toEqual(["D1"]);
    });

    it("resolveCgsGrantReferenceKeys resolves spellKey and overlay keys", () => {
        const maps = {
            spellKeyToUuid: new Map([["light", "Sp1"]]),
            typeKeyToUuid: new Map([["undead", "Ty1"]]),
            subtypeKeyToUuid: new Map([["evil", "Su1"]])
        };
        const { grants, changed } = resolveCgsGrantReferenceKeys(
            [
                { category: "spellGrant", spellKey: "light", atWill: true },
                { category: "creatureTypeOverlay", typeKey: "undead" },
                { category: "subtypeOverlay", subtypeKey: "evil" }
            ],
            maps
        );
        expect(changed).toBe(true);
        expect(grants[0].spellUuid).toBe("Sp1");
        expect(grants[0].spellKey).toBeUndefined();
        expect(grants[1].typeUuid).toBe("Ty1");
        expect(grants[2].subtypeUuid).toBe("Su1");
    });

    it("buildCreatureTypeKeyToUuidMap returns empty map for non-array input", () => {
        expect(buildCreatureTypeKeyToUuidMap(null).size).toBe(0);
        expect(buildCreatureTypeKeyToUuidMap(undefined).size).toBe(0);
    });

    it("buildCreatureTypeKeyToUuidMap skips entries with blank key or uuid", () => {
        const m = buildCreatureTypeKeyToUuidMap([
            { system: { key: "" }, uuid: "u1" },
            { system: { key: "k" }, uuid: "" },
            { system: { key: "  " }, uuid: "u2" },
            { system: { key: "ok" }, uuid: "good" }
        ]);
        expect(m.size).toBe(1);
        expect(m.get("ok")).toBe("good");
    });

    it("buildSpellKeyToUuidMap skips invalid rows like buildCreatureTypeKeyToUuidMap", () => {
        const m = buildSpellKeyToUuidMap(null);
        expect(m.size).toBe(0);
        const m2 = buildSpellKeyToUuidMap([{ system: { key: "x" }, uuid: "uuid-x" }]);
        expect(m2.get("x")).toBe("uuid-x");
    });

    it("resolveSpellTargetCreatureKeys returns null for non-object system", () => {
        expect(resolveSpellTargetCreatureKeys(null, new Map(), new Map())).toBeNull();
        expect(resolveSpellTargetCreatureKeys("x", new Map(), new Map())).toBeNull();
    });

    it("resolveSpellTargetCreatureKeys resolves subtype keys only", () => {
        const subM = new Map([["fire", "S1"]]);
        const r = resolveSpellTargetCreatureKeys(
            { targetCreatureSubtypeKeys: ["fire"], targetCreatureTypeKeys: [] },
            new Map(),
            subM
        );
        expect(r).not.toBeNull();
        expect(r.targetCreatureTypeUuids).toEqual(["S1"]);
        expect(r.clearTypeKeys).toBe(false);
        expect(r.clearSubtypeKeys).toBe(true);
    });

    it("resolveSpellTargetCreatureKeys ignores blank existing UUID strings", () => {
        const typeM = new Map([["humanoid", "T1"]]);
        const r = resolveSpellTargetCreatureKeys(
            {
                targetCreatureTypeKeys: ["humanoid"],
                targetCreatureTypeUuids: ["", "  ", "keep"]
            },
            typeM,
            new Map()
        );
        expect(new Set(r.targetCreatureTypeUuids)).toEqual(new Set(["keep", "T1"]));
    });

    it("resolveMechanicalCreatureGateKeys returns null when no gate keys", () => {
        expect(resolveMechanicalCreatureGateKeys({ mechanicalCreatureGateUuids: [] }, new Map(), new Map())).toBeNull();
    });

    it("resolveMechanicalCreatureGateKeys merges subtype keys and preserves clearSubtypeKeys false when unmapped", () => {
        const typeM = new Map();
        const subM = new Map([["good", "S1"]]);
        const r = resolveMechanicalCreatureGateKeys(
            {
                mechanicalCreatureGateSubtypeKeys: ["good", "missing"],
                mechanicalCreatureGateTypeKeys: [],
                mechanicalCreatureGateUuids: []
            },
            typeM,
            subM
        );
        expect(r.clearSubtypeKeys).toBe(false);
        expect(r.mechanicalCreatureGateUuids).toContain("S1");
    });

    it("resolveCgsGrantReferenceKeys returns unchanged for empty or non-array grants", () => {
        expect(resolveCgsGrantReferenceKeys([], mapsEmpty()).changed).toBe(false);
        const r = resolveCgsGrantReferenceKeys(null, mapsEmpty());
        expect(r.changed).toBe(false);
        expect(r.grants).toEqual([]);
    });

    it("resolveCgsGrantReferenceKeys leaves spellGrant unchanged when spellKey has no map entry", () => {
        const maps = {
            spellKeyToUuid: new Map(),
            typeKeyToUuid: new Map(),
            subtypeKeyToUuid: new Map()
        };
        const grants = [{ category: "spellGrant", spellKey: "nope", atWill: true }];
        const { grants: out, changed } = resolveCgsGrantReferenceKeys(grants, maps);
        expect(changed).toBe(false);
        expect(out[0].spellKey).toBe("nope");
    });

    it("resolveCgsGrantReferenceKeys skips spellGrant when spellUuid already set", () => {
        const maps = {
            spellKeyToUuid: new Map([["light", "Sp1"]]),
            typeKeyToUuid: new Map(),
            subtypeKeyToUuid: new Map()
        };
        const grants = [{ category: "spellGrant", spellUuid: "  already  ", spellKey: "light" }];
        const { grants: out, changed } = resolveCgsGrantReferenceKeys(grants, maps);
        expect(changed).toBe(false);
        expect(out[0].spellUuid).toBe("  already  ");
        expect(out[0].spellKey).toBe("light");
    });

    it("resolveCgsGrantReferenceKeys resolves creatureTypeOverlay and subtypeOverlay", () => {
        const maps = {
            spellKeyToUuid: new Map(),
            typeKeyToUuid: new Map([["undead", "Ty1"]]),
            subtypeKeyToUuid: new Map([["chaotic", "Su1"]])
        };
        const { grants, changed } = resolveCgsGrantReferenceKeys(
            [
                { category: "creatureTypeOverlay", typeKey: "undead" },
                { category: "subtypeOverlay", subtypeKey: "chaotic" }
            ],
            maps
        );
        expect(changed).toBe(true);
        expect(grants[0].typeUuid).toBe("Ty1");
        expect(grants[1].subtypeUuid).toBe("Su1");
    });

    it("resolveCgsGrantReferenceKeys leaves overlay unchanged when typeUuid already present", () => {
        const maps = {
            spellKeyToUuid: new Map(),
            typeKeyToUuid: new Map([["undead", "Ty1"]]),
            subtypeKeyToUuid: new Map()
        };
        const { grants, changed } = resolveCgsGrantReferenceKeys(
            [{ category: "creatureTypeOverlay", typeUuid: "was", typeKey: "undead" }],
            maps
        );
        expect(changed).toBe(false);
        expect(grants[0].typeUuid).toBe("was");
    });

    it("resolveCgsGrantReferenceKeys passes through unknown categories and non-object grants", () => {
        const maps = mapsEmpty();
        const { grants, changed } = resolveCgsGrantReferenceKeys(
            [{ category: "sense", label: "x" }, null, { category: "spellGrant" }],
            maps
        );
        expect(changed).toBe(false);
        expect(grants[0].category).toBe("sense");
        expect(grants[1]).toBeNull();
        expect(grants[2]).toEqual({ category: "spellGrant" });
    });
});

function mapsEmpty() {
    return {
        spellKeyToUuid: new Map(),
        typeKeyToUuid: new Map(),
        subtypeKeyToUuid: new Map()
    };
}
