import { describe, expect, it } from "vitest";
import { resolveMonsterPackNpcKeys } from "../../../module/logic/monster-pack-keys.mjs";

describe("resolveMonsterPackNpcKeys", () => {
    it("maps creatureTypeKey to details.creatureTypeUuid and removes authoring keys", () => {
        const typeKeyToUuid = new Map([["humanoid", "Compendium.thirdera.thirdera_creature_types.Item.abc"]]);
        const subtypeKeyToUuid = new Map();
        const system = { creatureTypeKey: "humanoid", details: { creatureTypeUuid: "" } };
        resolveMonsterPackNpcKeys(system, typeKeyToUuid, subtypeKeyToUuid);
        expect(system.details.creatureTypeUuid).toBe("Compendium.thirdera.thirdera_creature_types.Item.abc");
        expect(system.creatureTypeKey).toBeUndefined();
    });

    it("maps subtypeKeys to subtypeUuids in order", () => {
        const typeKeyToUuid = new Map();
        const subtypeKeyToUuid = new Map([
            ["goblinoid", "Compendium.thirdera.thirdera_subtypes.Item.g1"],
            ["evil", "Compendium.thirdera.thirdera_subtypes.Item.e1"]
        ]);
        const system = { subtypeKeys: ["goblinoid", "evil"], details: { subtypeUuids: [] } };
        resolveMonsterPackNpcKeys(system, typeKeyToUuid, subtypeKeyToUuid);
        expect(system.details.subtypeUuids).toEqual([
            "Compendium.thirdera.thirdera_subtypes.Item.g1",
            "Compendium.thirdera.thirdera_subtypes.Item.e1"
        ]);
        expect(system.subtypeKeys).toBeUndefined();
    });

    it("ignores unknown keys without clearing existing UUIDs", () => {
        const system = {
            creatureTypeKey: "unknownType",
            details: {
                creatureTypeUuid: "existing-uuid",
                subtypeUuids: ["keep-me"]
            },
            subtypeKeys: ["unknownSub"],
        };
        resolveMonsterPackNpcKeys(system, new Map(), new Map());
        expect(system.details.creatureTypeUuid).toBe("existing-uuid");
        expect(system.details.subtypeUuids).toEqual(["keep-me"]);
        expect(system.creatureTypeKey).toBeUndefined();
        expect(system.subtypeKeys).toBeUndefined();
    });

    it("no-ops on non-objects", () => {
        expect(() => resolveMonsterPackNpcKeys(null, new Map(), new Map())).not.toThrow();
    });
});
