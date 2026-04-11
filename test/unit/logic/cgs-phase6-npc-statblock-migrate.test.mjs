import { describe, expect, it } from "vitest";
import {
    buildNpcPhase6StatBlockSenseMigrationUpdate,
    migrateNpcStatBlockSensesIntoCgsGrants,
    npcStatBlockSenseDedupeKey,
    npcSystemHasLegacyStatBlockSenses,
    normalizeStatBlockSenseRow
} from "../../../module/logic/cgs-phase6-npc-statblock-migrate.mjs";

describe("cgs-phase6-npc-statblock-migrate", () => {
    it("npcStatBlockSenseDedupeKey normalizes case and whitespace", () => {
        expect(npcStatBlockSenseDedupeKey(" Darkvision ", " 60 ft. ")).toBe(
            npcStatBlockSenseDedupeKey("darkvision", "60 ft.")
        );
    });

    it("normalizeStatBlockSenseRow requires type", () => {
        expect(normalizeStatBlockSenseRow({ type: "", range: "5" })).toBeNull();
        expect(normalizeStatBlockSenseRow({ type: "darkvision", range: "60 ft." })).toEqual({
            type: "darkvision",
            range: "60 ft."
        });
    });

    it("migrateNpcStatBlockSensesIntoCgsGrants merges, dedupes, and clears stat block", () => {
        const source = {
            statBlock: {
                senses: [
                    { type: "darkvision", range: "60 ft." },
                    { type: "darkvision", range: "60 ft." },
                    { type: "lowLight", range: "" }
                ]
            },
            cgsGrants: {
                senses: [{ type: "darkvision", range: "60 ft." }],
                creatureTypeOverlayUuids: [],
                subtypeOverlayUuids: []
            }
        };
        const changed = migrateNpcStatBlockSensesIntoCgsGrants(source);
        expect(changed).toBe(true);
        expect(source.statBlock.senses).toEqual([]);
        expect(source.cgsGrants.senses).toEqual([
            { type: "darkvision", range: "60 ft." },
            { type: "lowLight", range: "" }
        ]);
    });

    it("migrateNpcStatBlockSensesIntoCgsGrants is idempotent", () => {
        const source = {
            statBlock: { senses: [] },
            cgsGrants: { senses: [{ type: "darkvision", range: "60 ft." }], creatureTypeOverlayUuids: [], subtypeOverlayUuids: [] }
        };
        expect(migrateNpcStatBlockSensesIntoCgsGrants(source)).toBe(false);
    });

    it("buildNpcPhase6StatBlockSenseMigrationUpdate returns flat paths", () => {
        const system = {
            statBlock: { senses: [{ type: "tremorsense", range: "30 ft." }] },
            cgsGrants: { senses: [], creatureTypeOverlayUuids: [], subtypeOverlayUuids: [] }
        };
        const flat = buildNpcPhase6StatBlockSenseMigrationUpdate(system);
        expect(flat).toEqual({
            "system.cgsGrants.senses": [{ type: "tremorsense", range: "30 ft." }],
            "system.statBlock.senses": []
        });
        expect(npcSystemHasLegacyStatBlockSenses(system)).toBe(true);
    });
});
