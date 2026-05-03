/**
 * UI-oriented description of which Item UUID drives CGS template resolution for an owned item.
 * @see module/logic/cgs-grant-template-merge.mjs
 */

import {
    getOwnedItemCgsSourceIdUuidCandidate,
    getOwnedItemCgsTemplateUuidCandidate,
    readCgsGrantsShapeFromTemplateItem
} from "./cgs-grant-template-merge.mjs";

/**
 * Whether an Item document is a suitable CGS template row in the picker (non-empty grants or senses).
 * @param {unknown} doc
 * @returns {boolean}
 */
export function documentEligibleAsCgsTemplatePicker(doc) {
    const s = readCgsGrantsShapeFromTemplateItem(doc);
    return Boolean(s && (s.grants.length > 0 || s.senses.length > 0));
}

/**
 * @typedef {{
 *   effectiveUuid: string,
 *   explicitUuid: string,
 *   sourceIdUuid: string,
 *   mode: "explicit" | "sourceId" | "none",
 *   conflict: boolean,
 *   isResolvable: boolean
 * }} CgsTemplateLinkDescription
 */

/**
 * @param {unknown} item
 * @param {{ fromUuidSync?: (uuid: string) => unknown }} [deps]
 * @returns {CgsTemplateLinkDescription}
 */
export function describeCgsTemplateLink(item, deps = {}) {
    const explicitUuid =
        item && typeof item === "object"
            ? (() => {
                  const u = /** @type {{ system?: { cgsTemplateUuid?: string } }} */ (item).system?.cgsTemplateUuid;
                  return typeof u === "string" ? u.trim() : "";
              })()
            : "";
    const sourceIdUuid = getOwnedItemCgsSourceIdUuidCandidate(item);
    const effectiveUuid = getOwnedItemCgsTemplateUuidCandidate(item);

    /** @type {"explicit" | "sourceId" | "none"} */
    let mode = "none";
    if (explicitUuid) mode = "explicit";
    else if (sourceIdUuid) mode = "sourceId";

    const conflict = Boolean(explicitUuid && sourceIdUuid && explicitUuid !== sourceIdUuid);

    const fromUuidSync =
        typeof deps.fromUuidSync === "function"
            ? deps.fromUuidSync
            : typeof globalThis.foundry?.utils?.fromUuidSync === "function"
              ? (u) => globalThis.foundry.utils.fromUuidSync(u)
              : () => null;

    let isResolvable = false;
    if (effectiveUuid) {
        try {
            const doc = fromUuidSync(effectiveUuid);
            isResolvable = readCgsGrantsShapeFromTemplateItem(doc) != null;
        } catch {
            isResolvable = false;
        }
    }

    return {
        effectiveUuid,
        explicitUuid,
        sourceIdUuid,
        mode,
        conflict,
        isResolvable
    };
}
