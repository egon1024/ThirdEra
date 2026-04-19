/**
 * Preserve `system.cgsGrantOverrides` / `system.cgsTemplateUuid` when world templates push `==system` or full
 * `system` replacements onto actor-embedded items (feat, creature feature, race, gear).
 */

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function cloneForActorItemSync(value) {
    if (value === undefined) return undefined;
    const dup = globalThis.foundry?.utils?.duplicate;
    if (typeof dup === "function") {
        try {
            return dup(value);
        } catch {
            /* fall through */
        }
    }
    if (typeof structuredClone === "function") {
        try {
            return structuredClone(value);
        } catch {
            /* ignore */
        }
    }
    return value && typeof value === "object" ? { .../** @type {object} */ (value) } : value;
}

/**
 * @param {unknown} item
 * @returns {{ cgsGrantOverrides?: unknown, cgsTemplateUuid?: string }}
 */
export function snapshotCgsTemplateOverrideFieldsFromItem(item) {
    const sys = item?.system;
    if (!sys || typeof sys !== "object") return {};
    /** @type {{ cgsGrantOverrides?: unknown, cgsTemplateUuid?: string }} */
    const snap = {};
    if (Object.prototype.hasOwnProperty.call(sys, "cgsGrantOverrides")) {
        snap.cgsGrantOverrides = cloneForActorItemSync(sys.cgsGrantOverrides);
    }
    if (Object.prototype.hasOwnProperty.call(sys, "cgsTemplateUuid")) {
        const t = sys.cgsTemplateUuid;
        snap.cgsTemplateUuid = typeof t === "string" ? t : "";
    }
    return snap;
}

/**
 * @param {{ cgsGrantOverrides?: unknown, cgsTemplateUuid?: string }} snap
 * @returns {Record<string, unknown>}
 */
export function buildSystemUpdatePatchFromCgsOverrideSnapshot(snap) {
    if (!snap || typeof snap !== "object") return {};
    /** @type {Record<string, unknown>} */
    const out = {};
    if ("cgsGrantOverrides" in snap) {
        out.cgsGrantOverrides = cloneForActorItemSync(snap.cgsGrantOverrides);
    }
    if ("cgsTemplateUuid" in snap) {
        out.cgsTemplateUuid = typeof snap.cgsTemplateUuid === "string" ? snap.cgsTemplateUuid : "";
    }
    return out;
}
