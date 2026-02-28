/**
 * Auto-granted class feats: create feats on an actor when they gain a class level,
 * and record created IDs for level-down and class removal cleanup.
 * Supports unconditional (featUuid) and conditional (featUuids, first-missing) grants.
 * @module logic/auto-granted-feats
 */

import { actorHasFeatByUuid } from "./feat-prerequisites.mjs";

/**
 * Create one feat on the actor from a source feat UUID, with auto-granted flags.
 * @param {Actor} actor
 * @param {string} featUuid
 * @param {Item} classItem
 * @param {number} newClassLevel
 * @returns {Promise<string|null>} Created item id or null
 */
async function createOneAutoGrantedFeat(actor, featUuid, classItem, newClassLevel) {
    try {
        const sourceFeat = await foundry.utils.fromUuid(featUuid);
        if (sourceFeat?.type === "feat") {
            const obj = sourceFeat.toObject();
            delete obj._id;
            obj.flags = {
                ...(obj.flags || {}),
                thirdera: {
                    ...(obj.flags?.thirdera || {}),
                    sourceFeatUuid: featUuid,
                    autoGrantedBy: { classItemId: classItem.id, level: newClassLevel }
                }
            };
            const created = await actor.createEmbeddedDocuments("Item", [obj]);
            if (created?.length) return created[0].id;
        }
    } catch (err) {
        console.warn("Third Era | Auto-granted feat: could not resolve or create feat", featUuid, err);
    }
    return null;
}

/**
 * Create auto-granted feats for a given class and new class level.
 * Reads the class's autoGrantedFeats, filters to entries for newClassLevel. For each entry:
 * - If featUuid is set: unconditional grant (create one copy).
 * - Else if featUuids has entries: conditional grant — create the first feat in the list
 *   that the actor does not already have; if they have all, grant nothing.
 * @param {Actor} actor - The character actor
 * @param {Item} classItem - The class item (e.g. actor.items.get(classItemId))
 * @param {number} newClassLevel - The class level just gained (1-based)
 * @returns {Promise<string[]>} Array of created feat item IDs (empty if none)
 */
export async function createAutoGrantedFeatsForLevel(actor, classItem, newClassLevel) {
    const createdIds = [];
    const entries = classItem?.system?.autoGrantedFeats ?? [];
    const forLevel = entries.filter((e) => Number(e.level) === newClassLevel);

    for (const entry of forLevel) {
        const featUuid = (entry.featUuid ?? "").trim();
        if (featUuid) {
            const id = await createOneAutoGrantedFeat(actor, featUuid, classItem, newClassLevel);
            if (id) createdIds.push(id);
            continue;
        }

        const featUuids = entry.featUuids ?? [];
        const uuids = featUuids.map((u) => String(u).trim()).filter(Boolean);
        if (uuids.length === 0) continue;

        for (const uuid of uuids) {
            if (actorHasFeatByUuid(actor, uuid)) continue;
            const id = await createOneAutoGrantedFeat(actor, uuid, classItem, newClassLevel);
            if (id) createdIds.push(id);
            break;
        }
    }

    return createdIds;
}
