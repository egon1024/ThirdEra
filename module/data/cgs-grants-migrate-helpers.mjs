/**
 * Shared cgsGrants normalization for Item TypeDataModel.migrateData.
 *
 * When an update uses Foundry's force-replacement key `==cgsGrants`, we must NOT also set plain `cgsGrants`:
 * ClientDatabaseBackend runs migrateData on the diff before merge; a spurious empty `cgsGrants` is merged after
 * `==cgsGrants` and wipes senses (SchemaField#_updateDiff iteration order).
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

    if (!source.cgsGrants || typeof source.cgsGrants !== "object") {
        source.cgsGrants = withSenses ? { grants: [], senses: [] } : { grants: [] };
    } else {
        if (!Array.isArray(source.cgsGrants.grants)) source.cgsGrants.grants = [];
        if (withSenses && !Array.isArray(source.cgsGrants.senses)) source.cgsGrants.senses = [];
    }
}
