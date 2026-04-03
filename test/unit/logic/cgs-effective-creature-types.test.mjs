import { describe, expect, it } from "vitest";
import {
    getEffectiveCreatureTypes,
    getEffectiveCreatureTypesFromActor,
} from "../../../module/logic/cgs-effective-creature-types.mjs";

describe("getEffectiveCreatureTypes", () => {
    // ── helpers ────────────────────────────────────────────────────────────
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

    // ── primary-only ────────────────────────────────────────────────────────
    it("returns the primary type when there are no overlays", () => {
        const result = getEffectiveCreatureTypes(system({ primaryType: "ct-uuid-1" }));
        expect(result.typeUuids).toEqual(["ct-uuid-1"]);
        expect(result.subtypeUuids).toEqual([]);
    });

    it("returns primary subtypes when there are no overlay subtypes", () => {
        const result = getEffectiveCreatureTypes(
            system({ primarySubtypes: ["st-uuid-1", "st-uuid-2"] })
        );
        expect(result.subtypeUuids).toEqual(["st-uuid-1", "st-uuid-2"]);
        expect(result.typeUuids).toEqual([]);
    });

    // ── overlays-only ───────────────────────────────────────────────────────
    it("returns overlays when there is no primary type (character / PC use-case)", () => {
        const result = getEffectiveCreatureTypes(
            system({ overlayTypes: ["ct-uuid-elf"], overlaySubtypes: ["st-uuid-halfblood"] })
        );
        expect(result.typeUuids).toEqual(["ct-uuid-elf"]);
        expect(result.subtypeUuids).toEqual(["st-uuid-halfblood"]);
    });

    // ── union (primary + overlays, no duplicates) ───────────────────────────
    it("unions primary and overlay types, primary first", () => {
        const result = getEffectiveCreatureTypes(
            system({ primaryType: "ct-base", overlayTypes: ["ct-overlay-a", "ct-overlay-b"] })
        );
        expect(result.typeUuids).toEqual(["ct-base", "ct-overlay-a", "ct-overlay-b"]);
    });

    it("unions primary and overlay subtypes, primary first", () => {
        const result = getEffectiveCreatureTypes(
            system({
                primarySubtypes: ["st-a", "st-b"],
                overlaySubtypes: ["st-c", "st-d"],
            })
        );
        expect(result.subtypeUuids).toEqual(["st-a", "st-b", "st-c", "st-d"]);
    });

    // ── deduplication ───────────────────────────────────────────────────────
    it("deduplicates overlay type that repeats the primary type", () => {
        const result = getEffectiveCreatureTypes(
            system({ primaryType: "ct-base", overlayTypes: ["ct-base", "ct-extra"] })
        );
        expect(result.typeUuids).toEqual(["ct-base", "ct-extra"]);
    });

    it("deduplicates overlay subtype that repeats a primary subtype", () => {
        const result = getEffectiveCreatureTypes(
            system({ primarySubtypes: ["st-a"], overlaySubtypes: ["st-a", "st-b"] })
        );
        expect(result.subtypeUuids).toEqual(["st-a", "st-b"]);
    });

    it("deduplicates overlay types that repeat each other", () => {
        const result = getEffectiveCreatureTypes(
            system({ overlayTypes: ["ct-x", "ct-x", "ct-y"] })
        );
        expect(result.typeUuids).toEqual(["ct-x", "ct-y"]);
    });

    // ── empty strings ───────────────────────────────────────────────────────
    it("discards empty-string primary type", () => {
        const result = getEffectiveCreatureTypes(system({ primaryType: "" }));
        expect(result.typeUuids).toEqual([]);
    });

    it("discards empty-string primary subtypes", () => {
        const result = getEffectiveCreatureTypes(system({ primarySubtypes: ["", "st-valid", ""] }));
        expect(result.subtypeUuids).toEqual(["st-valid"]);
    });

    it("discards empty-string overlay typeUuids", () => {
        const result = getEffectiveCreatureTypes(
            system({ overlayTypes: ["", "ct-valid", ""] })
        );
        expect(result.typeUuids).toEqual(["ct-valid"]);
    });

    it("discards empty-string overlay subtypeUuids", () => {
        const result = getEffectiveCreatureTypes(
            system({ overlaySubtypes: ["", "st-valid"] })
        );
        expect(result.subtypeUuids).toEqual(["st-valid"]);
    });

    it("trims whitespace from UUIDs", () => {
        const systemData = {
            details: { creatureTypeUuid: "  ct-trimmed  ", subtypeUuids: ["  st-trimmed  "] },
            cgs: {
                creatureTypeOverlays: { rows: [{ typeUuid: "  ct-overlay-trimmed  " }] },
                subtypeOverlays: { rows: [{ subtypeUuid: "  st-overlay-trimmed  " }] },
            },
        };
        const result = getEffectiveCreatureTypes(systemData);
        expect(result.typeUuids).toEqual(["ct-trimmed", "ct-overlay-trimmed"]);
        expect(result.subtypeUuids).toEqual(["st-trimmed", "st-overlay-trimmed"]);
    });

    // ── missing / undefined fields ──────────────────────────────────────────
    it("handles undefined systemData gracefully", () => {
        const result = getEffectiveCreatureTypes(undefined);
        expect(result.typeUuids).toEqual([]);
        expect(result.subtypeUuids).toEqual([]);
    });

    it("handles null systemData gracefully", () => {
        const result = getEffectiveCreatureTypes(null);
        expect(result.typeUuids).toEqual([]);
        expect(result.subtypeUuids).toEqual([]);
    });

    it("handles missing cgs gracefully", () => {
        const result = getEffectiveCreatureTypes({ details: { creatureTypeUuid: "ct-1", subtypeUuids: ["st-1"] } });
        expect(result.typeUuids).toEqual(["ct-1"]);
        expect(result.subtypeUuids).toEqual(["st-1"]);
    });

    it("handles missing details gracefully", () => {
        const result = getEffectiveCreatureTypes({
            cgs: {
                creatureTypeOverlays: { rows: [{ typeUuid: "ct-ov" }] },
                subtypeOverlays: { rows: [{ subtypeUuid: "st-ov" }] },
            },
        });
        expect(result.typeUuids).toEqual(["ct-ov"]);
        expect(result.subtypeUuids).toEqual(["st-ov"]);
    });

    it("handles missing cgs.creatureTypeOverlays gracefully", () => {
        const result = getEffectiveCreatureTypes({
            details: { creatureTypeUuid: "ct-1", subtypeUuids: [] },
            cgs: {},
        });
        expect(result.typeUuids).toEqual(["ct-1"]);
    });

    it("handles null rows in overlays gracefully", () => {
        const result = getEffectiveCreatureTypes({
            details: {},
            cgs: {
                creatureTypeOverlays: { rows: null },
                subtypeOverlays: { rows: undefined },
            },
        });
        expect(result.typeUuids).toEqual([]);
        expect(result.subtypeUuids).toEqual([]);
    });

    it("handles row entries with missing typeUuid/subtypeUuid gracefully", () => {
        const result = getEffectiveCreatureTypes({
            details: {},
            cgs: {
                creatureTypeOverlays: { rows: [{ typeUuid: undefined }, { typeUuid: "ct-ok" }] },
                subtypeOverlays: { rows: [{ subtypeUuid: null }, { subtypeUuid: "st-ok" }] },
            },
        });
        expect(result.typeUuids).toEqual(["ct-ok"]);
        expect(result.subtypeUuids).toEqual(["st-ok"]);
    });

    // ── combined full scenario ──────────────────────────────────────────────
    it("handles NPC with primary type + subtypes + overlays with partial overlap", () => {
        const result = getEffectiveCreatureTypes(
            system({
                primaryType: "ct-undead",
                primarySubtypes: ["st-incorporeal"],
                overlayTypes: ["ct-undead", "ct-shapechanger"],
                overlaySubtypes: ["st-incorporeal", "st-evil"],
            })
        );
        expect(result.typeUuids).toEqual(["ct-undead", "ct-shapechanger"]);
        expect(result.subtypeUuids).toEqual(["st-incorporeal", "st-evil"]);
    });
});

describe("getEffectiveCreatureTypesFromActor", () => {
    it("delegates to actor.system", () => {
        const actor = {
            system: {
                details: { creatureTypeUuid: "ct-actor", subtypeUuids: ["st-actor"] },
                cgs: { creatureTypeOverlays: { rows: [] }, subtypeOverlays: { rows: [] } },
            },
        };
        const result = getEffectiveCreatureTypesFromActor(actor);
        expect(result.typeUuids).toEqual(["ct-actor"]);
        expect(result.subtypeUuids).toEqual(["st-actor"]);
    });

    it("handles null actor gracefully", () => {
        const result = getEffectiveCreatureTypesFromActor(null);
        expect(result.typeUuids).toEqual([]);
        expect(result.subtypeUuids).toEqual([]);
    });
});
