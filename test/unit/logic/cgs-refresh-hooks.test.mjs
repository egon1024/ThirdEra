import { describe, expect, it, vi } from "vitest";
import {
    CGS_CAPABILITY_REFRESH_HOOK_NAMES,
    actorUpdateTouchesCgsStoredFields,
    collectActorsReferencingCompendiumItemUuid,
    collectActorsWithEmbeddedItemId,
    gatherActorsForCgsScan,
    getActorEmbeddedItemsArray,
    handleUpdateActorForCgs,
    handleUpdateCompendiumForCgs,
    refreshCapabilityGrantDependentsFromItem,
    refreshCapabilityGrantsForActor,
    registerCgsCapabilityRefreshHooks,
    resolveParentActorForItem
} from "../../../module/logic/cgs-refresh-hooks.mjs";

function makeDeps(overrides = {}) {
    return {
        getGame: () => ({ actors: [], system: { id: "thirdera" } }),
        getFoundry: () => ({
            applications: { instances: new Map() },
            utils: { flattenObject: (o) => (o && typeof o === "object" ? o : {}) }
        }),
        getCanvas: () => ({ tokens: { placeables: [] } }),
        getSystemId: () => "thirdera",
        ...overrides
    };
}

describe("actorUpdateTouchesCgsStoredFields", () => {
    it("returns true for cgsGrants and stat block sense paths", () => {
        expect(actorUpdateTouchesCgsStoredFields({ "system.cgsGrants.senses": [] })).toBe(true);
        expect(actorUpdateTouchesCgsStoredFields({ "system.statBlock.senses": [] })).toBe(true);
        expect(actorUpdateTouchesCgsStoredFields({ "system.attributes.hp.value": 5 })).toBe(false);
    });
});

describe("getActorEmbeddedItemsArray", () => {
    it("reads items from collection-like .contents", () => {
        const i1 = { id: "a", sourceId: "Comp.x.Item.y" };
        const actor = { items: { contents: [i1] } };
        expect(getActorEmbeddedItemsArray(actor)).toEqual([i1]);
    });
});

describe("collectActorsReferencingCompendiumItemUuid", () => {
    it("finds actors with matching sourceId", () => {
        const uuid = "Compendium.foo.Item.bar";
        const a1 = {
            id: "1",
            items: { contents: [{ sourceId: uuid }] }
        };
        const a2 = { id: "2", items: { contents: [{ sourceId: "other" }] } };
        expect(collectActorsReferencingCompendiumItemUuid(uuid, [a1, a2]).map((a) => a.id)).toEqual(["1"]);
    });
});

describe("collectActorsWithEmbeddedItemId", () => {
    it("uses items.get when present", () => {
        const a = { id: "x", items: { get: (id) => (id === "it" ? {} : undefined) } };
        expect(collectActorsWithEmbeddedItemId("it", [a]).map((x) => x.id)).toEqual(["x"]);
        expect(collectActorsWithEmbeddedItemId("missing", [a])).toEqual([]);
    });
});

describe("gatherActorsForCgsScan", () => {
    it("merges game actors and token actors without duplicates", () => {
        const dup = { id: "same" };
        const deps = makeDeps({
            getGame: () => ({
                actors: { contents: [dup] },
                system: { id: "thirdera" }
            }),
            getCanvas: () => ({
                scene: { tokens: [{ actor: dup }, { actor: { id: "other" } }] }
            })
        });
        const list = gatherActorsForCgsScan(deps);
        expect(list.map((a) => a.id).sort()).toEqual(["other", "same"]);
    });
});

describe("resolveParentActorForItem", () => {
    it("returns parent when set", async () => {
        const act = { id: "p" };
        const item = { parent: act };
        expect(await resolveParentActorForItem(item, makeDeps())).toBe(act);
    });

    it("parses Actor uuid segment", async () => {
        const act = { id: "a1" };
        const deps = makeDeps({
            getGame: () => ({
                actors: { get: (id) => (id === "a1" ? act : null) },
                system: { id: "thirdera" }
            })
        });
        const item = { uuid: "Actor.a1.Item.x" };
        expect(await resolveParentActorForItem(item, deps)).toBe(act);
    });
});

describe("refreshCapabilityGrantsForActor", () => {
    it("calls prepareData, renders matching sheets, refreshes tokens", async () => {
        const prepareData = vi.fn().mockResolvedValue(undefined);
        const actor = { id: "ac1", prepareData };
        const render = vi.fn().mockResolvedValue(undefined);
        const token = { actor: { id: "ac1" }, refresh: vi.fn() };
        const instances = new Map([
            [
                "k",
                {
                    document: { documentName: "Actor", id: "ac1" },
                    actor: { id: "ac1" },
                    rendered: true,
                    render
                }
            ]
        ]);
        const deps = makeDeps({
            getFoundry: () => ({
                applications: { instances },
                utils: { flattenObject: (o) => o ?? {} }
            }),
            getCanvas: () => ({ tokens: { placeables: [token] } })
        });
        await refreshCapabilityGrantsForActor(actor, deps);
        expect(prepareData).toHaveBeenCalledOnce();
        expect(render).toHaveBeenCalledWith();
        expect(token.refresh).toHaveBeenCalledOnce();
    });

    it("skips prepareData when skipPrepareData", async () => {
        const prepareData = vi.fn();
        const actor = { id: "ac1", prepareData };
        const deps = makeDeps();
        await refreshCapabilityGrantsForActor(actor, deps, { skipPrepareData: true });
        expect(prepareData).not.toHaveBeenCalled();
    });
});

describe("handleUpdateActorForCgs", () => {
    it("no-ops when changes omit CGS fields", async () => {
        const render = vi.fn();
        const deps = makeDeps({
            getFoundry: () => ({
                applications: {
                    instances: new Map([
                        [
                            "k",
                            {
                                document: { documentName: "Actor" },
                                actor: { id: "a" },
                                rendered: true,
                                render
                            }
                        ]
                    ])
                },
                utils: {
                    flattenObject: (c) => c ?? {}
                }
            })
        });
        await handleUpdateActorForCgs({ id: "a" }, { name: "x" }, deps);
        expect(render).not.toHaveBeenCalled();
    });

    it("re-renders when cgsGrants changes", async () => {
        const render = vi.fn().mockResolvedValue(undefined);
        const deps = makeDeps({
            getFoundry: () => ({
                applications: {
                    instances: new Map([
                        [
                            "k",
                            {
                                document: { documentName: "Actor" },
                                actor: { id: "a" },
                                rendered: true,
                                render
                            }
                        ]
                    ])
                },
                utils: {
                    flattenObject: () => ({ "system.cgsGrants.senses": [] })
                }
            })
        });
        const doc = { id: "a", prepareData: vi.fn() };
        await handleUpdateActorForCgs(doc, { system: { cgsGrants: { senses: [] } } }, deps);
        expect(render).toHaveBeenCalled();
        expect(doc.prepareData).not.toHaveBeenCalled();
    });
});

describe("refreshCapabilityGrantDependentsFromItem", () => {
    it("refreshes parent actor when embedded item has parent", async () => {
        const prepareData = vi.fn().mockResolvedValue(undefined);
        const parent = { id: "p1", prepareData };
        const item = { id: "i1", parent };
        await refreshCapabilityGrantDependentsFromItem(item, makeDeps());
        expect(prepareData).toHaveBeenCalled();
    });

    it("refreshes actors holding embedded copy when no parent", async () => {
        const prepareData = vi.fn().mockResolvedValue(undefined);
        const actor = {
            id: "a1",
            prepareData,
            items: { get: (id) => (id === "wid" ? {} : undefined) }
        };
        const deps = makeDeps({
            getGame: () => ({ actors: { contents: [actor] }, system: { id: "thirdera" } })
        });
        await refreshCapabilityGrantDependentsFromItem({ id: "wid", parent: null }, deps);
        expect(prepareData).toHaveBeenCalled();
    });
});

describe("handleUpdateCompendiumForCgs", () => {
    it("refreshes actors linked by sourceId", async () => {
        const compUuid = "Compendium.pack.Item.abc";
        const prepareData = vi.fn().mockResolvedValue(undefined);
        const actor = {
            id: "act1",
            prepareData,
            items: { contents: [{ sourceId: compUuid }] }
        };
        const deps = makeDeps({
            getGame: () => ({ actors: { contents: [actor] }, system: { id: "thirdera" } })
        });
        const doc = { documentName: "Item", uuid: compUuid };
        await handleUpdateCompendiumForCgs({}, [doc], {}, "u1", deps);
        expect(prepareData).toHaveBeenCalled();
    });

    it("ignores non-Item documents", async () => {
        const prepareData = vi.fn();
        const actor = { id: "a", prepareData, items: { contents: [] } };
        const deps = makeDeps({
            getGame: () => ({ actors: { contents: [actor] }, system: { id: "thirdera" } })
        });
        await handleUpdateCompendiumForCgs({}, [{ documentName: "Actor", uuid: "x" }], {}, "u", deps);
        expect(prepareData).not.toHaveBeenCalled();
    });
});

describe("registerCgsCapabilityRefreshHooks", () => {
    it("registers updateCompendium and updateActor", () => {
        const on = vi.fn();
        registerCgsCapabilityRefreshHooks({ on }, makeDeps());
        const names = on.mock.calls.map((c) => c[0]);
        expect(names).toEqual([...CGS_CAPABILITY_REFRESH_HOOK_NAMES]);
    });
});

describe("CGS_CAPABILITY_REFRESH_HOOK_NAMES", () => {
    it("is frozen and lists expected hooks", () => {
        expect(Object.isFrozen(CGS_CAPABILITY_REFRESH_HOOK_NAMES)).toBe(true);
        expect(CGS_CAPABILITY_REFRESH_HOOK_NAMES).toContain("updateCompendium");
        expect(CGS_CAPABILITY_REFRESH_HOOK_NAMES).toContain("updateActor");
    });
});
