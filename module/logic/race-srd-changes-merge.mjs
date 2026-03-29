/**
 * Merge bundled SRD racial skill/save/hide modifiers into existing race items without replacing documents.
 * Compendium races skip full JSON refresh (see CompendiumLoader.PACKS_SKIP_JSON_REFRESH_FOR_EXISTING); this
 * migration appends missing stock rows so existing worlds pick up new GMS rows safely.
 *
 * Rules: append a stock row only if no existing change row has the same modifier key (any value).
 * Does not modify ability score rows. Bump RACE_STOCK_DELTA_REV when adding new stock rows for a future release.
 */

/**
 * Increment when adding new stock delta rows **or** when existing worlds need another merge pass
 * (e.g. compendium `system.changes` was cleared while `raceStockDeltaRev` stayed at the previous value).
 */
export const RACE_STOCK_DELTA_REV = 2;

/**
 * SRD-aligned extra `system.changes` rows (skills, saves, Small Hide), keyed by exact default race **name**.
 * Must match compendium Item names for ThirdEra stock races.
 */
const STOCK_RACE_DELTA_CHANGES_BY_NAME = Object.freeze({
    Elf: [
        { key: "skill.listen", value: 2, label: "SRD racial" },
        { key: "skill.search", value: 2, label: "SRD racial" },
        { key: "skill.spot", value: 2, label: "SRD racial" }
    ],
    Gnome: [
        { key: "skill.listen", value: 2, label: "SRD racial" },
        { key: "skill.craft-alchemy", value: 2, label: "SRD racial" },
        { key: "skill.hide", value: 4, label: "SRD Small size" }
    ],
    "Half-Elf": [
        { key: "skill.listen", value: 1, label: "SRD racial" },
        { key: "skill.search", value: 1, label: "SRD racial" },
        { key: "skill.spot", value: 1, label: "SRD racial" },
        { key: "skill.diplomacy", value: 2, label: "SRD racial" },
        { key: "skill.gatherInformation", value: 2, label: "SRD racial" }
    ],
    Halfling: [
        { key: "saveFort", value: 1, label: "SRD racial (+1 all saves)" },
        { key: "saveRef", value: 1, label: "SRD racial (+1 all saves)" },
        { key: "saveWill", value: 1, label: "SRD racial (+1 all saves)" },
        { key: "skill.climb", value: 2, label: "SRD racial" },
        { key: "skill.jump", value: 2, label: "SRD racial" },
        { key: "skill.listen", value: 2, label: "SRD racial" },
        { key: "skill.moveSilently", value: 2, label: "SRD racial" },
        { key: "skill.hide", value: 4, label: "SRD Small size" }
    ]
});

/**
 * @param {string|undefined} name - Item name
 * @returns {ReadonlyArray<{ key: string, value: number, label: string }>}
 */
export function getRaceStockDeltaRowsForName(name) {
    const n = (name ?? "").trim();
    const rows = STOCK_RACE_DELTA_CHANGES_BY_NAME[n];
    return rows ? [...rows] : [];
}

/**
 * @param {unknown} row
 * @returns {{ key: string, value: number, label: string }}
 */
export function normalizeMechanicalChangeRow(row) {
    const key = typeof row?.key === "string" ? row.key.trim() : "";
    const value = Number(row?.value);
    const label = typeof row?.label === "string" ? row.label.trim() : "";
    return {
        key,
        value: Number.isNaN(value) ? 0 : value,
        label
    };
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function raceMechanicalChangesEqual(a, b) {
    const qa = (Array.isArray(a) ? a : []).map(normalizeMechanicalChangeRow);
    const qb = (Array.isArray(b) ? b : []).map(normalizeMechanicalChangeRow);
    if (qa.length !== qb.length) return false;
    const sortFn = (x, y) =>
        x.key.localeCompare(y.key) || x.value - y.value || x.label.localeCompare(y.label);
    const sa = [...qa].sort(sortFn);
    const sb = [...qb].sort(sortFn);
    for (let i = 0; i < sa.length; i++) {
        const u = sa[i];
        const v = sb[i];
        if (u.key !== v.key || u.value !== v.value || u.label !== v.label) return false;
    }
    return true;
}

/**
 * Append stock delta rows when no row with that modifier key exists yet.
 *
 * @param {unknown} existingChanges
 * @param {ReadonlyArray<{ key: string, value: number, label?: string }>} stockDeltaRows
 * @returns {Array<{ key: string, value: number, label: string }>}
 */
export function mergeRaceStockDeltaIntoChanges(existingChanges, stockDeltaRows) {
    const out = (Array.isArray(existingChanges) ? existingChanges : []).map((r) => {
        const n = normalizeMechanicalChangeRow(r);
        return { key: n.key, value: n.value, label: n.label };
    });
    const keysPresent = new Set(out.map((r) => r.key).filter(Boolean));
    for (const s of stockDeltaRows || []) {
        const key = (s.key || "").trim();
        if (!key) continue;
        if (keysPresent.has(key)) continue;
        const value = Number(s.value);
        out.push({
            key,
            value: Number.isNaN(value) ? 0 : value,
            label: typeof s.label === "string" ? s.label : ""
        });
        keysPresent.add(key);
    }
    return out;
}

/**
 * @param {object} doc - Item document (race)
 * @param {typeof foundry.utils} [utils]
 * @returns {number}
 */
export function getRaceStockDeltaRevOnDoc(doc, utils = foundry?.utils) {
    const rev = utils?.getProperty?.(doc?.flags, "thirdera.raceStockDeltaRev");
    const n = Number(rev);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * True when this item is the Races compendium entry or clearly originated from it (embedded / import).
 * Used to self-heal missing bundled `system.changes` rows after `raceStockDeltaRev` is already current,
 * without touching homebrew races named "Elf" etc. in the world.
 *
 * @param {object} doc - Item-like
 * @param {typeof foundry.utils} [utils]
 * @returns {boolean}
 */
export function raceDocLinkedToThirderaRacesStock(doc, utils = foundry?.utils) {
    const pack = String(doc?.pack ?? "").trim();
    if (pack === "thirdera.thirdera_races") return true;
    const uuid = String(doc?.uuid ?? "");
    if (uuid.includes("thirdera.thirdera_races")) return true;
    const sourceFromFlags = utils?.getProperty?.(doc?.flags, "core.sourceId");
    const sourceId = String(sourceFromFlags ?? doc?.flags?.core?.sourceId ?? doc?.sourceId ?? "");
    if (sourceId.includes("thirdera.thirdera_races")) return true;
    return false;
}

/**
 * Apply stock delta merge to one race document if needed; updates flags.thirdera.raceStockDeltaRev.
 * When the revision flag is already current but a compendium-linked stock race is still missing bundled
 * rows (e.g. legacy data or a failed merge), merges again without bumping homebrew-only races.
 *
 * @param {Item} doc - Foundry Item (race)
 * @param {object} [opts]
 * @param {typeof foundry.utils} [opts.utils]
 * @returns {Promise<"skipped" | "unchanged" | "updated">}
 */
export async function applyRaceStockDeltaToDocument(doc, opts = {}) {
    const utils = opts.utils ?? foundry?.utils;
    if (!doc || doc.type !== "race") return "skipped";

    const rev = getRaceStockDeltaRevOnDoc(doc, utils);
    const delta = getRaceStockDeltaRowsForName(doc.name);
    const current = doc.system?.changes;
    const merged = mergeRaceStockDeltaIntoChanges(current, delta);
    const dataChanged = !raceMechanicalChangesEqual(merged, current);

    const needsFlagBump = rev < RACE_STOCK_DELTA_REV;
    const allowSelfHeal =
        raceDocLinkedToThirderaRacesStock(doc, utils) && delta.length > 0 && rev >= RACE_STOCK_DELTA_REV && dataChanged;

    if (!needsFlagBump && !dataChanged) return "skipped";
    if (!needsFlagBump && dataChanged && !allowSelfHeal) return "skipped";

    try {
        if (dataChanged) {
            const payload = { system: { changes: merged } };
            if (needsFlagBump) {
                payload.flags = { thirdera: { raceStockDeltaRev: RACE_STOCK_DELTA_REV } };
            }
            await doc.update(payload);
            return "updated";
        }
        await doc.update({
            flags: { thirdera: { raceStockDeltaRev: RACE_STOCK_DELTA_REV } }
        });
        return "unchanged";
    } catch (e) {
        console.warn(`Third Era | Race stock delta migration failed for "${doc.name}":`, e);
        return "skipped";
    }
}

/**
 * GM only: merge stock deltas into Races compendium and all embedded actor race items.
 *
 * @param {object} deps
 * @param {Game} deps.game
 * @returns {Promise<{ compendiumUpdated: number, compendiumUnchanged: number, worldUpdated: number, worldUnchanged: number, actorsUpdated: number, actorsUnchanged: number, skipped: boolean, reason?: string }>}
 */
export async function migrateAllRaceStockDeltas(deps) {
    const game = deps?.game;
    const user = game?.user;
    if (!user?.isGM) {
        return {
            skipped: true,
            reason: "not-gm",
            compendiumUpdated: 0,
            compendiumUnchanged: 0,
            worldUpdated: 0,
            worldUnchanged: 0,
            actorsUpdated: 0,
            actorsUnchanged: 0
        };
    }

    let compendiumUpdated = 0;
    let compendiumUnchanged = 0;
    const pack = game.packs?.get?.("thirdera.thirdera_races");
    if (pack) {
        const docs = await pack.getDocuments();
        for (const doc of docs) {
            if (doc.type !== "race") continue;
            const result = await applyRaceStockDeltaToDocument(doc);
            if (result === "updated") compendiumUpdated++;
            else if (result === "unchanged") compendiumUnchanged++;
        }
    }

    let worldUpdated = 0;
    let worldUnchanged = 0;
    for (const item of game.items?.filter?.((i) => i.type === "race") ?? []) {
        const result = await applyRaceStockDeltaToDocument(item);
        if (result === "updated") worldUpdated++;
        else if (result === "unchanged") worldUnchanged++;
    }

    let actorsUpdated = 0;
    let actorsUnchanged = 0;
    for (const actor of game.actors ?? []) {
        const races = actor.items?.filter?.((i) => i.type === "race") ?? [];
        for (const item of races) {
            const result = await applyRaceStockDeltaToDocument(item);
            if (result === "updated") actorsUpdated++;
            else if (result === "unchanged") actorsUnchanged++;
        }
    }

    return {
        skipped: false,
        compendiumUpdated,
        compendiumUnchanged,
        worldUpdated,
        worldUnchanged,
        actorsUpdated,
        actorsUnchanged
    };
}
