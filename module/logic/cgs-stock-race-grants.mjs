/**
 * Stock CGS sense grants for built-in Third Era race compendium documents (`race-*` ids).
 * Used when a race item has no explicit `system.cgsGrants.grants` and no `system.cgsGrants.senses` rows,
 * so worlds with older embedded copies (missing JSON updates) still get baseline vision lines.
 *
 * Identity: match by compendium document id parsed from
 * `sourceId` / `uuid` / `id`, not by display name.
 */

/** @type {Readonly<Record<string, ReadonlyArray<{ category: string, senseType: string, range: string }>>>} */
export const STOCK_RACE_CGS_GRANTS_BY_DOC_ID = Object.freeze({
    "race-dwarf": Object.freeze([{ category: "sense", senseType: "darkvision", range: "60 ft" }]),
    "race-elf": Object.freeze([{ category: "sense", senseType: "lowLight", range: "" }]),
    "race-gnome": Object.freeze([{ category: "sense", senseType: "lowLight", range: "" }]),
    "race-half-elf": Object.freeze([{ category: "sense", senseType: "lowLight", range: "" }]),
    "race-half-orc": Object.freeze([{ category: "sense", senseType: "darkvision", range: "60 ft" }]),
    "race-halfling": Object.freeze([]),
    "race-human": Object.freeze([])
});

/**
 * @param {unknown} item - Item-like (race)
 * @returns {string | null} e.g. `race-dwarf`, or null if not a known pack id pattern
 */
export function extractPackRaceDocId(item) {
    if (!item || typeof item !== "object") return null;
    /** @param {unknown} s */
    const tryStr = (s) => {
        if (typeof s !== "string") return null;
        const t = s.trim();
        const m = t.match(/(?:^|[.])(race-[a-z0-9-]+)(?:\?.*)?$/i);
        return m ? m[1].toLowerCase() : null;
    };
    return (
        tryStr(/** @type {{ sourceId?: string }} */ (item).sourceId) ||
        tryStr(/** @type {{ uuid?: string }} */ (item).uuid) ||
        tryStr(/** @type {{ id?: string }} */ (item).id) ||
        tryStr(/** @type {{ _id?: string }} */ (item)._id)
    );
}

/**
 * Resolved grant objects for CGS when this race is owned on an actor.
 * Precedence: non-empty `cgsGrants.grants` → mapped `cgsGrants.senses` → stock table by pack id.
 *
 * @param {unknown} item - Race item
 * @returns {Array<{ category: string, senseType: string, range: string }>}
 */
export function getEffectiveRaceCgsGrants(item) {
    if (!item || typeof item !== "object") return [];
    const sys = /** @type {{ cgsGrants?: { grants?: unknown, senses?: unknown } }} */ (item).system ?? {};
    const cg = sys.cgsGrants ?? {};
    const rawGrants = cg.grants;
    if (Array.isArray(rawGrants) && rawGrants.length > 0) {
        return /** @type {Array<{ category: string, senseType: string, range: string }>} */ (rawGrants.slice());
    }
    const senses = cg.senses;
    if (Array.isArray(senses) && senses.length > 0) {
        /** @type {Array<{ category: string, senseType: string, range: string }>} */
        const fromSenses = [];
        for (const s of senses) {
            if (!s || typeof s !== "object") continue;
            const st = typeof /** @type {{ type?: string }} */ (s).type === "string" ? s.type.trim() : "";
            if (!st) continue;
            const range = typeof /** @type {{ range?: string }} */ (s).range === "string" ? s.range : "";
            fromSenses.push({ category: "sense", senseType: st, range });
        }
        if (fromSenses.length > 0) return fromSenses;
    }
    const docId = extractPackRaceDocId(item);
    if (!docId) return [];
    const stock = STOCK_RACE_CGS_GRANTS_BY_DOC_ID[docId];
    if (!stock || stock.length === 0) return [];
    return stock.map((g) => ({ ...g }));
}
