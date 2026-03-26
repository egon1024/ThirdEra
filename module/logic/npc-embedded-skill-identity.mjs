/**
 * NPC embedded skill identity for duplicate detection.
 * Most skills use `system.key` only (one row per key). `profession` is special: multiple rows share
 * `key: profession` with different display names (e.g. Profession (miner) vs (sailor)).
 */

/** @type {ReadonlySet<string>} */
export const NPC_SKILL_KEYS_ALLOWING_SAME_KEY_DIFFERENT_NAME = new Set(["profession"]);

/**
 * Stable identity string for an embedded skill row (Item-like: name + type + system.key).
 * @param {{ name?: string, type?: string, system?: { key?: string } }} item
 * @returns {string}
 */
export function npcEmbeddedSkillIdentity(item) {
    if (!item || item.type !== "skill") return "";
    const key = String(item.system?.key ?? "").trim().toLowerCase();
    const name = String(item.name ?? "").trim().toLowerCase();
    if (key && NPC_SKILL_KEYS_ALLOWING_SAME_KEY_DIFFERENT_NAME.has(key)) {
        return `${key}\0${name}`;
    }
    if (key) return key;
    return `__noname__\0${name}`;
}

/**
 * @param {Iterable<{ type?: string, system?: { key?: string }, name?: string }>} items
 * @returns {Set<string>}
 */
export function npcEmbeddedSkillIdentitySet(items) {
    const set = new Set();
    for (const i of items) {
        if (i?.type !== "skill") continue;
        const id = npcEmbeddedSkillIdentity(i);
        if (id) set.add(id);
    }
    return set;
}

/**
 * One row per {@link npcEmbeddedSkillIdentity}; when tied, keep lower `sort` then stable order.
 * @param {Array<object>} skillItems — embedded skill item documents or plain objects
 * @returns {object[]}
 */
export function dedupeNpcEmbeddedSkillItemsForDisplay(skillItems) {
    if (!skillItems?.length) return skillItems ?? [];
    const byId = new Map();
    for (const s of skillItems) {
        const id = npcEmbeddedSkillIdentity(s);
        if (!id) continue;
        const prev = byId.get(id);
        if (!prev) {
            byId.set(id, s);
            continue;
        }
        const sortP = prev.sort ?? 1e9;
        const sortS = s.sort ?? 1e9;
        if (sortS < sortP) byId.set(id, s);
        else if (sortS === sortP) {
            const idP = prev.id ?? "";
            const idS = s.id ?? "";
            if (idS && idP && idS < idP) byId.set(id, s);
        }
    }
    return [...byId.values()];
}

/**
 * Drop incoming skill embeds that duplicate an identity already on the actor (or earlier in the same batch).
 * @param {Iterable<{ type?: string, system?: { key?: string }, name?: string }>} existingItems — typically actor.items
 * @param {object[]} itemDataArray — payloads for createEmbeddedDocuments("Item", …)
 * @returns {object[]}
 */
export function filterNpcSkillItemDataForCreate(existingItems, itemDataArray) {
    if (!Array.isArray(itemDataArray) || itemDataArray.length === 0) return itemDataArray;
    const seen = npcEmbeddedSkillIdentitySet(existingItems);
    const out = [];
    for (const data of itemDataArray) {
        if (!data || data.type !== "skill") {
            out.push(data);
            continue;
        }
        const id = npcEmbeddedSkillIdentity(data);
        if (!id) {
            out.push(data);
            continue;
        }
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(data);
    }
    return out;
}

/**
 * @param {Iterable<{ type?: string, system?: { key?: string }, name?: string }>} existingItems
 * @param {{ type?: string, system?: { key?: string }, name?: string }} skillLike
 * @returns {boolean}
 */
export function npcActorWouldDuplicateSkillEmbed(existingItems, skillLike) {
    if (!skillLike || skillLike.type !== "skill") return false;
    const id = npcEmbeddedSkillIdentity(skillLike);
    if (!id) return false;
    return npcEmbeddedSkillIdentitySet(existingItems).has(id);
}
