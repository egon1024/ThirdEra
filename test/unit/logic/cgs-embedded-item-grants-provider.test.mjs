/**
 * Item-backed CGS provider tests. See also `describe("CGS invariant: grants follow sources")` —
 * documents the intentional design that merged grants are not revocable on the actor independently
 * of source items (.cursor/plans/cgs-implementation.md §1.1).
 */
import { describe, expect, it } from "vitest";
import {
    cgsContributionFromOwnedItem,
    cgsContributionFromRaceItem,
    cgsEmbeddedItemGrantsProvider
} from "../../../module/logic/cgs-embedded-item-grants-provider.mjs";
import { getActiveCapabilityGrants } from "../../../module/logic/capability-aggregation.mjs";

describe("cgsContributionFromRaceItem", () => {
    it("uses stock darkvision when embedded dwarf has empty grants but compendium sourceId", () => {
        const item = {
            type: "race",
            name: "Dwarf",
            uuid: "Actor.1.Item.embedded",
            sourceId: "Compendium.thirdera.thirdera_races.Item.race-dwarf",
            system: { cgsGrants: { grants: [], senses: [] } }
        };
        const c = cgsContributionFromRaceItem(item);
        expect(c?.grants).toEqual([{ category: "sense", senseType: "darkvision", range: "60 ft" }]);
        expect(c?.label).toBe("Dwarf");
    });
});

describe("cgsContributionFromOwnedItem", () => {
    it("returns null when grants missing or empty and no senses", () => {
        expect(cgsContributionFromOwnedItem(null, "X")).toBe(null);
        expect(cgsContributionFromOwnedItem({ name: "A", system: {} }, "X")).toBe(null);
        expect(cgsContributionFromOwnedItem({ name: "A", system: { cgsGrants: { grants: [] } } }, "X")).toBe(null);
    });

    it("uses mapped senses when grants empty", () => {
        const c = cgsContributionFromOwnedItem(
            {
                name: "Magic Helm",
                uuid: "Actor.1.Item.h",
                system: { cgsGrants: { grants: [], senses: [{ type: "darkvision", range: "30 ft" }] } }
            },
            "Equipment"
        );
        expect(c?.grants).toEqual([{ category: "sense", senseType: "darkvision", range: "30 ft" }]);
        expect(c?.label).toBe("Magic Helm");
    });

    it("builds label and item sourceRef with uuid", () => {
        const item = {
            name: "Dwarf",
            uuid: "Actor.1.Item.abc",
            system: {
                cgsGrants: {
                    grants: [{ category: "sense", senseType: "darkvision", range: "60 ft" }]
                }
            }
        };
        const c = cgsContributionFromOwnedItem(item, "Race");
        expect(c?.label).toBe("Dwarf");
        expect(c?.sourceRef).toEqual({ kind: "item", uuid: "Actor.1.Item.abc" });
        expect(c?.grants).toHaveLength(1);
    });
});

describe("cgsEmbeddedItemGrantsProvider", () => {
    it("includes embedded class feature items when they have grants", () => {
        const actor = {
            items: [
                {
                    type: "feature",
                    name: "Trap Sense",
                    uuid: "Actor.1.Item.cf1",
                    system: {
                        cgsGrants: { grants: [{ category: "sense", senseType: "tremorsense", range: "10 ft" }] }
                    }
                }
            ]
        };
        const out = cgsEmbeddedItemGrantsProvider(actor);
        expect(out).toHaveLength(1);
        expect(out[0].label).toBe("Trap Sense");
        expect(out[0].grants[0]).toMatchObject({ category: "sense", senseType: "tremorsense", range: "10 ft" });
    });

    it("includes race and feat always when they have grants", () => {
        const actor = {
            items: [
                {
                    type: "race",
                    name: "Elf",
                    uuid: "Item.r",
                    system: { cgsGrants: { grants: [{ category: "sense", senseType: "lowLight", range: "" }] } }
                },
                {
                    type: "feat",
                    name: "Alertness",
                    uuid: "Item.f",
                    system: { cgsGrants: { grants: [{ category: "sense", senseType: "scent", range: "30 ft" }] } }
                }
            ]
        };
        const out = cgsEmbeddedItemGrantsProvider(actor);
        expect(out.map((x) => x.label).sort()).toEqual(["Alertness", "Elf"]);
    });

    it("armor and equipment only when equipped true", () => {
        const actor = {
            items: [
                {
                    type: "armor",
                    name: "Leather",
                    uuid: "Item.a1",
                    system: { equipped: "false", cgsGrants: { grants: [{ category: "sense", senseType: "blindsight", range: "5 ft" }] } }
                },
                {
                    type: "equipment",
                    name: "Cloak",
                    uuid: "Item.e1",
                    system: { equipped: "true", cgsGrants: { grants: [{ category: "sense", senseType: "scent", range: "" }] } }
                }
            ]
        };
        const out = cgsEmbeddedItemGrantsProvider(actor);
        expect(out).toHaveLength(1);
        expect(out[0].label).toBe("Cloak");
    });

    it("feat contributes senses from cgsGrants.senses when grants empty", () => {
        const actor = {
            items: [
                {
                    type: "feat",
                    name: "Keen Nose",
                    uuid: "Item.f1",
                    system: { cgsGrants: { grants: [], senses: [{ type: "scent", range: "15 ft" }] } }
                }
            ]
        };
        const out = cgsEmbeddedItemGrantsProvider(actor);
        expect(out).toHaveLength(1);
        expect(out[0].grants[0]).toMatchObject({ category: "sense", senseType: "scent", range: "15 ft" });
    });

    it("weapon only when primary or offhand", () => {
        const actor = {
            items: [
                {
                    type: "weapon",
                    name: "Sword",
                    uuid: "Item.w0",
                    system: { equipped: "none", cgsGrants: { grants: [{ category: "sense", senseType: "darkvision", range: "10 ft" }] } }
                },
                {
                    type: "weapon",
                    name: "Torch",
                    uuid: "Item.w1",
                    system: { equipped: "primary", cgsGrants: { grants: [{ category: "sense", senseType: "lowLight", range: "" }] } }
                }
            ]
        };
        const out = cgsEmbeddedItemGrantsProvider(actor);
        expect(out).toHaveLength(1);
        expect(out[0].label).toBe("Torch");
    });

    it("merges with getActiveCapabilityGrants", () => {
        const actor = {
            items: [
                {
                    type: "race",
                    name: "Test",
                    uuid: "Item.t",
                    system: {
                        cgsGrants: { grants: [{ category: "sense", senseType: "darkvision", range: "60 ft" }] }
                    }
                }
            ]
        };
        const cgs = getActiveCapabilityGrants(actor, {
            providers: [cgsEmbeddedItemGrantsProvider],
            senseTypeLabels: { darkvision: "Darkvision" }
        });
        expect(cgs.senses.rows).toHaveLength(1);
        expect(cgs.senses.rows[0].senseType).toBe("darkvision");
        expect(cgs.senses.rows[0].sources[0].label).toBe("Test");
    });
});

/**
 * Invariant: no actor-persisted “revoke grant B, keep item A.” Merge is purely from provider inputs.
 * @see .cursor/plans/cgs-implementation.md §1.1
 * @see .cursor/rules/cgs-capability-grant-system.mdc (Source-of-truth invariant)
 */
describe("CGS invariant: grants follow sources", () => {
    it("race with empty grants and no stock id match contributes nothing", () => {
        const actor = {
            uuid: "Actor.c",
            system: {},
            items: [
                {
                    type: "race",
                    name: "Species A",
                    uuid: "Actor.c.Item.race1",
                    system: { cgsGrants: { grants: [] } }
                }
            ]
        };
        expect(cgsEmbeddedItemGrantsProvider(actor)).toEqual([]);
        const cgs = getActiveCapabilityGrants(actor, {
            providers: [cgsEmbeddedItemGrantsProvider],
            senseTypeLabels: { darkvision: "Darkvision" }
        });
        expect(cgs.senses.rows).toEqual([]);
    });

    it("race with grants merges with provenance on the item; dropping the grant requires editing item data (not actor merge)", () => {
        const actor = {
            items: [
                {
                    type: "race",
                    name: "Species A",
                    uuid: "Actor.c.Item.race1",
                    system: {
                        cgsGrants: {
                            grants: [{ category: "sense", senseType: "darkvision", range: "60 ft" }]
                        }
                    }
                }
            ]
        };
        const cgs = getActiveCapabilityGrants(actor, {
            providers: [cgsEmbeddedItemGrantsProvider],
            senseTypeLabels: { darkvision: "Darkvision" }
        });
        expect(cgs.senses.rows).toHaveLength(1);
        expect(cgs.senses.rows[0].sources[0].sourceRef).toEqual({
            kind: "item",
            uuid: "Actor.c.Item.race1"
        });
    });
});
