import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
    TOKEN_DIMENSION_FROM_SIZE_HOOK_NAMES,
    handleActorPreCreateForTokenFootprint,
    handleActorPreUpdateForTokenFootprint,
    handleLinkedTokensAfterActorSizeChange,
    handleTokenPreCreateForFootprint,
    registerTokenDimensionHooks
} from "../../../module/logic/token-dimensions-from-size-hooks.mjs";

function pathGet(obj, path) {
    return path.split(".").reduce((o, key) => (o == null ? undefined : o[key]), obj);
}

function mergeInplace(target, source) {
    for (const [k, v] of Object.entries(source)) {
        if (v && typeof v === "object" && !Array.isArray(v)) {
            target[k] = { ...(target[k] ?? {}), ...v };
        } else {
            target[k] = v;
        }
    }
    return target;
}

function makeDeps(overrides = {}) {
    return {
        getProperty: pathGet,
        mergeObject: (target, source, options) => {
            if (options?.inplace) mergeInplace(target, source);
            return target;
        },
        getGame: () => ({ user: { isGM: true }, scenes: [], actors: { get: () => null } }),
        ...overrides
    };
}

describe("handleActorPreCreateForTokenFootprint", () => {
    it("merges prototype and calls updateSource for Gargantuan when prototype is 1×1", () => {
        const data = { system: { details: { size: "Gargantuan" } }, prototypeToken: {} };
        const updateSource = vi.fn();
        const document = {
            system: { details: { size: "Gargantuan" } },
            prototypeToken: { width: 1, height: 1 },
            updateSource
        };
        handleActorPreCreateForTokenFootprint(document, data, makeDeps());
        expect(data.prototypeToken.width).toBe(4);
        expect(data.prototypeToken.height).toBe(4);
        expect(updateSource).toHaveBeenCalledWith({ prototypeToken: { width: 4, height: 4 } });
    });

    it("does nothing when footprint already matches size (Medium 1×1)", () => {
        const data = { system: { details: { size: "Medium" } } };
        const updateSource = vi.fn();
        const document = {
            system: { details: { size: "Medium" } },
            prototypeToken: { width: 1, height: 1 },
            updateSource
        };
        handleActorPreCreateForTokenFootprint(document, data, makeDeps());
        expect(updateSource).not.toHaveBeenCalled();
    });
});

describe("handleActorPreUpdateForTokenFootprint", () => {
    it("merges prototype dimensions when size changes and prototype matched old auto footprint", () => {
        const changes = { system: { details: { size: "Large" } } };
        const document = {
            system: { details: { size: "Medium" } },
            prototypeToken: { width: 1, height: 1 }
        };
        handleActorPreUpdateForTokenFootprint(document, changes, makeDeps());
        expect(changes.prototypeToken).toEqual({ width: 2, height: 2 });
    });

    it("skips when same update sets prototype width", () => {
        const changes = {
            system: { details: { size: "Large" } },
            prototypeToken: { width: 3 }
        };
        const document = {
            system: { details: { size: "Medium" } },
            prototypeToken: { width: 1, height: 1 }
        };
        handleActorPreUpdateForTokenFootprint(document, changes, makeDeps());
        expect(changes.prototypeToken.width).toBe(3);
    });
});

describe("handleTokenPreCreateForFootprint", () => {
    it("uses document.actor size, mergeObject + updateSource for non-1×1 footprint", () => {
        const data = { width: 1, height: 1, actorId: "a1" };
        const updateSource = vi.fn();
        const document = {
            width: 1,
            height: 1,
            actorId: "a1",
            actor: { system: { details: { size: "Huge" } } },
            updateSource
        };
        const deps = makeDeps({
            getGame: () => ({
                user: { isGM: true },
                scenes: [],
                actors: { get: () => null }
            })
        });
        handleTokenPreCreateForFootprint(document, data, deps);
        expect(data.width).toBe(3);
        expect(data.height).toBe(3);
        expect(updateSource).toHaveBeenCalledWith({ width: 3, height: 3 });
    });

    it("resolves size from game.actors when document.actor is missing", () => {
        const data = { width: 1, height: 1, actorId: "a1" };
        const updateSource = vi.fn();
        const document = {
            width: 1,
            height: 1,
            actorId: "a1",
            actor: null,
            updateSource
        };
        const actor = { system: { details: { size: "Large" } } };
        const deps = makeDeps({
            getGame: () => ({
                user: { isGM: true },
                scenes: [],
                actors: { get: (id) => (id === "a1" ? actor : null) }
            })
        });
        handleTokenPreCreateForFootprint(document, data, deps);
        expect(data.width).toBe(2);
        expect(data.height).toBe(2);
        expect(updateSource).toHaveBeenCalledWith({ width: 2, height: 2 });
    });
});

describe("handleLinkedTokensAfterActorSizeChange", () => {
    it("batch-updates linked tokens when GM and diff includes size", async () => {
        const updateEmbeddedDocuments = vi.fn().mockResolvedValue(undefined);
        const token = {
            id: "t1",
            actorId: "act1",
            actorLink: true,
            width: 1,
            height: 1
        };
        const scene = { tokens: [token], updateEmbeddedDocuments };
        const deps = makeDeps({
            getGame: () => ({
                user: { isGM: true },
                scenes: [scene],
                actors: { get: () => null }
            })
        });
        const document = {
            id: "act1",
            system: { details: { size: "Gargantuan" } }
        };
        await handleLinkedTokensAfterActorSizeChange(document, { system: { details: { size: "Gargantuan" } } }, deps);
        expect(updateEmbeddedDocuments).toHaveBeenCalledWith("Token", [
            { _id: "t1", width: 4, height: 4 }
        ]);
    });

    it("no-op when user is not GM", async () => {
        const updateEmbeddedDocuments = vi.fn();
        const deps = makeDeps({
            getGame: () => ({
                user: { isGM: false },
                scenes: [{ tokens: [], updateEmbeddedDocuments }],
                actors: { get: () => null }
            })
        });
        await handleLinkedTokensAfterActorSizeChange(
            { id: "a", system: { details: { size: "Large" } } },
            { system: { details: { size: "Large" } } },
            deps
        );
        expect(updateEmbeddedDocuments).not.toHaveBeenCalled();
    });
});

describe("registerTokenDimensionHooks", () => {
    it("registers all expected hook names once each", () => {
        const on = vi.fn();
        const hooks = { on };
        registerTokenDimensionHooks(hooks, makeDeps());
        const names = on.mock.calls.map((c) => c[0]).sort();
        expect(names).toEqual([...TOKEN_DIMENSION_FROM_SIZE_HOOK_NAMES].sort());
        expect(on).toHaveBeenCalledTimes(TOKEN_DIMENSION_FROM_SIZE_HOOK_NAMES.length);
    });
});

describe("thirdera entrypoint", () => {
    it("imports and calls registerTokenDimensionHooks during init", () => {
        const root = fileURLToPath(new URL("../../../thirdera.mjs", import.meta.url));
        const src = readFileSync(root, "utf8");
        expect(src).toMatch(/registerTokenDimensionHooks/);
        expect(src).toMatch(/registerTokenDimensionHooks\(\)/);
    });
});
