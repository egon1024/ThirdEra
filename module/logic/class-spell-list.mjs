/**
 * Class spell lists: get all classes and spells available to a given class.
 * Uses spell.levelsByClass for lookup; supports world items and all compendium packs.
 */

/**
 * Get spell list key for a class (for spell level lookup).
 * Mirrors ThirdEraActorSheet._getSpellListKey.
 * @param {Item} classItem - Class item with spellcasting
 * @returns {string}
 */
function getSpellListKey(classItem) {
    const sc = classItem?.system?.spellcasting;
    const key = (sc?.spellListKey || "").trim();
    if (key) return key;
    const name = (classItem?.name || "").toLowerCase();
    if (name === "wizard" || name === "sorcerer") return "sorcererWizard";
    return name;
}

/**
 * Get the spell level for a class from a spell's levelsByClass (only if explicitly listed).
 * @param {object} spellSystem - Spell system data
 * @param {string} spellListKey
 * @returns {number|null} Level 0-9, or null if not in list
 */
function getSpellLevelForClass(spellSystem, spellListKey) {
    if (!spellSystem || typeof spellSystem !== "object") return null;
    const levelsByClass = spellSystem.levelsByClass || [];
    const arr = Array.isArray(levelsByClass) ? levelsByClass : [];
    const keyLower = (spellListKey || "").trim().toLowerCase();
    const entry = arr.find(
        (e) => (e?.classKey || "").trim().toLowerCase() === keyLower
    );
    if (entry == null) return null;
    const level = parseInt(entry.level, 10);
    if (Number.isNaN(level) || level < 0 || level > 9) return null;
    return level;
}

/**
 * Get all character classes from world items and all Item compendium packs.
 * @returns {Promise<Array<{ uuid: string, name: string, spellListKey: string, casterType: string }>>}
 */
export async function getAllClasses() {
    if (typeof game === "undefined" || !game.items || !game.packs) return [];

    const seen = new Map(); // key: "name|spellListKey" -> entry (prefer world)

    // World items
    for (const item of game.items) {
        if (item.type !== "class") continue;
        const spellListKey = getSpellListKey(item);
        const casterType = (item.system?.spellcasting?.casterType || "none").trim() || "none";
        const name = (item.name || "").trim() || "Unnamed Class";
        const key = `${name.toLowerCase()}|${spellListKey}`;
        if (!seen.has(key)) {
            seen.set(key, {
                uuid: item.uuid,
                name,
                spellListKey,
                casterType
            });
        }
    }

    // Item compendium packs
    for (const pack of game.packs.values()) {
        if (pack.documentName !== "Item") continue;
        try {
            const docs = await pack.getDocuments({ type: "class" });
            for (const doc of docs) {
                if (doc.type !== "class") continue;
                const spellListKey = getSpellListKey(doc);
                const casterType = (doc.system?.spellcasting?.casterType || "none").trim() || "none";
                const name = (doc.name || "").trim() || "Unnamed Class";
                const key = `${name.toLowerCase()}|${spellListKey}`;
                if (!seen.has(key)) {
                    seen.set(key, {
                        uuid: doc.uuid,
                        name,
                        spellListKey,
                        casterType
                    });
                }
            }
        } catch (err) {
            console.warn(`Third Era | Error loading classes from pack ${pack.collection}:`, err);
        }
    }

    const list = [...seen.values()];
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
}

/**
 * Get all spells available to a class (spells that explicitly list the class in levelsByClass).
 * Searches world items and all Item compendium packs.
 * @param {string} spellListKey - Class spell list key (e.g. sorcererWizard, cleric)
 * @returns {Promise<Array<{ spell: Item, level: number, schoolKey: string, schoolName: string }>>}
 */
export async function getSpellsForClass(spellListKey) {
    const key = (spellListKey || "").trim();
    if (!key) return [];
    if (typeof game === "undefined" || !game.items || !game.packs) return [];

    const seen = new Map(); // key: "level|name" -> entry (prefer world)

    function addSpell(spellDoc) {
        const sys = spellDoc.system ?? spellDoc.toObject?.()?.system;
        const level = getSpellLevelForClass(sys, key);
        if (level === null) return;
        const name = (spellDoc.name || "").trim();
        const dedupeKey = `${level}|${name.toLowerCase()}`;
        if (seen.has(dedupeKey)) return;
        const s = spellDoc.system ?? spellDoc.toObject?.()?.system ?? {};
        seen.set(dedupeKey, {
            spell: spellDoc,
            level,
            schoolKey: (s.schoolKey || "").trim(),
            schoolName: (s.schoolName || s.schoolKey || "").trim() || (s.schoolKey || "")
        });
    }

    // World items
    for (const item of game.items) {
        if (item.type !== "spell") continue;
        addSpell(item);
    }

    // Item compendium packs
    for (const pack of game.packs.values()) {
        if (pack.documentName !== "Item") continue;
        try {
            const docs = await pack.getDocuments({ type: "spell" });
            for (const doc of docs) {
                if (doc.type !== "spell") continue;
                addSpell(doc);
            }
        } catch (err) {
            console.warn(`Third Era | Error loading spells from pack ${pack.collection}:`, err);
        }
    }

    const list = [...seen.values()];
    list.sort((a, b) => a.level - b.level || (a.spell.name || "").localeCompare(b.spell.name || ""));
    return list;
}
