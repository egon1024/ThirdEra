/**
 * Shared cgsGrants normalization for Item TypeDataModel.migrateData.
 *
 * When an update uses Foundry's force-replacement key `==cgsGrants`, we must NOT also set plain `cgsGrants`
 * (merge-order hazard). Foundry runs TypeDataModel.migrateData on the **update diff** only; if plain `cgsGrants`
 * is injected when the key was absent, a partial update like `{ equipped: "true" }` gains empty `cgsGrants` and
 * wipes stored senses. Only normalize plain `cgsGrants` when that key is present on the migrate payload.
 *
 * @param {object} source - system subtree passed to migrateData
 * @param {{ senses?: boolean }} [options] - `senses: false` for condition items (grants only)
 */
export function migrateDataCgsGrants(source, options = {}) {
    const withSenses = options.senses !== false;
    if (!source || typeof source !== "object") return;

    if ("==cgsGrants" in source) {
        const v = source["==cgsGrants"];
        if (v && typeof v === "object") {
            if (!Array.isArray(v.grants)) v.grants = [];
            if (withSenses && !Array.isArray(v.senses)) v.senses = [];
        }
        return;
    }

    if (!("cgsGrants" in source)) return;

    if (!source.cgsGrants || typeof source.cgsGrants !== "object") {
        source.cgsGrants = withSenses ? { grants: [], senses: [] } : { grants: [] };
    } else {
        if (!Array.isArray(source.cgsGrants.grants)) source.cgsGrants.grants = [];
        if (withSenses && !Array.isArray(source.cgsGrants.senses)) source.cgsGrants.senses = [];
    }
}

/**
 * Normalize `system.cgsGrantOverrides` on item system payloads (same array shape as `cgsGrants`).
 * @param {object} source - system subtree passed to migrateData
 * @param {{ senses?: boolean }} [options] - `senses: false` when overrides should not carry senses (unused today; kept for parity)
 */
export function migrateDataCgsGrantOverrides(source, options = {}) {
    const withSenses = options.senses !== false;
    if (!source || typeof source !== "object") return;

    if ("==cgsGrantOverrides" in source) {
        const v = source["==cgsGrantOverrides"];
        if (v && typeof v === "object") {
            if (!Array.isArray(v.grants)) v.grants = [];
            if (withSenses && !Array.isArray(v.senses)) v.senses = [];
        }
        return;
    }

    if (!("cgsGrantOverrides" in source)) return;

    if (!source.cgsGrantOverrides || typeof source.cgsGrantOverrides !== "object") {
        source.cgsGrantOverrides = withSenses ? { grants: [], senses: [] } : { grants: [] };
    } else {
        if (!Array.isArray(source.cgsGrantOverrides.grants)) source.cgsGrantOverrides.grants = [];
        if (withSenses && !Array.isArray(source.cgsGrantOverrides.senses)) source.cgsGrantOverrides.senses = [];
    }
}
