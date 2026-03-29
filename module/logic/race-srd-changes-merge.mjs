/**
 * Merge bundled SRD racial skill/save/hide modifiers into existing race items without replacing documents.
 * Compendium races skip full JSON refresh (see CompendiumLoader.PACKS_SKIP_JSON_REFRESH_FOR_EXISTING); this
 * migration appends missing stock rows so existing worlds pick up new GMS rows safely.
 *
 * Rules: append a stock row only if no existing change row has the same modifier key (any value).
 * Does not modify ability score rows. Bump RACE_STOCK_DELTA_REV when adding new stock rows for a future release.
 */

/** Increment when adding new stock delta rows so documents with older flags receive another merge pass. */
export const RACE_STOCK_DELTA_REV = 1;

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
 * Apply stock delta merge to one race document if needed; updates flags.thirdera.raceStockDeltaRev.
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
    if (rev >= RACE_STOCK_DELTA_REV) return "skipped";

    const delta = getRaceStockDeltaRowsForName(doc.name);
    const current = doc.system?.changes;
    const merged = mergeRaceStockDeltaIntoChanges(current, delta);
    const dataChanged = !raceMechanicalChangesEqual(merged, current);

    try {
        if (dataChanged) {
            await doc.update({
                system: { changes: merged },
                flags: { thirdera: { raceStockDeltaRev: RACE_STOCK_DELTA_REV } }
            });
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
            if (getRaceStockDeltaRevOnDoc(doc) >= RACE_STOCK_DELTA_REV) continue;
            const result = await applyRaceStockDeltaToDocument(doc);
            if (result === "updated") compendiumUpdated++;
            else if (result === "unchanged") compendiumUnchanged++;
        }
    }

    let worldUpdated = 0;
    let worldUnchanged = 0;
    for (const item of game.items?.filter?.((i) => i.type === "race") ?? []) {
        if (getRaceStockDeltaRevOnDoc(item) >= RACE_STOCK_DELTA_REV) continue;
        const result = await applyRaceStockDeltaToDocument(item);
        if (result === "updated") worldUpdated++;
        else if (result === "unchanged") worldUnchanged++;
    }

    let actorsUpdated = 0;
    let actorsUnchanged = 0;
    for (const actor of game.actors ?? []) {
        const races = actor.items?.filter?.((i) => i.type === "race") ?? [];
        for (const item of races) {
            if (getRaceStockDeltaRevOnDoc(item) >= RACE_STOCK_DELTA_REV) continue;
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
