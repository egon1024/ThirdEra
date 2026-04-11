import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveSpellTargetTypeUuidsFromPacks } from "../../../module/logic/cgs-spell-target-type-resolve-runtime.mjs";

describe("resolveSpellTargetTypeUuidsFromPacks", () => {
    let prevGame;

    beforeEach(() => {
        prevGame = globalThis.game;
    });

    afterEach(() => {
        globalThis.game = prevGame;
    });

    it("returns normalized base UUIDs when spell system is missing", async () => {
        globalThis.game = { packs: new Map() };
        await expect(resolveSpellTargetTypeUuidsFromPacks(null)).resolves.toEqual([]);
        await expect(resolveSpellTargetTypeUuidsFromPacks(undefined)).resolves.toEqual([]);
    });

    it("returns normalized UUIDs when there are no type or subtype keys", async () => {
        globalThis.game = { packs: new Map() };
        const spell = { targetCreatureTypeUuids: ["  uuid-a  ", "", "uuid-b"] };
        await expect(resolveSpellTargetTypeUuidsFromPacks(spell)).resolves.toEqual(["uuid-a", "uuid-b"]);
    });

    it("does not call packs when type/subtype key arrays are empty or whitespace-only", async () => {
        const get = () => {
            throw new Error("packs should not be accessed");
        };
        globalThis.game = { packs: { get } };
        await expect(
            resolveSpellTargetTypeUuidsFromPacks({
                targetCreatureTypeKeys: ["", "  "],
                targetCreatureSubtypeKeys: [],
                targetCreatureTypeUuids: ["keep"]
            })
        ).resolves.toEqual(["keep"]);
    });

    it("returns base when game is undefined", async () => {
        delete globalThis.game;
        const spell = {
            targetCreatureTypeKeys: ["humanoid"],
            targetCreatureTypeUuids: ["existing"]
        };
        await expect(resolveSpellTargetTypeUuidsFromPacks(spell)).resolves.toEqual(["existing"]);
    });

    it("returns base when game.packs is missing", async () => {
        globalThis.game = {};
        const spell = {
            targetCreatureTypeKeys: ["humanoid"],
            targetCreatureTypeUuids: ["u1"]
        };
        await expect(resolveSpellTargetTypeUuidsFromPacks(spell)).resolves.toEqual(["u1"]);
    });

    it("returns base when creature type or subtype pack is missing", async () => {
        globalThis.game = {
            packs: {
                get: (id) => {
                    if (id === "thirdera.thirdera_creature_types") return { getDocuments: async () => [] };
                    return undefined;
                }
            }
        };
        const spell = {
            targetCreatureTypeKeys: ["humanoid"],
            targetCreatureSubtypeKeys: ["aquatic"],
            targetCreatureTypeUuids: ["prior"]
        };
        await expect(resolveSpellTargetTypeUuidsFromPacks(spell)).resolves.toEqual(["prior"]);
    });

    it("merges resolved keys with existing UUIDs using pack documents", async () => {
        const typePack = {
            getDocuments: async () => [{ system: { key: "humanoid" }, uuid: "TypeHumanoid" }]
        };
        const subPack = {
            getDocuments: async () => [{ system: { key: "aquatic" }, uuid: "SubtypeAquatic" }]
        };
        globalThis.game = {
            packs: {
                get: (id) => {
                    if (id === "thirdera.thirdera_creature_types") return typePack;
                    if (id === "thirdera.thirdera_subtypes") return subPack;
                    return undefined;
                }
            }
        };
        const spell = {
            targetCreatureTypeKeys: ["humanoid"],
            targetCreatureSubtypeKeys: ["aquatic"],
            targetCreatureTypeUuids: ["  existing  "]
        };
        const out = await resolveSpellTargetTypeUuidsFromPacks(spell);
        expect(new Set(out)).toEqual(new Set(["existing", "TypeHumanoid", "SubtypeAquatic"]));
    });

    it("resolves subtype-only keys", async () => {
        const typePack = { getDocuments: async () => [] };
        const subPack = {
            getDocuments: async () => [{ system: { key: "evil" }, uuid: "SubEvil" }]
        };
        globalThis.game = {
            packs: {
                get: (id) => {
                    if (id === "thirdera.thirdera_creature_types") return typePack;
                    if (id === "thirdera.thirdera_subtypes") return subPack;
                    return undefined;
                }
            }
        };
        const spell = {
            targetCreatureTypeKeys: [],
            targetCreatureSubtypeKeys: ["evil"],
            targetCreatureTypeUuids: []
        };
        await expect(resolveSpellTargetTypeUuidsFromPacks(spell)).resolves.toEqual(["SubEvil"]);
    });
});
