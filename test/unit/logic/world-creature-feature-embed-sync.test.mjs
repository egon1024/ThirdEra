import { describe, expect, it } from "vitest";
import {
    actorHasCreatureFeatureNamed,
    actorHasCreatureFeatureWithWorldSourceId,
    getEmbeddedCreatureFeaturesMatchingWorldTemplate
} from "../../../module/logic/world-creature-feature-embed-sync.mjs";

describe("world-creature-feature-embed-sync", () => {
    const worldUuid = "Item.abc123world";

    it("actorHasCreatureFeatureWithWorldSourceId matches type and sourceId", () => {
        expect(actorHasCreatureFeatureWithWorldSourceId({ items: { contents: [] } }, worldUuid)).toBe(false);
        expect(
            actorHasCreatureFeatureWithWorldSourceId(
                {
                    items: {
                        contents: [{ type: "feat", sourceId: worldUuid }]
                    }
                },
                worldUuid
            )
        ).toBe(false);
        expect(
            actorHasCreatureFeatureWithWorldSourceId(
                {
                    items: {
                        contents: [{ type: "creatureFeature", sourceId: worldUuid }]
                    }
                },
                worldUuid
            )
        ).toBe(true);
    });

    it("actorHasCreatureFeatureNamed matches trimmed name", () => {
        expect(actorHasCreatureFeatureNamed({ items: { contents: [] } }, "  Scent  ")).toBe(false);
        expect(
            actorHasCreatureFeatureNamed(
                {
                    items: {
                        contents: [{ type: "creatureFeature", name: "Scent" }]
                    }
                },
                "  Scent  "
            )
        ).toBe(true);
    });

    it("getEmbeddedCreatureFeaturesMatchingWorldTemplate filters by sourceId or name", () => {
        const actor = {
            items: {
                contents: [
                    { type: "creatureFeature", name: "A", sourceId: "other" },
                    { type: "creatureFeature", name: "Template", sourceId: worldUuid },
                    { type: "feat", name: "Template", sourceId: worldUuid }
                ]
            }
        };
        const byUuid = getEmbeddedCreatureFeaturesMatchingWorldTemplate(actor, worldUuid, "");
        expect(byUuid).toHaveLength(1);
        expect(byUuid[0].name).toBe("Template");

        const byName = getEmbeddedCreatureFeaturesMatchingWorldTemplate(actor, "unused-uuid", "A");
        expect(byName).toHaveLength(1);
        expect(byName[0].sourceId).toBe("other");
    });

    it("iterates items.values when contents missing", () => {
        const cf = { type: "creatureFeature", name: "X", sourceId: worldUuid };
        const actor = { items: new Map([["i1", cf]]) };
        expect(actorHasCreatureFeatureWithWorldSourceId(actor, worldUuid)).toBe(true);
        expect(getEmbeddedCreatureFeaturesMatchingWorldTemplate(actor, worldUuid, "").map((i) => i.name)).toEqual(["X"]);
    });
});
