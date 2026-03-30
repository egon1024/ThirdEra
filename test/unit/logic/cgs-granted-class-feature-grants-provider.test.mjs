import { describe, expect, it } from "vitest";
import {
    actorHasEmbeddedFeatureMatchingWorldItem,
    cgsGrantedClassFeatureGrantsProvider
} from "../../../module/logic/cgs-granted-class-feature-grants-provider.mjs";
import { getActiveCapabilityGrants } from "../../../module/logic/capability-aggregation.mjs";

describe("actorHasEmbeddedFeatureMatchingWorldItem", () => {
    it("returns true when embedded feature sourceId matches world uuid", () => {
        const actor = {
            items: [
                {
                    type: "feature",
                    sourceId: "Item.worldF1",
                    id: "embedded1"
                }
            ]
        };
        const world = { uuid: "Item.worldF1", id: "worldF1" };
        expect(actorHasEmbeddedFeatureMatchingWorldItem(actor, world)).toBe(true);
    });

    it("returns true when embedded feature id matches world id", () => {
        const actor = {
            items: [{ type: "feature", id: "sameid", sourceId: "" }]
        };
        const world = { uuid: "Item.other", id: "sameid" };
        expect(actorHasEmbeddedFeatureMatchingWorldItem(actor, world)).toBe(true);
    });

    it("returns false for non-feature items", () => {
        const actor = { items: [{ type: "feat", sourceId: "Item.worldF1" }] };
        expect(actorHasEmbeddedFeatureMatchingWorldItem(actor, { uuid: "Item.worldF1", id: "x" })).toBe(false);
    });
});

describe("cgsGrantedClassFeatureGrantsProvider", () => {
    it("returns empty for non-characters", () => {
        expect(cgsGrantedClassFeatureGrantsProvider({ type: "npc", system: { levelHistory: [{}] } })).toEqual([]);
    });

    it("returns empty when no level history", () => {
        expect(
            cgsGrantedClassFeatureGrantsProvider({
                type: "character",
                system: {},
                items: []
            })
        ).toEqual([]);
    });

    it("emits grants from world feature resolved by featItemId when class level qualifies", () => {
        const worldFeature = {
            type: "feature",
            id: "wf1",
            uuid: "Item.wf1",
            name: "Keen Senses",
            system: {
                cgsGrants: { grants: [{ category: "sense", senseType: "scent", range: "30 ft" }] }
            }
        };
        const actor = {
            type: "character",
            id: "pc1",
            system: {
                levelHistory: [{ classItemId: "classA" }]
            },
            items: [
                {
                    type: "class",
                    id: "classA",
                    system: {
                        features: [
                            {
                                level: 1,
                                featItemId: "wf1",
                                featName: "Keen Senses",
                                featKey: "keenSenses"
                            }
                        ]
                    }
                }
            ]
        };
        const out = cgsGrantedClassFeatureGrantsProvider(actor, {
            getItem: (id) => (id === "wf1" ? worldFeature : undefined)
        });
        expect(out).toHaveLength(1);
        expect(out[0].label).toBe("Keen Senses");
        expect(out[0].grants[0]).toMatchObject({ category: "sense", senseType: "scent", range: "30 ft" });
        expect(out[0].sourceRef).toEqual({ kind: "item", uuid: "Item.wf1", id: "wf1" });
    });

    it("skips when feature level is above current class level", () => {
        const worldFeature = {
            type: "feature",
            id: "wf1",
            uuid: "Item.wf1",
            name: "Late",
            system: { cgsGrants: { grants: [{ category: "sense", senseType: "darkvision", range: "60 ft" }] } }
        };
        const actor = {
            type: "character",
            system: { levelHistory: [{ classItemId: "classA" }] },
            items: [
                {
                    type: "class",
                    id: "classA",
                    system: {
                        features: [{ level: 5, featItemId: "wf1", featName: "Late", featKey: "late" }]
                    }
                }
            ]
        };
        expect(
            cgsGrantedClassFeatureGrantsProvider(actor, {
                getItem: (id) => (id === "wf1" ? worldFeature : undefined)
            })
        ).toEqual([]);
    });

    it("skips class-table row when embedded feature already matches world item (no double count)", () => {
        const worldFeature = {
            type: "feature",
            id: "wf1",
            uuid: "Item.wf1",
            name: "Dup",
            system: {
                cgsGrants: { grants: [{ category: "sense", senseType: "tremorsense", range: "10 ft" }] }
            }
        };
        const actor = {
            type: "character",
            system: { levelHistory: [{ classItemId: "classA" }] },
            items: [
                {
                    type: "class",
                    id: "classA",
                    system: {
                        features: [{ level: 1, featItemId: "wf1", featName: "Dup", featKey: "d" }]
                    }
                },
                {
                    type: "feature",
                    id: "emb",
                    uuid: "Actor.1.Item.emb",
                    sourceId: "Item.wf1",
                    system: worldFeature.system
                }
            ]
        };
        expect(
            cgsGrantedClassFeatureGrantsProvider(actor, {
                getItem: (id) => (id === "wf1" ? worldFeature : undefined)
            })
        ).toEqual([]);
    });

    it("merges with aggregation when used as a capability provider", () => {
        const worldFeature = {
            type: "feature",
            id: "wf1",
            uuid: "Item.wf1",
            name: "Table Grant",
            system: {
                cgsGrants: { grants: [{ category: "sense", senseType: "blindsense", range: "20 ft" }] }
            }
        };
        const actor = {
            type: "character",
            system: { levelHistory: [{ classItemId: "c1" }] },
            items: [
                {
                    type: "class",
                    id: "c1",
                    system: {
                        features: [{ level: 1, featItemId: "wf1", featName: "X", featKey: "x" }]
                    }
                }
            ]
        };
        const getItem = (id) => (id === "wf1" ? worldFeature : undefined);
        const cgs = getActiveCapabilityGrants(actor, {
            providers: [(a) => cgsGrantedClassFeatureGrantsProvider(a, { getItem })],
            senseTypeLabels: { blindsense: "Blindsense" }
        });
        expect(cgs.senses.rows.some((r) => r.senseType === "blindsense")).toBe(true);
    });
});
