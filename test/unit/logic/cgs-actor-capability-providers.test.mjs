import { describe, expect, it } from "vitest";
import { getActiveCapabilityGrants } from "../../../module/logic/capability-aggregation.mjs";
import {
    cgsActorCgsGrantsSensesProvider,
    cgsNpcStatBlockSensesProvider
} from "../../../module/logic/cgs-actor-capability-providers.mjs";

describe("cgsNpcStatBlockSensesProvider", () => {
    it("returns empty for non-npc", () => {
        expect(cgsNpcStatBlockSensesProvider({ type: "character", system: { statBlock: { senses: [{ type: "darkvision", range: "" }] } } })).toEqual([]);
    });

    it("maps stat block rows to sense grants", () => {
        const out = cgsNpcStatBlockSensesProvider({
            type: "npc",
            system: {
                statBlock: {
                    senses: [
                        { type: "darkvision", range: "60 ft" },
                        { type: "", range: "x" }
                    ]
                }
            }
        });
        expect(out).toHaveLength(1);
        expect(out[0].label).toBe("Stat block");
        expect(out[0].grants).toEqual([
            { category: "sense", senseType: "darkvision", range: "60 ft" }
        ]);
    });
});

describe("cgsActorCgsGrantsSensesProvider", () => {
    it("skips rows with unset type (blank placeholder)", () => {
        const out = cgsActorCgsGrantsSensesProvider({
            uuid: "Actor.x",
            type: "npc",
            system: {
                cgsGrants: { senses: [{ type: "", range: "" }, { type: "blindsight", range: "30 ft" }] }
            }
        });
        expect(out[0].grants).toHaveLength(1);
        expect(out[0].grants[0]).toMatchObject({ category: "sense", senseType: "blindsight" });
    });

    it("maps cgsGrants.senses for any actor type", () => {
        const out = cgsActorCgsGrantsSensesProvider({
            uuid: "Actor.x",
            type: "character",
            system: {
                cgsGrants: { senses: [{ type: "lowLight", range: "" }] }
            }
        });
        expect(out[0].grants[0]).toMatchObject({ category: "sense", senseType: "lowLight" });
        expect(out[0].sourceRef?.uuid).toBe("Actor.x");
    });
});

describe("CGS NPC providers + merge (integration)", () => {
    it("merges stat block and cgsGrants with dedupe and two sources", () => {
        const actor = {
            type: "npc",
            uuid: "Actor.npc1",
            system: {
                statBlock: {
                    senses: [{ type: "darkvision", range: "60 ft" }]
                },
                cgsGrants: {
                    senses: [{ type: "darkvision", range: "60 ft" }]
                }
            }
        };
        const providers = [cgsNpcStatBlockSensesProvider, cgsActorCgsGrantsSensesProvider];
        const cgs = getActiveCapabilityGrants(actor, {
            providers,
            senseTypeLabels: { darkvision: "Darkvision" }
        });
        expect(cgs.senses.rows).toHaveLength(1);
        expect(cgs.senses.rows[0].senseType).toBe("darkvision");
        expect(cgs.senses.rows[0].sources.map(s => s.label).sort()).toEqual(["Capability grants", "Stat block"]);
    });
});
