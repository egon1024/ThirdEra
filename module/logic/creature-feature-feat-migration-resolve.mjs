import path from "path";

/**
 * Resolve `packs/monsters/*.json` path for one manifest row.
 * Optional {@link CreatureFeatureFeatMigrationManifestRow.monsterPackBasename} disambiguates when
 * multiple NPC JSON files incorrectly share the same `system.key`.
 *
 * @typedef {object} CreatureFeatureFeatMigrationManifestRow
 * @property {string} monsterKey - NPC `system.key`
 * @property {string} oldFeatKey
 * @property {string} newCreatureFeatureKey
 * @property {string} [monsterPackBasename] - e.g. `"monster-ape-dire.json"` (basename only; must stay under `monstersDir`)
 * @property {string} [note]
 *
 * @param {CreatureFeatureFeatMigrationManifestRow} row
 * @param {Map<string, string>} monsterPathByKey - `system.key` → absolute path (last file wins on duplicate keys)
 * @param {string} monstersDir - absolute path to `packs/monsters`
 * @returns {{ ok: true, fp: string } | { ok: false, message: string }}
 */
export function resolveMonsterPackPathForMigration(row, monsterPathByKey, monstersDir) {
    const monsterKey = typeof row.monsterKey === "string" ? row.monsterKey.trim() : "";
    if (!monsterKey) {
        return { ok: false, message: "missing monsterKey" };
    }

    const rawBase = row.monsterPackBasename;
    if (typeof rawBase === "string" && rawBase.trim()) {
        const base = path.basename(rawBase.trim());
        if (base !== rawBase.trim()) {
            return { ok: false, message: `monsterPackBasename must be a basename, got ${rawBase}` };
        }
        if (!base.endsWith(".json")) {
            return { ok: false, message: `monsterPackBasename must end with .json, got ${base}` };
        }
        const fp = path.join(monstersDir, base);
        const resolvedDir = path.resolve(monstersDir);
        const resolvedFp = path.resolve(fp);
        if (!resolvedFp.startsWith(resolvedDir + path.sep) && resolvedFp !== resolvedDir) {
            return { ok: false, message: `resolved path escapes monsters dir: ${base}` };
        }
        return { ok: true, fp };
    }

    const fp = monsterPathByKey.get(monsterKey);
    if (!fp) {
        return { ok: false, message: `no monster JSON for system.key=${monsterKey}` };
    }
    return { ok: true, fp };
}
