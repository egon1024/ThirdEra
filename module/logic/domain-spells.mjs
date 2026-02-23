/**
 * Domain spells: derive "spells granted by domain" from spell documents' levelsByDomain.
 * Single source of truth is the spell item; domain items do not store a spell list.
 */

import { ClassData } from "../data/item-class.mjs";

/** @type {Map<string, Array<{ level: number, spellName: string, uuid: string }>>} */
let _cacheByDomainKey = null;

const SPELL_PACK_ID = "thirdera.thirdera_spells";

/**
 * Normalize domain key for comparison (trim + lowercase).
 * @param {string} domainKey
 * @returns {string}
 */
function normalizeDomainKey(domainKey) {
    if (domainKey == null || typeof domainKey !== "string") return "";
    return domainKey.trim().toLowerCase();
}

/**
 * From a spell document, collect entries for a given domain key.
 * @param {Item} spellDoc - Spell item (world or compendium)
 * @param {string} normalizedKey
 * @returns {Array<{ level: number, spellName: string, uuid: string }>}
 */
function spellsEntriesForDomain(spellDoc, normalizedKey) {
    const levelsByDomain = spellDoc.system?.levelsByDomain || [];
    const out = [];
    for (const entry of levelsByDomain) {
        const entryKey = normalizeDomainKey(entry?.domainKey);
        if (entryKey !== normalizedKey) continue;
        const level = Math.max(1, Math.min(9, parseInt(entry.level, 10) || 1));
        out.push({
            level,
            spellName: spellDoc.name || "",
            uuid: spellDoc.uuid || ""
        });
    }
    return out;
}

/**
 * Populate the session cache from the spells compendium. Call once when world is ready
 * (e.g. from Hooks.on("ready")) so getSpellsForDomain can run synchronously.
 * Safe to call again to invalidate/refresh.
 */
export async function populateCompendiumCache() {
    _cacheByDomainKey = new Map();
    const pack = game.packs?.get(SPELL_PACK_ID);
    if (!pack) return;
    const docs = await pack.getDocuments();
    for (const doc of docs) {
        if (doc.type !== "spell") continue;
        const levelsByDomain = doc.system?.levelsByDomain || [];
        for (const entry of levelsByDomain) {
            const key = normalizeDomainKey(entry?.domainKey);
            if (!key) continue;
            const level = Math.max(1, Math.min(9, parseInt(entry.level, 10) || 1));
            if (!_cacheByDomainKey.has(key)) _cacheByDomainKey.set(key, []);
            _cacheByDomainKey.get(key).push({
                level,
                spellName: doc.name || "",
                uuid: doc.uuid || ""
            });
        }
    }
}

/**
 * Get all spells granted by a domain (world items + compendium cache).
 * Synchronous: uses game.items and the pre-populated session cache.
 * @param {string} domainKey - Domain system key (e.g. "war", "healing")
 * @returns {Array<{ level: number, spellName: string, uuid: string }>}
 */
export function getSpellsForDomain(domainKey) {
    const key = normalizeDomainKey(domainKey);
    if (!key) return [];
    if (typeof game === "undefined" || !game.items) return [];

    const result = [];

    // World items
    if (game.items) {
        for (const item of game.items) {
            if (item.type !== "spell") continue;
            const entries = spellsEntriesForDomain(item, key);
            for (const e of entries) result.push(e);
        }
    }

    // Compendium cache (populated on ready; may be null if not yet ready)
    if (_cacheByDomainKey) {
        const cached = _cacheByDomainKey.get(key);
        if (cached) {
            for (const e of cached) result.push({ ...e });
        }
    }

    // Dedupe by level+name (same spell in world and compendium: world was added first so prefer world)
    const byKey = new Map();
    for (const e of result) {
        const k = `${e.level}:${(e.spellName || "").toLowerCase().trim()}`;
        if (!byKey.has(k)) byKey.set(k, e);
    }
    const list = [...byKey.values()];
    list.sort((a, b) => a.level - b.level || (a.spellName || "").localeCompare(b.spellName || ""));
    return list;
}

/**
 * Get all domain items from world and all Item compendium packs.
 * @returns {Promise<Array<{ uuid: string, name: string, domainKey: string }>>}
 */
export async function getAllDomains() {
    if (typeof game === "undefined" || !game.items || !game.packs) return [];

    const seen = new Map(); // domainKey (normalized) -> entry (prefer world)

    // World items
    for (const item of game.items) {
        if (item.type !== "domain") continue;
        const domainKey = (item.system?.key || "").trim();
        const name = (item.name || "").trim() || "Unnamed Domain";
        const key = normalizeDomainKey(domainKey) || name.toLowerCase();
        if (!seen.has(key)) {
            seen.set(key, { uuid: item.uuid, name, domainKey: domainKey || name });
        }
    }

    // Item compendium packs
    for (const pack of game.packs.values()) {
        if (pack.documentName !== "Item") continue;
        try {
            const docs = await pack.getDocuments({ type: "domain" });
            for (const doc of docs) {
                if (doc.type !== "domain") continue;
                const domainKey = (doc.system?.key || "").trim();
                const name = (doc.name || "").trim() || "Unnamed Domain";
                const key = normalizeDomainKey(domainKey) || name.toLowerCase();
                if (!seen.has(key)) {
                    seen.set(key, { uuid: doc.uuid, name, domainKey: domainKey || name });
                }
            }
        } catch (err) {
            console.warn(`Third Era | Error loading domains from pack ${pack.collection}:`, err);
        }
    }

    const list = [...seen.values()];
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
}

/**
 * Add domain spell items to an actor for a given class and domain. Only adds spells at levels
 * the character has achieved (has spell slots for). Skips spells the actor already has.
 * Call this when a domain is added to a character (e.g. drop on character sheet or on class item owned by actor).
 * @param {Actor} actor - The actor to add spell items to
 * @param {Item} classItem - The class item (with spellcasting.domains and spellsPerDayTable)
 * @param {string} domainKey - The domain key (e.g. "war", "healing")
 * @returns {Promise<number>} - Number of spell items created
 */
export async function addDomainSpellsToActor(actor, classItem, domainKey) {
    const key = (domainKey || "").trim();
    if (!key || !actor?.items || !classItem) return 0;

    const classLevel = (actor.system?.levelHistory || []).filter(
        e => e.classItemId === classItem.id
    ).length;
    if (classLevel < 1) return 0;

    const table = classItem.system?.spellcasting?.spellsPerDayTable || [];
    const granted = getSpellsForDomain(key);
    const existingSpellNames = new Set(
        actor.items.filter(i => i.type === "spell").map(s => s.name.toLowerCase().trim())
    );
    const docsToAdd = [];
    for (const entry of granted) {
        const spellLevel = entry.level;
        if (spellLevel < 1 || spellLevel > 9) continue;
        const slotsAtLevel = ClassData.getSpellsPerDay(table, classLevel, spellLevel);
        if (slotsAtLevel <= 0) continue;
        if (existingSpellNames.has((entry.spellName || "").toLowerCase().trim())) continue;
        if (!entry.uuid) continue;
        try {
            const spellDoc = await foundry.utils.fromUuid(entry.uuid);
            if (spellDoc && spellDoc.type === "spell") {
                docsToAdd.push(spellDoc);
                existingSpellNames.add((entry.spellName || "").toLowerCase().trim());
            }
        } catch (_) { /* spell from compendium may be unavailable */ }
    }
    if (docsToAdd.length > 0) {
        const created = await actor.addSpells(docsToAdd);
        return created.length;
    }
    return 0;
}
