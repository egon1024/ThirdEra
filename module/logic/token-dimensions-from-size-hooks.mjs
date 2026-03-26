/**
 * Foundry hook wiring + thin handlers for token footprint vs actor size.
 * Handlers accept injected deps so Vitest can mock `game` / `foundry.utils` without Foundry.
 */

import {
    getSizeChangeFromActorUpdateDiff,
    getTokenDimensionsForSize,
    nearlyEqualTokenDimension,
    shouldApplyAutoTokenDimensionsOnCreate,
    shouldApplyAutoTokenDimensionsOnSizeChange
} from "./token-dimensions-from-size.mjs";

/** @typedef {{ getProperty: Function, mergeObject: Function, getGame: () => object|undefined }} TokenDimensionHookDeps */

/**
 * Hook names registered by {@link registerTokenDimensionHooks} (for tests and static checks).
 * @type {readonly string[]}
 */
export const TOKEN_DIMENSION_FROM_SIZE_HOOK_NAMES = Object.freeze([
    "preCreateActor",
    "preUpdateActor",
    "updateActor",
    "preCreateToken"
]);

/**
 * Production deps: Foundry `foundry.utils` + `game` from `globalThis` at call time.
 * @param {object} [env]
 * @returns {TokenDimensionHookDeps}
 */
export function createDefaultTokenDimensionHookDeps(env = globalThis) {
    const { foundry, game } = env;
    return {
        getProperty: (obj, path) => foundry.utils.getProperty(obj, path),
        mergeObject: (target, source, options) => foundry.utils.mergeObject(target, source, options),
        getGame: () => game
    };
}

/**
 * @param {Actor} document
 * @param {object} data
 * @param {TokenDimensionHookDeps} deps
 */
export function handleActorPreCreateForTokenFootprint(document, data, deps) {
    const { getProperty, mergeObject } = deps;
    const size =
        getProperty(data, "system.details.size") ?? document.system?.details?.size ?? "Medium";
    const pw = getProperty(data, "prototypeToken.width") ?? document.prototypeToken.width;
    const ph = getProperty(data, "prototypeToken.height") ?? document.prototypeToken.height;
    if (
        !shouldApplyAutoTokenDimensionsOnCreate({
            size,
            prototypeWidth: pw,
            prototypeHeight: ph
        })
    ) {
        return;
    }
    const { width, height } = getTokenDimensionsForSize(size);
    mergeObject(data, { prototypeToken: { width, height } }, { inplace: true });
    document.updateSource({ prototypeToken: { width, height } });
}

/**
 * @param {Actor} document
 * @param {object} changes
 * @param {TokenDimensionHookDeps} deps
 */
export function handleActorPreUpdateForTokenFootprint(document, changes, deps) {
    const { getProperty, mergeObject } = deps;
    const newSize = getProperty(changes, "system.details.size");
    if (newSize === undefined) return;
    const oldSize = document.system?.details?.size;
    if (typeof newSize !== "string" || newSize === oldSize) return;

    const ptChange = changes.prototypeToken;
    if (ptChange && ("width" in ptChange || "height" in ptChange)) return;

    const pw = document.prototypeToken.width;
    const ph = document.prototypeToken.height;
    if (
        !shouldApplyAutoTokenDimensionsOnSizeChange({
            oldSize,
            newSize,
            prototypeWidth: pw,
            prototypeHeight: ph
        })
    ) {
        return;
    }
    const { width, height } = getTokenDimensionsForSize(newSize);
    mergeObject(changes, { prototypeToken: { width, height } }, { inplace: true });
}

/**
 * @param {Actor} document
 * @param {object} changes
 * @param {TokenDimensionHookDeps} deps
 */
export async function handleLinkedTokensAfterActorSizeChange(document, changes, deps) {
    const game = deps.getGame();
    if (!game?.user?.isGM) return;
    if (getSizeChangeFromActorUpdateDiff(changes) === undefined) return;

    const { width, height } = getTokenDimensionsForSize(document.system?.details?.size);
    for (const scene of game.scenes ?? []) {
        const tokenUpdates = [];
        for (const token of scene.tokens ?? []) {
            if (token.actorId !== document.id || !token.actorLink) continue;
            if (nearlyEqualTokenDimension(token.width, width) && nearlyEqualTokenDimension(token.height, height)) {
                continue;
            }
            tokenUpdates.push({ _id: token.id, width, height });
        }
        if (tokenUpdates.length) {
            try {
                await scene.updateEmbeddedDocuments("Token", tokenUpdates);
            } catch (err) {
                console.warn("Third Era | Could not sync linked token dimensions:", err);
            }
        }
    }
}

/**
 * @param {TokenDocument} document
 * @param {object} data
 * @param {TokenDimensionHookDeps} deps
 */
export function handleTokenPreCreateForFootprint(document, data, deps) {
    const { getProperty, mergeObject, getGame } = deps;
    const width = data.width ?? document.width;
    const height = data.height ?? document.height;
    const game = getGame();
    const actorFromData = data.actorId ? game?.actors?.get?.(data.actorId) : null;
    const size =
        document.actor?.system?.details?.size ??
        actorFromData?.system?.details?.size ??
        getProperty(data, "delta.system.details.size") ??
        getProperty(document, "delta.system.details.size") ??
        "Medium";
    if (
        !shouldApplyAutoTokenDimensionsOnCreate({
            size,
            prototypeWidth: width,
            prototypeHeight: height
        })
    ) {
        return;
    }
    const dims = getTokenDimensionsForSize(size);
    mergeObject(data, dims, { inplace: true });
    document.updateSource(dims);
}

/**
 * Register Foundry hooks for token footprint sync. Pass mocks in tests.
 *
 * @param {object} [hooks]      Object with `.on(name, fn)` — defaults to `globalThis.Hooks`
 * @param {TokenDimensionHookDeps|null} [deps]  Defaults to {@link createDefaultTokenDimensionHookDeps}
 */
export function registerTokenDimensionHooks(hooks = globalThis.Hooks, deps = null) {
    const d = deps ?? createDefaultTokenDimensionHookDeps();

    hooks.on("preCreateActor", (document, data, _options, _userId) => {
        handleActorPreCreateForTokenFootprint(document, data, d);
    });
    hooks.on("preUpdateActor", (document, changes, _options, _userId) => {
        handleActorPreUpdateForTokenFootprint(document, changes, d);
    });
    hooks.on("updateActor", async (document, changes, _options, _userId) => {
        await handleLinkedTokensAfterActorSizeChange(document, changes, d);
    });
    hooks.on("preCreateToken", (document, data, _options, _userId) => {
        handleTokenPreCreateForFootprint(document, data, d);
    });
}
