/**
 * Resolve authoring keys on NPC compendium JSON into stored UUID references.
 * Source JSON may include `creatureTypeKey` and `subtypeKeys`; after resolution
 * those authoring keys are removed and `details.creatureTypeUuid` /
 * `details.subtypeUuids` are set.
 *
 * @param {Record<string, unknown>} system - Actor npc system data (mutated)
 * @param {Map<string, string>} typeKeyToUuid - creature type item key → compendium UUID
 * @param {Map<string, string>} subtypeKeyToUuid - subtype item key → compendium UUID
 */
export function resolveMonsterPackNpcKeys(system, typeKeyToUuid, subtypeKeyToUuid) {
    if (!system || typeof system !== "object") return;
    if (!system.details || typeof system.details !== "object") {
        system.details = {};
    }

    const ct = system.creatureTypeKey;
    if (typeof ct === "string" && ct.trim()) {
        const uuid = typeKeyToUuid.get(ct.trim());
        if (uuid) {
            system.details.creatureTypeUuid = uuid;
        }
        delete system.creatureTypeKey;
    }

    const st = system.subtypeKeys;
    if (Array.isArray(st) && st.length > 0) {
        const uuids = st
            .map((k) => subtypeKeyToUuid.get(String(k).trim()))
            .filter((u) => typeof u === "string" && u.length > 0);
        if (uuids.length > 0) {
            system.details.subtypeUuids = uuids;
        }
        delete system.subtypeKeys;
    }
}
