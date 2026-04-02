import { describe, expect, it } from "vitest";
import { getActiveCapabilityGrants } from "../../../module/logic/capability-aggregation.mjs";
import {
    cgsActorCgsGrantsSensesProvider,
    cgsNpcStatBlockDamageReductionProvider,
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

describe("cgsNpcStatBlockDamageReductionProvider (Phase 5e)", () => {
    it("returns empty for non-npc", () => {
        expect(cgsNpcStatBlockDamageReductionProvider({
            type: "character",
            system: { statBlock: { damageReduction: { value: 10, bypass: "magic" } } }
        })).toEqual([]);
    });

    it("returns empty when DR value is zero", () => {
        expect(cgsNpcStatBlockDamageReductionProvider({
            type: "npc",
            system: { statBlock: { damageReduction: { value: 0, bypass: "magic" } } }
        })).toEqual([]);
    });

    it("returns empty when DR object is missing", () => {
        expect(cgsNpcStatBlockDamageReductionProvider({
            type: "npc",
            system: { statBlock: {} }
        })).toEqual([]);
    });

    it("maps stat block DR to damageReduction grant", () => {
        const out = cgsNpcStatBlockDamageReductionProvider({
            type: "npc",
            system: {
                statBlock: {
                    damageReduction: { value: 10, bypass: "magic" }
                }
            }
        });
        expect(out).toHaveLength(1);
        expect(out[0].label).toBe("Stat block");
        expect(out[0].sourceRef).toEqual({ kind: "statBlock" });
        expect(out[0].grants).toHaveLength(1);
        expect(out[0].grants[0]).toEqual({
            category: "damageReduction",
            value: 10,
            bypass: "magic"
        });
    });

    it("handles empty bypass string", () => {
        const out = cgsNpcStatBlockDamageReductionProvider({
            type: "npc",
            system: {
                statBlock: {
                    damageReduction: { value: 5, bypass: "" }
                }
            }
        });
        expect(out[0].grants[0]).toEqual({
            category: "damageReduction",
            value: 5,
            bypass: ""
        });
    });
});

describe("CGS NPC DR provider + merge (integration)", () => {
    it("integrates stat block DR into merged damageReduction.rows", () => {
        const actor = {
            type: "npc",
            uuid: "Actor.npc1",
            system: {
                statBlock: {
                    damageReduction: { value: 15, bypass: "good" }
                }
            }
        };
        const cgs = getActiveCapabilityGrants(actor, {
            providers: [cgsNpcStatBlockDamageReductionProvider],
            drBypassLabels: { good: "Good" }
        });
        expect(cgs.damageReduction.rows).toHaveLength(1);
        expect(cgs.damageReduction.rows[0].value).toBe(15);
        expect(cgs.damageReduction.rows[0].bypass).toBe("good");
        expect(cgs.damageReduction.rows[0].label).toBe("15/Good");
        expect(cgs.damageReduction.rows[0].sources[0].label).toBe("Stat block");
    });
});
