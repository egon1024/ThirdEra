import { describe, expect, it } from "vitest";
import {
    normalizeSpellTargetCreatureTypeUuids,
    validateSpellTargetCreatureType,
    validateSpellTargetsCreatureTypes,
} from "../../../module/logic/spell-creature-type-targeting.mjs";

function system({ primaryType = "", primarySubtypes = [], overlayTypes = [], overlaySubtypes = [] } = {}) {
    return {
        details: {
            creatureTypeUuid: primaryType,
            subtypeUuids: primarySubtypes,
        },
        cgs: {
            creatureTypeOverlays: { rows: overlayTypes.map((typeUuid) => ({ typeUuid })) },
            subtypeOverlays: { rows: overlaySubtypes.map((subtypeUuid) => ({ subtypeUuid })) },
        },
    };
}

describe("normalizeSpellTargetCreatureTypeUuids", () => {
    it("returns empty array for non-array", () => {
        expect(normalizeSpellTargetCreatureTypeUuids(undefined)).toEqual([]);
        expect(normalizeSpellTargetCreatureTypeUuids(null)).toEqual([]);
        expect(normalizeSpellTargetCreatureTypeUuids("string")).toEqual([]);
    });

    it("trims and filters empty strings", () => {
        expect(normalizeSpellTargetCreatureTypeUuids(["  uuid-1  ", "", "  ", "uuid-2"]))
            .toEqual(["uuid-1", "uuid-2"]);
    });

    it("filters non-string entries", () => {
        expect(normalizeSpellTargetCreatureTypeUuids([42, null, "uuid-ok"]))
            .toEqual(["uuid-ok"]);
    });
});

describe("validateSpellTargetCreatureType", () => {
    it("returns valid=true when spell has no restriction", () => {
        const result = validateSpellTargetCreatureType([], system({ primaryType: "ct-undead" }));
        expect(result.valid).toBe(true);
        expect(result.spellTypeUuids).toEqual([]);
    });

    it("returns valid=true when target primary type matches", () => {
        const result = validateSpellTargetCreatureType(
            ["ct-humanoid"],
            system({ primaryType: "ct-humanoid" })
        );
        expect(result.valid).toBe(true);
    });

    it("returns valid=false when target primary type does not match", () => {
        const result = validateSpellTargetCreatureType(
            ["ct-humanoid"],
            system({ primaryType: "ct-undead" })
        );
        expect(result.valid).toBe(false);
    });

    it("matches against primary subtypes", () => {
        const result = validateSpellTargetCreatureType(
            ["st-fire"],
            system({ primarySubtypes: ["st-fire", "st-evil"] })
        );
        expect(result.valid).toBe(true);
    });

    it("matches against CGS overlay types", () => {
        const result = validateSpellTargetCreatureType(
            ["ct-undead"],
            system({ primaryType: "ct-humanoid", overlayTypes: ["ct-undead"] })
        );
        expect(result.valid).toBe(true);
    });

    it("matches against CGS overlay subtypes", () => {
        const result = validateSpellTargetCreatureType(
            ["st-shapechanger"],
            system({ overlaySubtypes: ["st-shapechanger"] })
        );
        expect(result.valid).toBe(true);
    });

    it("returns valid=false when no types match at all", () => {
        const result = validateSpellTargetCreatureType(
            ["ct-animal"],
            system({ primaryType: "ct-undead", overlayTypes: ["ct-outsider"] })
        );
        expect(result.valid).toBe(false);
    });

    it("handles missing system data gracefully", () => {
        const result = validateSpellTargetCreatureType(["ct-humanoid"], undefined);
        expect(result.valid).toBe(false);
        expect(result.targetTypeUuids).toEqual([]);
    });
});

describe("validateSpellTargetsCreatureTypes", () => {
    const humanoid = system({ primaryType: "ct-humanoid" });
    const undead = system({ primaryType: "ct-undead" });
    const animal = system({ primaryType: "ct-animal" });

    it("returns hasRestriction=false and allValid=true when no spell restriction", () => {
        const result = validateSpellTargetsCreatureTypes([], [
            { name: "Zombie", uuid: "a1", systemData: undead },
        ]);
        expect(result.hasRestriction).toBe(false);
        expect(result.allValid).toBe(true);
    });

    it("validates each target independently", () => {
        const result = validateSpellTargetsCreatureTypes(["ct-humanoid"], [
            { name: "Guard", uuid: "a1", systemData: humanoid },
            { name: "Zombie", uuid: "a2", systemData: undead },
            { name: "Wolf", uuid: "a3", systemData: animal },
        ]);
        expect(result.hasRestriction).toBe(true);
        expect(result.allValid).toBe(false);
        expect(result.results[0]).toEqual({ name: "Guard", uuid: "a1", valid: true });
        expect(result.results[1]).toEqual({ name: "Zombie", uuid: "a2", valid: false });
        expect(result.results[2]).toEqual({ name: "Wolf", uuid: "a3", valid: false });
    });

    it("allValid=true when every target matches", () => {
        const result = validateSpellTargetsCreatureTypes(["ct-humanoid"], [
            { name: "Guard", uuid: "a1", systemData: humanoid },
        ]);
        expect(result.hasRestriction).toBe(true);
        expect(result.allValid).toBe(true);
    });

    it("handles multiple allowed types (any-of semantics)", () => {
        const result = validateSpellTargetsCreatureTypes(["ct-humanoid", "ct-animal"], [
            { name: "Guard", uuid: "a1", systemData: humanoid },
            { name: "Wolf", uuid: "a2", systemData: animal },
            { name: "Zombie", uuid: "a3", systemData: undead },
        ]);
        expect(result.results[0].valid).toBe(true);
        expect(result.results[1].valid).toBe(true);
        expect(result.results[2].valid).toBe(false);
        expect(result.allValid).toBe(false);
    });

    it("handles empty target list", () => {
        const result = validateSpellTargetsCreatureTypes(["ct-humanoid"], []);
        expect(result.hasRestriction).toBe(true);
        expect(result.allValid).toBe(true);
        expect(result.results).toEqual([]);
    });
});
