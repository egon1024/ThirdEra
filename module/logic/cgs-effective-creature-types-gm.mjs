/**
 * GM / macro helpers for effective creature types (CGS post-5f-follow).
 * Core union logic stays in cgs-effective-creature-types.mjs.
 */

import { getEffectiveCreatureTypes } from "./cgs-effective-creature-types.mjs";

/** Name list for registration tests (@see extract-hook-handlers-for-unit-tests). */
export const CGS_EFFECTIVE_CREATURE_TYPES_GM_HOOK_NAMES = Object.freeze(["getActorContextOptions"]);

/**
 * @typedef {object} EffectiveCreatureTypesGmDeps
 * @property {() => boolean} isGm
 * @property {(uuid: string) => unknown | null} fromUuidSync
 * @property {(key: string, data?: object) => string} localize
 * @property {(message: string) => void} notifyInfo
 */

/** @returns {EffectiveCreatureTypesGmDeps} */
export function createDefaultEffectiveCreatureTypesGmDeps() {
    return {
        isGm: () => globalThis.game?.user?.isGM === true,
        fromUuidSync: (uuid) => {
            try {
                return typeof globalThis.foundry?.utils?.fromUuidSync === "function"
                    ? globalThis.foundry.utils.fromUuidSync(uuid)
                    : null;
            } catch {
                return null;
            }
        },
        localize: (key, data) => {
            const i18n = globalThis.game?.i18n;
            if (!i18n?.localize) return key;
            if (
                data &&
                typeof data === "object" &&
                Object.keys(data).length > 0 &&
                typeof i18n.format === "function"
            ) {
                return i18n.format(key, data);
            }
            return i18n.localize(key);
        },
        notifyInfo: (message) => {
            if (typeof globalThis.ui?.notifications?.info === "function") {
                globalThis.ui.notifications.info(message, { localize: false });
            }
        }
    };
}

/**
 * Human-readable summary: effective type/subtype UUID lists resolved to names when possible.
 *
 * @param {Parameters<typeof getEffectiveCreatureTypes>[0]} systemData
 * @param {Pick<EffectiveCreatureTypesGmDeps, "fromUuidSync" | "localize">} deps
 * @returns {string}
 */
export function buildEffectiveCreatureTypesDisplayText(systemData, deps) {
    const { typeUuids, subtypeUuids } = getEffectiveCreatureTypes(systemData);

    const namesFor = (uuids) =>
        uuids.length === 0
            ? deps.localize("THIRDERA.CGS.EffectiveTypesEmptyList")
            : uuids
                  .map((u) => {
                      const doc = deps.fromUuidSync(u);
                      const label = doc && typeof doc === "object" && "name" in doc ? String(doc.name) : "";
                      return label || u;
                  })
                  .join(", ");

    const typesLine = `${deps.localize("THIRDERA.CGS.EffectiveTypesTypesLabel")}: ${namesFor(typeUuids)}`;
    const subLine = `${deps.localize("THIRDERA.CGS.EffectiveTypesSubtypesLabel")}: ${namesFor(subtypeUuids)}`;
    return `${typesLine}\n${subLine}`;
}

/**
 * @param {{ name?: string, system?: object } | null | undefined} actor
 * @param {EffectiveCreatureTypesGmDeps} deps
 */
export function notifyEffectiveCreatureTypesForActor(actor, deps) {
    if (!actor?.system) {
        deps.notifyInfo(deps.localize("THIRDERA.CGS.EffectiveTypesNoActor"));
        return;
    }
    const title = deps.localize("THIRDERA.CGS.EffectiveTypesTitle", { name: actor.name ?? "—" });
    const body = buildEffectiveCreatureTypesDisplayText(actor.system, deps);
    deps.notifyInfo(`${title}\n${body}`);
}

/**
 * Show effective creature types for all currently selected (controlled) canvas tokens.
 * Designed for GM macro use: `game.thirdera.effectiveCreatureTypes.notifyForSelectedTokens()`
 *
 * @param {EffectiveCreatureTypesGmDeps} deps
 * @param {{ getControlledTokens?: () => Array<{ actor?: object }> }} [canvasDeps]
 */
export function notifyEffectiveCreatureTypesForSelectedTokens(
    deps,
    canvasDeps = { getControlledTokens: () => globalThis.canvas?.tokens?.controlled ?? [] }
) {
    if (!deps.isGm()) return;
    const tokens = canvasDeps.getControlledTokens();
    if (!tokens || tokens.length === 0) {
        deps.notifyInfo(deps.localize("THIRDERA.CGS.EffectiveTypesNoTokensSelected"));
        return;
    }
    for (const token of tokens) {
        const actor = token?.actor;
        if (actor && (actor.type === "character" || actor.type === "npc")) {
            notifyEffectiveCreatureTypesForActor(actor, deps);
        }
    }
}

/**
 * @param {(name: string, fn: Function) => void} hooksOn - e.g. Hooks.on
 * @param {EffectiveCreatureTypesGmDeps} [deps]
 */
export function registerCgsEffectiveCreatureTypesGmHooks(hooksOn, deps = createDefaultEffectiveCreatureTypesGmDeps()) {
    hooksOn("getActorContextOptions", (app, items) => {
        if (!deps.isGm()) return;

        items.push({
            name: deps.localize("THIRDERA.CGS.EffectiveCreatureTypesContext"),
            icon: '<i class="fa-solid fa-dna"></i>',
            condition: (li) => {
                const id = li?.dataset?.entryId;
                if (!id || typeof app?.collection?.get !== "function") return false;
                const actor = app.collection.get(id);
                return Boolean(actor && (actor.type === "character" || actor.type === "npc"));
            },
            callback: (li) => {
                const actor = app.collection.get(li?.dataset?.entryId);
                notifyEffectiveCreatureTypesForActor(actor, deps);
            }
        });
    });
}
