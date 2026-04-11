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
});
