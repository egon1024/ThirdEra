/**
 * CGS spell grants → character spell tab / ready-to-cast integration (Phase 5d).
 * Pure helpers: map merged `cgs.spellGrants.rows` to per-class “always ready” spell item ids and Known-tab grouping.
 *
 * @see .cursor/plans/cgs-phased-implementation.md (Phase 5d)
 */

/**
 * Whether an embedded spell document matches a CGS row’s `spellUuid` (uuid, sourceId, flags).
 *
 * @param {unknown} spellItem
 * @param {string} grantSpellUuid
 * @returns {boolean}
 */
export function actorSpellItemMatchesCgsSpellUuid(spellItem, grantSpellUuid) {
    const want = typeof grantSpellUuid === "string" ? grantSpellUuid.trim() : "";
    if (!want || !spellItem || (/** @type {{ type?: string }} */ (spellItem).type) !== "spell") return false;
    const u = typeof /** @type {{ uuid?: string }} */ (spellItem).uuid === "string" ? spellItem.uuid.trim() : "";
    if (u === want) return true;
    const src = typeof /** @type {{ sourceId?: string }} */ (spellItem).sourceId === "string" ? spellItem.sourceId.trim() : "";
    if (src && src === want) return true;
    const flagSrc = /** @type {{ flags?: { core?: { sourceId?: string } } }} */ (spellItem).flags?.core?.sourceId;
    const fs = typeof flagSrc === "string" ? flagSrc.trim() : "";
    if (fs && fs === want) return true;
    const srcSpell =
        /** @type {{ flags?: { thirdera?: { sourceSpellUuid?: string } } }} */ (spellItem).flags?.thirdera?.sourceSpellUuid;
    const ss = typeof srcSpell === "string" ? srcSpell.trim() : "";
    if (ss && ss === want) return true;
    return false;
}

/**
 * Find an embedded spell item for a CGS grant’s `spellUuid` (compendium / world UUID string).
 * Matches `item.uuid` or `sourceId` / `flags.core.sourceId` when the actor copy differs from the stored grant UUID.
 *
 * @param {unknown[]} spellItems
 * @param {string} spellUuid
 * @returns {unknown | null}
 */
export function findActorSpellItemMatchingGrantUuid(spellItems, spellUuid) {
    const want = typeof spellUuid === "string" ? spellUuid.trim() : "";
    if (!want) return null;
    for (const it of spellItems || []) {
        if (!it || it.type !== "spell") continue;
        if (actorSpellItemMatchesCgsSpellUuid(it, want)) return it;
    }
    return null;
}

/**
 * Merged CGS row (`actor.system.cgs.spellGrants.rows`) for this embedded spell, if any.
 *
 * @param {unknown} spellItem
 * @param {unknown[]} spellGrantRows
 * @returns {unknown | null}
 */
export function findMergedSpellGrantRowForActorSpell(spellItem, spellGrantRows) {
    if (!spellItem || (/** @type {{ type?: string }} */ (spellItem).type) !== "spell" || !Array.isArray(spellGrantRows)) {
        return null;
    }
    for (const row of spellGrantRows) {
        if (!row || typeof row !== "object") continue;
        const su = typeof /** @type {{ spellUuid?: string }} */ (row).spellUuid === "string" ? row.spellUuid.trim() : "";
        if (!su) continue;
        if (actorSpellItemMatchesCgsSpellUuid(spellItem, su)) return row;
    }
    return null;
}

/**
 * Embedded spell item ids that were created only for CGS spell grants and no longer match any merged grant row.
 *
 * @param {unknown[]} spellItems
 * @param {unknown[]} spellGrantRows — merged `actor.system.cgs.spellGrants.rows`
 * @returns {string[]} actor item ids safe to delete (caller must still check permissions)
 */
export function collectOrphanCgsGrantOnlyEmbedItemIds(spellItems, spellGrantRows) {
    const rows = Array.isArray(spellGrantRows) ? spellGrantRows : [];
    /** @type {string[]} */
    const out = [];
    for (const it of spellItems || []) {
        if (!it || (/** @type {{ type?: string }} */ (it).type) !== "spell") continue;
        const id = typeof /** @type {{ id?: string }} */ (it).id === "string" ? it.id.trim() : "";
        if (!id) continue;
        const onlyGrant =
            /** @type {{ flags?: { thirdera?: { embeddedForCgsGrant?: boolean } } }} */ (it).flags?.thirdera
                ?.embeddedForCgsGrant === true;
        if (!onlyGrant) continue;
        if (findMergedSpellGrantRowForActorSpell(it, rows)) continue;
        out.push(id);
    }
    return out;
}

/**
 * Normalize `usesPerDay` from item/JSON data (numbers or numeric strings from forms).
 *
 * @param {unknown} v
 * @returns {number|undefined} finite non-negative integer, or undefined if absent/invalid
 */
export function normalizeCgsSpellGrantUsesPerDay(v) {
    if (v == null) return undefined;
    if (typeof v === "number" && Number.isFinite(v)) {
        const t = Math.trunc(v);
        return t >= 0 ? t : undefined;
    }
    if (typeof v === "string") {
        const s = v.trim();
        if (s === "") return undefined;
        const n = Number(s);
        if (Number.isFinite(n)) {
            const t = Math.trunc(n);
            return t >= 0 ? t : undefined;
        }
    }
    return undefined;
}

/**
 * Grant is limited like an SLA (at-will or N/day), not “spell known” using normal spell slots / preparation counts.
 *
 * @param {unknown} row — merged spell grant row
 * @returns {boolean}
 */
export function cgsSpellGrantIsSlaStyle(row) {
    if (!row || typeof row !== "object") return false;
    if (/** @type {{ atWill?: boolean }} */ (row).atWill === true) return true;
    return normalizeCgsSpellGrantUsesPerDay(/** @type {{ usesPerDay?: unknown }} */ (row).usesPerDay) !== undefined;
}

/**
 * Which embedded spell item ids should appear on Ready to cast without normal preparation / shortlist rules.
 *
 * @param {unknown[]} spellGrantRows — `actor.system.cgs.spellGrants.rows` after merge
 * @param {unknown[]} spellItems — actor items with `type === "spell"`
 * @param {Array<{ classItemId?: string, spellListKey?: string, hasSpellcasting?: boolean }>} spellcastingByClass
 * @returns {Map<string, Set<string>>} classItemId → Set of spell item ids (`item.id`). Rows **without** `classItemId` are omitted here; use {@link mapCgsUnscopedSpellGrantReadySpellIds}.
 */
export function mapCgsSpellGrantReadySpellIdsByClass(spellGrantRows, spellItems, spellcastingByClass) {
    /** @type {Map<string, Set<string>>} */
    const classToIds = new Map();
    const classes = Array.isArray(spellcastingByClass) ? spellcastingByClass : [];
    for (const sc of classes) {
        if (sc?.hasSpellcasting) {
            const cid = typeof sc.classItemId === "string" ? sc.classItemId.trim() : "";
            if (cid) classToIds.set(cid, new Set());
        }
    }
    for (const row of spellGrantRows || []) {
        if (!row || typeof row !== "object") continue;
        const su = typeof row.spellUuid === "string" ? row.spellUuid.trim() : "";
        if (!su) continue;
        const spellItem = findActorSpellItemMatchingGrantUuid(spellItems, su);
        const itemId = spellItem && typeof spellItem.id === "string" ? spellItem.id : "";
        if (!itemId) continue;

        const explicit = typeof row.classItemId === "string" ? row.classItemId.trim() : "";
        if (explicit) {
            const s = classToIds.get(explicit);
            if (s) s.add(itemId);
        }
    }
    return classToIds;
}

/**
 * Embedded spell item ids for merged grant rows that do **not** set `classItemId` (equipment, race, etc.).
 * Shown under a global Ready-to-cast capability section, not under a class header.
 *
 * When `knownSpellcastingClassItemIds` is provided, rows whose `classItemId` is **non-empty** but **not** in that
 * set (stale id, wrong class, template typo) are still included here so the spell is not orphaned from RTC entirely.
 *
 * @param {unknown[]} spellGrantRows
 * @param {unknown[]} spellItems
 * @param {Set<string> | null} [knownSpellcastingClassItemIds] — `classItemId` values for actors that actually have spellcasting (embedded class items). Omit to preserve legacy behavior (explicit `classItemId` always skips unscoped).
 * @returns {Set<string>}
 */
export function mapCgsUnscopedSpellGrantReadySpellIds(spellGrantRows, spellItems, knownSpellcastingClassItemIds = null) {
    const known =
        knownSpellcastingClassItemIds instanceof Set ? knownSpellcastingClassItemIds : null;
    /** @type {Set<string>} */
    const out = new Set();
    for (const row of spellGrantRows || []) {
        if (!row || typeof row !== "object") continue;
        const explicit = typeof /** @type {{ classItemId?: string }} */ (row).classItemId === "string"
            ? /** @type {{ classItemId?: string }} */ (row).classItemId.trim()
            : "";
        if (explicit) {
            if (!known) continue;
            if (known.has(explicit)) continue;
            /* orphan classItemId: fall through to global RTC */
        }
        const su = typeof /** @type {{ spellUuid?: string }} */ (row).spellUuid === "string"
            ? /** @type {{ spellUuid?: string }} */ (row).spellUuid.trim()
            : "";
        if (!su) continue;
        const spellItem = findActorSpellItemMatchingGrantUuid(spellItems, su);
        const itemId = spellItem && typeof /** @type {{ id?: string }} */ (spellItem).id === "string" ? spellItem.id.trim() : "";
        if (itemId) out.add(itemId);
    }
    return out;
}

/**
 * Class item id used for cast / DC context for a granted spell on the actor (matches ready-to-cast routing).
 *
 * @param {unknown} mergedRow - merged CGS spell grant row (`actor.system.cgs.spellGrants.rows[]`)
 * @param {{ system?: unknown } | null | undefined} spellItem - embedded spell item on the actor
 * @param {Array<{ classItemId?: string, spellListKey?: string, hasSpellcasting?: boolean }>} spellcastingByClass
 * @param {{ hasLevelForClass: (spellSystem: unknown, spellListKey: string) => boolean }} deps
 * @returns {string} classItemId or ""
 */
export function resolveSpellGrantCastClassItemId(mergedRow, spellItem, spellcastingByClass, deps) {
    const classes = Array.isArray(spellcastingByClass) ? spellcastingByClass : [];
    const has = deps.hasLevelForClass;
    const explicit = mergedRow && typeof mergedRow === "object" && typeof mergedRow.classItemId === "string" ? mergedRow.classItemId.trim() : "";
    if (explicit && classes.some((c) => c?.hasSpellcasting && c?.classItemId === explicit)) return explicit;

    if (!spellItem || typeof spellItem !== "object") {
        const first = classes.find((c) => c?.hasSpellcasting);
        return (typeof first?.classItemId === "string" ? first.classItemId.trim() : "") || "";
    }
    const sys = spellItem.system && typeof spellItem.system === "object" ? spellItem.system : {};
    for (const sc of classes) {
        if (!sc?.hasSpellcasting) continue;
        const cid = typeof sc.classItemId === "string" ? sc.classItemId.trim() : "";
        const slk = typeof sc.spellListKey === "string" ? sc.spellListKey : "";
        if (!cid || !has(sys, slk)) continue;
        return cid;
    }
    const first = classes.find((c) => c?.hasSpellcasting);
    const fid = typeof first?.classItemId === "string" ? first.classItemId.trim() : "";
    return fid || "";
}

/**
 * Group merged spell grant rows by spell level for the Known spells tab (CGS section).
 *
 * @param {unknown[]} spellGrantRows
 * @param {unknown[]} spellItems
 * @param {{ fromUuidSync?: (uuid: string) => { name?: string, system?: { level?: number } } | null }} [deps]
 * @returns {{ byLevel: Record<string, Array<{ row: unknown, spellDisplay: { id: string | null, name: string, img: string | null, system: Record<string, unknown>, spellUuid: string } }>>, hasAny: boolean }}
 */
export function buildCgsGrantedSpellsByLevelForKnownTab(spellGrantRows, spellItems, deps = {}) {
    const fromUuidSync = typeof deps.fromUuidSync === "function" ? deps.fromUuidSync : () => null;
    /** @type {Record<string, Array<{ row: unknown, spellDisplay: { id: string | null, name: string, img: string | null, system: Record<string, unknown>, spellUuid: string } }>>} */
    const byLevel = {};
    for (let i = 0; i <= 9; i++) byLevel[String(i)] = [];

    for (const row of spellGrantRows || []) {
        if (!row || typeof row !== "object") continue;
        const su = typeof row.spellUuid === "string" ? row.spellUuid.trim() : "";
        if (!su) continue;

        const spell = findActorSpellItemMatchingGrantUuid(spellItems, su);
        let level = 0;
        /** @type {string | null} */
        let id = null;
        let name = "";
        /** @type {string | null} */
        let img = null;
        /** @type {Record<string, unknown>} */
        let sys = { level: 0, prepared: 0, cast: 0 };

        if (spell) {
            const raw = spell.system?.level;
            level = Math.min(9, Math.max(0, Number(raw ?? 0)));
            id = typeof spell.id === "string" ? spell.id : null;
            name = typeof spell.name === "string" ? spell.name : "";
            img = typeof spell.img === "string" ? spell.img : null;
            const s = spell.system && typeof spell.system === "object" ? { ...spell.system } : {};
            sys = {
                ...s,
                level,
                prepared: Number(s.prepared ?? 0) || 0,
                cast: Number(s.cast ?? 0) || 0
            };
        } else {
            const rl = typeof row.label === "string" ? row.label.trim() : "";
            name = rl;
            let docLevel = 0;
            try {
                const doc = fromUuidSync(su);
                if (doc) {
                    if (!name && typeof doc.name === "string") name = doc.name;
                    const dl = doc.system?.level;
                    if (dl != null && Number.isFinite(Number(dl))) docLevel = Number(dl);
                }
            } catch {
                /* ignore */
            }
            level = Math.min(9, Math.max(0, docLevel));
            sys = { level, prepared: 0, cast: 0 };
            if (!name) name = su;
        }

        const levelKey = String(level);
        byLevel[levelKey].push({
            row,
            spellDisplay: {
                id,
                name,
                img,
                system: sys,
                spellUuid: su
            }
        });
    }

    for (const lk of Object.keys(byLevel)) {
        byLevel[lk].sort((a, b) =>
            (a.spellDisplay.name || "").localeCompare(b.spellDisplay.name || "", undefined, { sensitivity: "base" })
        );
    }

    const hasAny = Object.values(byLevel).some((arr) => arr.length > 0);

    return { byLevel, hasAny };
}

/**
 * @param {unknown} row — merged spell grant row
 * @param {(key: string) => string} localize — e.g. game.i18n.localize
 * @returns {string}
 */
export function formatCgsSpellGrantUsesHint(row, localize) {
    if (!row || typeof row !== "object") return "";
    if (row.atWill === true) {
        const k = "THIRDERA.CGS.SpellGrantAtWill";
        return typeof localize === "function" && localize(k) !== k ? localize(k) : "At will";
    }
    const n = normalizeCgsSpellGrantUsesPerDay(row.usesPerDay);
    if (n !== undefined) {
        const k = "THIRDERA.CGS.SpellGrantUsesPerDay";
        const t = typeof localize === "function" ? localize(k) : k;
        return t.includes("{n}") ? t.replace("{n}", String(n)) : `${n}/day`;
    }
    return "";
}
