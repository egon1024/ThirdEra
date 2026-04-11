/**
 * Capability Grant System (CGS) — aggregation core (parallel to GMS / modifier-aggregation).
 * Structured grants with per-category merge and provenance; numeric modifiers stay in getActiveModifiers.
 *
 * Phase 2: senses Stage A (union + dedupe). Phase 5a: Stage B `applySenseSuppressions` — `senses.rows` are
 * **effective**; `senses.sensesUnionRows` = pre-suppression union; `senses.suppressed` explains removed rows.
 * Phase 5d: `spellGrants.rows` via `mergeSpellGrantRows` (dedupe by `spellUuid`, merged sources + optional meta).
 * Phase 5e: typed defenses — `immunities.rows` (set by tag), `energyResistance.rows` (max per type),
 * `damageReduction.rows` (all rows; consumer picks best applicable DR).
 * Phase 5f: `creatureTypeOverlays.rows` / `subtypeOverlays.rows` — overlay type/subtype UUIDs with merged sources
 * (base type stays on NPC `details`). V1: additive with primary — **base ∪ overlays**; see cgs-implementation.md §5.1.
 * Future: energy/immunity/DR label vocabularies may move to compendium Items or CONFIG+Items hybrid; merge uses
 * injected `deps` label maps — see cgs-phased-implementation.md § "Future — Typed defense catalogs".
 *
 * @typedef {{ label: string, grants: unknown[], sourceRef?: Record<string, unknown> }} CapabilityContribution
 * @typedef {{ label: string, sourceRef?: Record<string, unknown> }} CgsSourceEntry
 * @typedef {{ senseType: string, range: string, label: string, sources: CgsSourceEntry[] }} MergedSenseRow
 * @typedef {{ spellUuid: string, sources: CgsSourceEntry[], label?: string, usesPerDay?: number, atWill?: boolean, casterLevel?: number, classItemId?: string }} MergedSpellGrantRow
 * @typedef {{ tag: string, label: string, sources: CgsSourceEntry[] }} MergedImmunityRow
 * @typedef {{ energyType: string, amount: number, label: string, sources: CgsSourceEntry[] }} MergedEnergyResistanceRow
 * @typedef {{ value: number, bypass: string, label: string, sources: CgsSourceEntry[] }} MergedDamageReductionRow
 * @typedef {{ typeUuid: string, label: string, sources: CgsSourceEntry[] }} MergedCreatureTypeOverlayRow
 * @typedef {{ subtypeUuid: string, label: string, sources: CgsSourceEntry[] }} MergedSubtypeOverlayRow
 * @typedef {Record<string, { rows?: unknown[], grants?: unknown[] }>} CapabilityGrantsResult
 *
 * @see .cursor/plans/cgs-implementation.md
 * @see .cursor/plans/cgs-phased-implementation.md
 */

import { normalizeCgsSpellGrantUsesPerDay } from "./cgs-spell-grant-prep.mjs";

// ---------------------------------------------------------------------------
// Registered output categories (stable keys on getActiveCapabilityGrants result)
// ---------------------------------------------------------------------------

/** When `allVision` suppression has no CONFIG keys, treat these sense types as vision for Stage B (SRD-aligned). */
export const CGS_DEFAULT_ALL_VISION_SENSE_TYPE_KEYS = Object.freeze([
    "darkvision",
    "lowLight",
    "scent",
    "blindsight",
    "blindsense",
    "tremorsense"
]);

/** @type {readonly string[]} */
export const CGS_CAPABILITY_CATEGORY_IDS = Object.freeze([
    "senses",
    "senseSuppressions",
    "spellGrants",
    "immunities",
    "energyResistance",
    "damageReduction",
    "creatureTypeOverlays",
    "subtypeOverlays",
    "featGrants",
    "skillGrants"
]);

/**
 * @returns {CapabilityGrantsResult}
 */
export function createEmptyCapabilityGrants() {
    return {
        senses: { rows: [], sensesUnionRows: [], suppressed: [] },
        senseSuppressions: { grants: [] },
        spellGrants: { rows: [] },
        immunities: { rows: [] },
        energyResistance: { rows: [] },
        damageReduction: { rows: [] },
        creatureTypeOverlays: { rows: [] },
        subtypeOverlays: { rows: [] },
        featGrants: { rows: [] },
        skillGrants: { rows: [] }
    };
}

/**
 * Clone a senseSuppression grant for the merge pipeline. Must not throw — a thrown clone would abort
 * actor.prepareDerivedData and block all actor sheets.
 *
 * @param {object} g
 * @returns {Record<string, unknown>}
 */
function cloneSenseSuppressionGrantForMerge(g) {
    try {
        if (typeof structuredClone === "function") return structuredClone(g);
    } catch (_) {
        /* non-cloneable / DOM-linked objects */
    }
    try {
        const dup = globalThis.foundry?.utils?.duplicate;
        if (typeof dup === "function") return dup(g);
    } catch (_) {
        /* ignore */
    }
    try {
        return JSON.parse(JSON.stringify(g));
    } catch (_) {
        /* ignore */
    }
    return { ...g };
}

/**
 * Normalize range for dedupe keys (trim, lowercase, collapse whitespace).
 *
 * @param {unknown} range
 * @returns {string}
 */
export function normalizeSenseRangeKey(range) {
    if (range == null) return "";
    return String(range)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

/**
 * @param {string} senseType
 * @param {string} range
 * @param {{ senseTypeLabels?: Record<string, string> }} [deps]
 * @returns {string}
 */
export function formatMergedSenseLabel(senseType, range, deps = {}) {
    const labels =
        deps.senseTypeLabels ??
        (typeof globalThis.CONFIG !== "undefined" && globalThis.CONFIG?.THIRDERA?.senseTypes) ??
        {};
    const base = (typeof senseType === "string" && labels[senseType]) ? labels[senseType] : senseType;
    const r = range != null ? String(range).trim() : "";
    if (r) return `${base} ${r}`.trim();
    return String(base);
}

/**
 * Stage A: union merge, dedupe by (senseType, normalized range), merge sources[].
 *
 * @param {Array<{ senseType: string, range?: string, label?: string, _source: CgsSourceEntry }>} atoms
 * @param {{ senseTypeLabels?: Record<string, string> }} [deps]
 * @returns {MergedSenseRow[]}
 */
export function mergeSenseRows(atoms, deps = {}) {
    if (!Array.isArray(atoms) || atoms.length === 0) return [];
    /** @type {Map<string, { senseType: string, range: string, label?: string, sources: CgsSourceEntry[] }>} */
    const map = new Map();
    for (const a of atoms) {
        if (!a || typeof a !== "object") continue;
        const st = typeof a.senseType === "string" ? a.senseType.trim() : "";
        if (!st) continue;
        const r = a.range != null ? String(a.range) : "";
        const key = `${st}\0${normalizeSenseRangeKey(r)}`;
        const src = a._source && typeof a._source === "object" ? a._source : { label: "Unknown source" };
        const label = typeof src.label === "string" ? src.label : "Unknown source";
        /** @type {CgsSourceEntry} */
        const sourceEntry = { label };
        if (src.sourceRef && typeof src.sourceRef === "object") sourceEntry.sourceRef = src.sourceRef;

        const existing = map.get(key);
        if (!existing) {
            map.set(key, {
                senseType: st,
                range: r,
                label: typeof a.label === "string" ? a.label : undefined,
                sources: [sourceEntry]
            });
        } else {
            existing.sources.push(sourceEntry);
            if (!existing.label && typeof a.label === "string") existing.label = a.label;
        }
    }
    return [...map.values()].map(row => ({
        senseType: row.senseType,
        range: row.range,
        label: row.label ?? formatMergedSenseLabel(row.senseType, row.range, deps),
        sources: row.sources
    }));
}

/**
 * Dedupe provenance sources by label + sourceRef identity (stable order).
 *
 * @param {CgsSourceEntry[]} sources
 * @returns {CgsSourceEntry[]}
 */
export function dedupeCgsSourceEntries(sources) {
    if (!Array.isArray(sources) || sources.length === 0) return [];
    const seen = new Set();
    /** @type {CgsSourceEntry[]} */
    const out = [];
    for (const s of sources) {
        if (!s || typeof s !== "object") continue;
        const label = typeof s.label === "string" ? s.label : "";
        const refKey =
            s.sourceRef && typeof s.sourceRef === "object" ? JSON.stringify(s.sourceRef) : "";
        const k = `${label}\0${refKey}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(s);
    }
    return out;
}

/**
 * Merge spell / SLA grants: dedupe by spell document UUID; accumulate sources and merge optional metadata.
 *
 * @param {Array<{ spellUuid: string, label?: string, usesPerDay?: number, atWill?: boolean, casterLevel?: number, classItemId?: string, _source: CgsSourceEntry }>} atoms
 * @returns {MergedSpellGrantRow[]}
 */
export function mergeSpellGrantRows(atoms) {
    if (!Array.isArray(atoms) || atoms.length === 0) return [];
    /** @type {Map<string, { spellUuid: string, sources: CgsSourceEntry[], label?: string, usesPerDay?: number, atWill: boolean, casterLevel?: number, classItemId?: string }>} */
    const map = new Map();
    for (const a of atoms) {
        if (!a || typeof a !== "object") continue;
        const su = typeof a.spellUuid === "string" ? a.spellUuid.trim() : "";
        if (!su) continue;
        const src = a._source && typeof a._source === "object" ? a._source : { label: "Unknown source" };
        const label = typeof src.label === "string" ? src.label : "Unknown source";
        /** @type {CgsSourceEntry} */
        const sourceEntry = { label };
        if (src.sourceRef && typeof src.sourceRef === "object") sourceEntry.sourceRef = src.sourceRef;

        const existing = map.get(su);
        if (!existing) {
            const uses = normalizeCgsSpellGrantUsesPerDay(a.usesPerDay);
            const cl = a.casterLevel;
            const casterLevel = typeof cl === "number" && Number.isFinite(cl) ? cl : undefined;
            const cid = typeof a.classItemId === "string" ? a.classItemId.trim() : "";
            const gl = typeof a.label === "string" ? a.label.trim() : "";
            map.set(su, {
                spellUuid: su,
                sources: [sourceEntry],
                ...(gl ? { label: gl } : {}),
                ...(uses !== undefined ? { usesPerDay: uses } : {}),
                atWill: a.atWill === true,
                ...(casterLevel !== undefined ? { casterLevel } : {}),
                ...(cid ? { classItemId: cid } : {})
            });
        } else {
            existing.sources.push(sourceEntry);
            if (!existing.label && typeof a.label === "string" && a.label.trim()) existing.label = a.label.trim();
            const udn = normalizeCgsSpellGrantUsesPerDay(a.usesPerDay);
            if (udn !== undefined) {
                existing.usesPerDay = (existing.usesPerDay ?? 0) + udn;
            }
            if (a.atWill === true) existing.atWill = true;
            const cl = a.casterLevel;
            if (typeof cl === "number" && Number.isFinite(cl)) {
                existing.casterLevel =
                    existing.casterLevel === undefined ? cl : Math.max(existing.casterLevel, cl);
            }
            if (!existing.classItemId) {
                const cid = typeof a.classItemId === "string" ? a.classItemId.trim() : "";
                if (cid) existing.classItemId = cid;
            }
        }
    }
    return [...map.values()].map((row) => {
        const mergedSources = dedupeCgsSourceEntries(row.sources);
        /** @type {MergedSpellGrantRow} */
        const out = {
            spellUuid: row.spellUuid,
            sources: mergedSources
        };
        if (row.label) out.label = row.label;
        if (row.usesPerDay !== undefined) out.usesPerDay = row.usesPerDay;
        if (row.atWill) out.atWill = true;
        if (row.casterLevel !== undefined) out.casterLevel = row.casterLevel;
        if (row.classItemId) out.classItemId = row.classItemId;
        return out;
    });
}

/**
 * Merge immunity grants: set of tags, each with merged sources.
 *
 * @typedef {{ tag: string, label: string, sources: CgsSourceEntry[] }} MergedImmunityRow
 * @param {Array<{ tag: string, label?: string, _source: CgsSourceEntry }>} atoms
 * @param {{ immunityTagLabels?: Record<string, string> }} [deps]
 * @returns {MergedImmunityRow[]}
 */
export function mergeImmunityRows(atoms, deps = {}) {
    if (!Array.isArray(atoms) || atoms.length === 0) return [];
    /** @type {Map<string, { tag: string, label?: string, sources: CgsSourceEntry[] }>} */
    const map = new Map();
    for (const a of atoms) {
        if (!a || typeof a !== "object") continue;
        const tag = typeof a.tag === "string" ? a.tag.trim() : "";
        if (!tag) continue;
        const src = a._source && typeof a._source === "object" ? a._source : { label: "Unknown source" };
        const label = typeof src.label === "string" ? src.label : "Unknown source";
        /** @type {CgsSourceEntry} */
        const sourceEntry = { label };
        if (src.sourceRef && typeof src.sourceRef === "object") sourceEntry.sourceRef = src.sourceRef;

        const existing = map.get(tag);
        if (!existing) {
            map.set(tag, {
                tag,
                label: typeof a.label === "string" ? a.label : undefined,
                sources: [sourceEntry]
            });
        } else {
            existing.sources.push(sourceEntry);
            if (!existing.label && typeof a.label === "string") existing.label = a.label;
        }
    }
    const labels =
        deps.immunityTagLabels ??
        (typeof globalThis.CONFIG !== "undefined" && globalThis.CONFIG?.THIRDERA?.immunityTags) ??
        {};
    return [...map.values()].map(row => ({
        tag: row.tag,
        label: row.label ?? (typeof labels[row.tag] === "string" ? labels[row.tag] : row.tag),
        sources: dedupeCgsSourceEntries(row.sources)
    }));
}

/**
 * Merge energy resistance grants: per energy type, take MAX value (SRD stacking rule), accumulate sources.
 *
 * @typedef {{ energyType: string, amount: number, label: string, sources: CgsSourceEntry[] }} MergedEnergyResistanceRow
 * @param {Array<{ energyType: string, amount: number, label?: string, _source: CgsSourceEntry }>} atoms
 * @param {{ energyTypeLabels?: Record<string, string> }} [deps]
 * @returns {MergedEnergyResistanceRow[]}
 */
export function mergeEnergyResistanceRows(atoms, deps = {}) {
    if (!Array.isArray(atoms) || atoms.length === 0) return [];
    /** @type {Map<string, { energyType: string, amount: number, label?: string, sources: CgsSourceEntry[] }>} */
    const map = new Map();
    for (const a of atoms) {
        if (!a || typeof a !== "object") continue;
        const et = typeof a.energyType === "string" ? a.energyType.trim() : "";
        if (!et) continue;
        const amt = typeof a.amount === "number" && Number.isFinite(a.amount) ? a.amount : 0;
        if (amt <= 0) continue;
        const src = a._source && typeof a._source === "object" ? a._source : { label: "Unknown source" };
        const label = typeof src.label === "string" ? src.label : "Unknown source";
        /** @type {CgsSourceEntry} */
        const sourceEntry = { label };
        if (src.sourceRef && typeof src.sourceRef === "object") sourceEntry.sourceRef = src.sourceRef;

        const existing = map.get(et);
        if (!existing) {
            map.set(et, {
                energyType: et,
                amount: amt,
                label: typeof a.label === "string" ? a.label : undefined,
                sources: [sourceEntry]
            });
        } else {
            existing.sources.push(sourceEntry);
            if (amt > existing.amount) existing.amount = amt;
            if (!existing.label && typeof a.label === "string") existing.label = a.label;
        }
    }
    const labels =
        deps.energyTypeLabels ??
        (typeof globalThis.CONFIG !== "undefined" && globalThis.CONFIG?.THIRDERA?.energyTypes) ??
        {};
    return [...map.values()].map(row => ({
        energyType: row.energyType,
        amount: row.amount,
        label: row.label ?? (typeof labels[row.energyType] === "string" ? `${labels[row.energyType]} ${row.amount}` : `${row.energyType} ${row.amount}`),
        sources: dedupeCgsSourceEntries(row.sources)
    }));
}

/**
 * Merge damage reduction grants: keep all rows, each with value + bypass + sources.
 * Consumer (combat resolution) picks best applicable DR from the list.
 *
 * @typedef {{ value: number, bypass: string, label: string, sources: CgsSourceEntry[] }} MergedDamageReductionRow
 * @param {Array<{ value: number, bypass?: string, label?: string, _source: CgsSourceEntry }>} atoms
 * @param {{ drBypassLabels?: Record<string, string> }} [deps]
 * @returns {MergedDamageReductionRow[]}
 */
export function mergeDamageReductionRows(atoms, deps = {}) {
    if (!Array.isArray(atoms) || atoms.length === 0) return [];
    /** @type {Map<string, { value: number, bypass: string, label?: string, sources: CgsSourceEntry[] }>} */
    const map = new Map();
    for (const a of atoms) {
        if (!a || typeof a !== "object") continue;
        const val = typeof a.value === "number" && Number.isFinite(a.value) ? a.value : 0;
        if (val <= 0) continue;
        const byp = typeof a.bypass === "string" ? a.bypass.trim() : "";
        const key = `${val}\0${byp.toLowerCase()}`;
        const src = a._source && typeof a._source === "object" ? a._source : { label: "Unknown source" };
        const label = typeof src.label === "string" ? src.label : "Unknown source";
        /** @type {CgsSourceEntry} */
        const sourceEntry = { label };
        if (src.sourceRef && typeof src.sourceRef === "object") sourceEntry.sourceRef = src.sourceRef;

        const existing = map.get(key);
        if (!existing) {
            map.set(key, {
                value: val,
                bypass: byp,
                label: typeof a.label === "string" ? a.label : undefined,
                sources: [sourceEntry]
            });
        } else {
            existing.sources.push(sourceEntry);
            if (!existing.label && typeof a.label === "string") existing.label = a.label;
        }
    }
    const labels =
        deps.drBypassLabels ??
        (typeof globalThis.CONFIG !== "undefined" && globalThis.CONFIG?.THIRDERA?.drBypassTypes) ??
        {};
    return [...map.values()].map(row => {
        const bypLabel = row.bypass ? (typeof labels[row.bypass] === "string" ? labels[row.bypass] : row.bypass) : "—";
        return {
            value: row.value,
            bypass: row.bypass,
            label: row.label ?? `${row.value}/${bypLabel}`,
            sources: dedupeCgsSourceEntries(row.sources)
        };
    });
}

/**
 * Merge creature type overlay grants: dedupe by type document UUID; merged sources (templates, items, actor rows).
 * V1 semantics: additive with primary type — see cgs-implementation.md §5.1.
 *
 * @param {Array<{ typeUuid: string, label?: string, _source: CgsSourceEntry }>} atoms
 * @param {{ creatureTypeItemLabels?: Record<string, string> }} [deps]
 * @returns {MergedCreatureTypeOverlayRow[]}
 */
export function mergeCreatureTypeOverlayRows(atoms, deps = {}) {
    if (!Array.isArray(atoms) || atoms.length === 0) return [];
    /** @type {Map<string, { typeUuid: string, label?: string, sources: CgsSourceEntry[] }>} */
    const map = new Map();
    for (const a of atoms) {
        if (!a || typeof a !== "object") continue;
        const id = typeof a.typeUuid === "string" ? a.typeUuid.trim() : "";
        if (!id) continue;
        const src = a._source && typeof a._source === "object" ? a._source : { label: "Unknown source" };
        const label = typeof src.label === "string" ? src.label : "Unknown source";
        /** @type {CgsSourceEntry} */
        const sourceEntry = { label };
        if (src.sourceRef && typeof src.sourceRef === "object") sourceEntry.sourceRef = src.sourceRef;

        const existing = map.get(id);
        if (!existing) {
            map.set(id, {
                typeUuid: id,
                label: typeof a.label === "string" ? a.label : undefined,
                sources: [sourceEntry]
            });
        } else {
            existing.sources.push(sourceEntry);
            if (!existing.label && typeof a.label === "string") existing.label = a.label;
        }
    }
    const labels = deps.creatureTypeItemLabels && typeof deps.creatureTypeItemLabels === "object" ? deps.creatureTypeItemLabels : {};
    return [...map.values()].map(row => ({
        typeUuid: row.typeUuid,
        label: row.label ?? (typeof labels[row.typeUuid] === "string" ? labels[row.typeUuid] : row.typeUuid),
        sources: dedupeCgsSourceEntries(row.sources)
    }));
}

/**
 * Merge subtype overlay grants: dedupe by subtype document UUID; merged sources.
 * V1 semantics: additive with primary subtypes — see cgs-implementation.md §5.1.
 *
 * @param {Array<{ subtypeUuid: string, label?: string, _source: CgsSourceEntry }>} atoms
 * @param {{ subtypeItemLabels?: Record<string, string> }} [deps]
 * @returns {MergedSubtypeOverlayRow[]}
 */
export function mergeSubtypeOverlayRows(atoms, deps = {}) {
    if (!Array.isArray(atoms) || atoms.length === 0) return [];
    /** @type {Map<string, { subtypeUuid: string, label?: string, sources: CgsSourceEntry[] }>} */
    const map = new Map();
    for (const a of atoms) {
        if (!a || typeof a !== "object") continue;
        const id = typeof a.subtypeUuid === "string" ? a.subtypeUuid.trim() : "";
        if (!id) continue;
        const src = a._source && typeof a._source === "object" ? a._source : { label: "Unknown source" };
        const label = typeof src.label === "string" ? src.label : "Unknown source";
        /** @type {CgsSourceEntry} */
        const sourceEntry = { label };
        if (src.sourceRef && typeof src.sourceRef === "object") sourceEntry.sourceRef = src.sourceRef;

        const existing = map.get(id);
        if (!existing) {
            map.set(id, {
                subtypeUuid: id,
                label: typeof a.label === "string" ? a.label : undefined,
                sources: [sourceEntry]
            });
        } else {
            existing.sources.push(sourceEntry);
            if (!existing.label && typeof a.label === "string") existing.label = a.label;
        }
    }
    const labels = deps.subtypeItemLabels && typeof deps.subtypeItemLabels === "object" ? deps.subtypeItemLabels : {};
    return [...map.values()].map(row => ({
        subtypeUuid: row.subtypeUuid,
        label: row.label ?? (typeof labels[row.subtypeUuid] === "string" ? labels[row.subtypeUuid] : row.subtypeUuid),
        sources: dedupeCgsSourceEntries(row.sources)
    }));
}

/**
 * Stage B: remove sense rows whose type is covered by active `senseSuppression` grants (union of scopes).
 * `suppressionGrants` entries are raw grants with `_suppressingSource` from merge (contribution provenance).
 *
 * @param {MergedSenseRow[]} stageARows
 * @param {Array<Record<string, unknown>>} suppressionGrants
 * @param {{ senseTypeLabels?: Record<string, string>, allVisionSenseTypeKeys?: string[] }} [deps]
 * @returns {{ effectiveRows: MergedSenseRow[], suppressedSenseRows: Array<{ senseLabel: string, senseType: string, range: string, sources: CgsSourceEntry[], suppressingSources: CgsSourceEntry[] }> }}
 */
export function applySenseSuppressions(stageARows, suppressionGrants, deps = {}) {
    const fromLabels = deps.senseTypeLabels && typeof deps.senseTypeLabels === "object"
        ? Object.keys(deps.senseTypeLabels).map(k => String(k).trim()).filter(Boolean)
        : [];
    const keys =
        Array.isArray(deps.allVisionSenseTypeKeys) && deps.allVisionSenseTypeKeys.length > 0
            ? deps.allVisionSenseTypeKeys.map(k => String(k).trim()).filter(Boolean)
            : fromLabels.length > 0
              ? fromLabels
              : [...CGS_DEFAULT_ALL_VISION_SENSE_TYPE_KEYS];
    const allVisionSet = new Set(keys);

    /** @type {CgsSourceEntry[]} */
    const allVisionSources = [];
    /** @type {Map<string, CgsSourceEntry[]>} */
    const typeToSources = new Map();

    for (const raw of suppressionGrants) {
        if (!raw || typeof raw !== "object") continue;
        if (raw.category !== "senseSuppression") continue;
        const srcRaw = raw._suppressingSource;
        /** @type {CgsSourceEntry} */
        const src =
            srcRaw && typeof srcRaw === "object"
                ? {
                      label: typeof srcRaw.label === "string" ? srcRaw.label : "Unknown source",
                      ...(srcRaw.sourceRef && typeof srcRaw.sourceRef === "object"
                          ? { sourceRef: srcRaw.sourceRef }
                          : {})
                  }
                : { label: "Unknown source" };

        if (raw.scope === "allVision") {
            allVisionSources.push(src);
            continue;
        }
        const sc = raw.scope;
        if (sc && typeof sc === "object" && Array.isArray(sc.senseTypes)) {
            for (const t of sc.senseTypes) {
                const st = typeof t === "string" ? t.trim() : "";
                if (!st) continue;
                if (!typeToSources.has(st)) typeToSources.set(st, []);
                typeToSources.get(st).push(src);
            }
        }
    }

    /**
     * @param {string} senseType
     * @returns {CgsSourceEntry[]}
     */
    function suppressingSourcesForSenseType(senseType) {
        /** @type {CgsSourceEntry[]} */
        const out = [];
        if (allVisionSources.length > 0 && allVisionSet.has(senseType)) {
            out.push(...allVisionSources);
        }
        const partial = typeToSources.get(senseType);
        if (partial) out.push(...partial);
        return dedupeCgsSourceEntries(out);
    }

    /** @type {MergedSenseRow[]} */
    const effectiveRows = [];
    /** @type {Array<{ senseLabel: string, senseType: string, range: string, sources: CgsSourceEntry[], suppressingSources: CgsSourceEntry[] }>} */
    const suppressedSenseRows = [];

    for (const row of stageARows) {
        const st = typeof row.senseType === "string" ? row.senseType.trim() : "";
        if (!st) continue;
        const supSrc = suppressingSourcesForSenseType(st);
        if (supSrc.length > 0) {
            suppressedSenseRows.push({
                senseLabel: typeof row.label === "string" ? row.label : "",
                senseType: st,
                range: typeof row.range === "string" ? row.range : "",
                sources: Array.isArray(row.sources) ? row.sources : [],
                suppressingSources: supSrc
            });
        } else {
            effectiveRows.push(row);
        }
    }

    return { effectiveRows, suppressedSenseRows };
}

/**
 * @param {unknown} raw
 * @returns {CapabilityContribution | null}
 */
function normalizeContribution(raw) {
    if (!raw || typeof raw !== "object") return null;
    const label = typeof raw.label === "string" ? raw.label : "";
    const grants = Array.isArray(raw.grants) ? raw.grants : [];
    if (grants.length === 0 && !label.trim()) return null;
    const sourceRef = raw.sourceRef && typeof raw.sourceRef === "object" ? raw.sourceRef : undefined;
    /** @type {CapabilityContribution} */
    const out = { label, grants };
    if (sourceRef) out.sourceRef = sourceRef;
    return out;
}

/**
 * Run capability source providers and collect normalized contributions.
 * One throwing provider does not prevent others from running (same pattern as getActiveModifiers).
 *
 * @param {unknown} actor
 * @param {Array<(actor: unknown) => unknown>} providers
 * @param {{ warn?: typeof console.warn }} [deps]
 * @returns {CapabilityContribution[]}
 */
export function collectCapabilityContributions(actor, providers, deps = {}) {
    const warn = deps.warn ?? console.warn.bind(console);
    const list = Array.isArray(providers) ? providers : [];
    /** @type {CapabilityContribution[]} */
    const out = [];
    for (const provider of list) {
        try {
            const result = provider(actor);
            if (Array.isArray(result)) {
                for (const c of result) {
                    const n = normalizeContribution(c);
                    if (n) out.push(n);
                }
            } else if (result && typeof result === "object" && Array.isArray(result.contributions)) {
                for (const c of result.contributions) {
                    const n = normalizeContribution(c);
                    if (n) out.push(n);
                }
            }
        } catch (e) {
            warn("ThirdEra | Capability grant provider error:", e);
        }
    }
    return out;
}

/**
 * Merge collected contributions into per-category CGS output.
 * Senses: Stage A union → Stage B suppression; `senses.rows` effective, `senses.sensesUnionRows` pre-B.
 * Phase 5e: immunities (set by tag), energyResistance (max per type), damageReduction (keep all rows).
 * Phase 5f: creatureTypeOverlay / subtypeOverlay (dedupe by UUID, merged sources).
 *
 * @param {CapabilityContribution[]} contributions
 * @param {{ senseTypeLabels?: Record<string, string>, allVisionSenseTypeKeys?: string[], immunityTagLabels?: Record<string, string>, energyTypeLabels?: Record<string, string>, drBypassLabels?: Record<string, string>, creatureTypeItemLabels?: Record<string, string>, subtypeItemLabels?: Record<string, string> }} [deps]
 * @returns {CapabilityGrantsResult}
 */
export function mergeCapabilityGrantContributions(contributions, deps = {}) {
    const out = createEmptyCapabilityGrants();
    /** @type {Array<{ senseType: string, range?: string, label?: string, _source: CgsSourceEntry }>} */
    const senseAtoms = [];
    /** @type {Array<{ spellUuid: string, label?: string, usesPerDay?: number, atWill?: boolean, casterLevel?: number, classItemId?: string, _source: CgsSourceEntry }>} */
    const spellGrantAtoms = [];
    /** @type {Array<{ tag: string, label?: string, _source: CgsSourceEntry }>} */
    const immunityAtoms = [];
    /** @type {Array<{ energyType: string, amount: number, label?: string, _source: CgsSourceEntry }>} */
    const energyResistanceAtoms = [];
    /** @type {Array<{ value: number, bypass?: string, label?: string, _source: CgsSourceEntry }>} */
    const damageReductionAtoms = [];
    /** @type {Array<{ typeUuid: string, label?: string, _source: CgsSourceEntry }>} */
    const creatureTypeOverlayAtoms = [];
    /** @type {Array<{ subtypeUuid: string, label?: string, _source: CgsSourceEntry }>} */
    const subtypeOverlayAtoms = [];

    for (const c of contributions) {
        const srcLabel = typeof c.label === "string" ? c.label : "";
        const contributionSourceRef = c.sourceRef && typeof c.sourceRef === "object" ? c.sourceRef : undefined;
        /** @type {CgsSourceEntry} */
        const baseSource = { label: srcLabel.trim() || "Unknown source" };
        if (contributionSourceRef) baseSource.sourceRef = contributionSourceRef;

        for (const g of c.grants) {
            if (!g || typeof g !== "object") continue;
            const cat = g.category;
            if (cat === "sense") {
                const senseType = typeof g.senseType === "string" ? g.senseType.trim() : "";
                if (!senseType) continue;
                senseAtoms.push({
                    senseType,
                    range: typeof g.range === "string" ? g.range : "",
                    label: typeof g.label === "string" ? g.label : undefined,
                    _source: baseSource
                });
            } else if (cat === "senseSuppression") {
                const entry = cloneSenseSuppressionGrantForMerge(g);
                entry._suppressingSource = baseSource;
                out.senseSuppressions.grants.push(entry);
            } else if (cat === "spellGrant") {
                const spellUuid = typeof g.spellUuid === "string" ? g.spellUuid.trim() : "";
                if (!spellUuid) continue;
                const usesPerDay = normalizeCgsSpellGrantUsesPerDay(g.usesPerDay);
                const cl = g.casterLevel;
                const casterLevel = typeof cl === "number" && Number.isFinite(cl) ? cl : undefined;
                const classItemIdRaw = g.classItemId;
                const classItemId = typeof classItemIdRaw === "string" ? classItemIdRaw.trim() : "";
                spellGrantAtoms.push({
                    spellUuid,
                    label: typeof g.label === "string" ? g.label : undefined,
                    ...(usesPerDay !== undefined ? { usesPerDay } : {}),
                    ...(g.atWill === true ? { atWill: true } : {}),
                    ...(casterLevel !== undefined ? { casterLevel } : {}),
                    ...(classItemId ? { classItemId } : {}),
                    _source: baseSource
                });
            } else if (cat === "immunity") {
                const tag = typeof g.tag === "string" ? g.tag.trim() : "";
                if (!tag) continue;
                immunityAtoms.push({
                    tag,
                    label: typeof g.label === "string" ? g.label : undefined,
                    _source: baseSource
                });
            } else if (cat === "energyResistance") {
                const energyType = typeof g.energyType === "string" ? g.energyType.trim() : "";
                if (!energyType) continue;
                const amount = typeof g.amount === "number" && Number.isFinite(g.amount) ? g.amount : 0;
                energyResistanceAtoms.push({
                    energyType,
                    amount,
                    label: typeof g.label === "string" ? g.label : undefined,
                    _source: baseSource
                });
            } else if (cat === "damageReduction") {
                const value = typeof g.value === "number" && Number.isFinite(g.value) ? g.value : 0;
                if (value <= 0) continue;
                damageReductionAtoms.push({
                    value,
                    bypass: typeof g.bypass === "string" ? g.bypass : "",
                    label: typeof g.label === "string" ? g.label : undefined,
                    _source: baseSource
                });
            } else if (cat === "creatureTypeOverlay") {
                const typeUuid = typeof g.typeUuid === "string" ? g.typeUuid.trim() : "";
                if (!typeUuid) continue;
                creatureTypeOverlayAtoms.push({
                    typeUuid,
                    label: typeof g.label === "string" ? g.label : undefined,
                    _source: baseSource
                });
            } else if (cat === "subtypeOverlay") {
                const subtypeUuid = typeof g.subtypeUuid === "string" ? g.subtypeUuid.trim() : "";
                if (!subtypeUuid) continue;
                subtypeOverlayAtoms.push({
                    subtypeUuid,
                    label: typeof g.label === "string" ? g.label : undefined,
                    _source: baseSource
                });
            }
        }
    }

    out.spellGrants.rows = mergeSpellGrantRows(spellGrantAtoms);
    out.immunities.rows = mergeImmunityRows(immunityAtoms, { immunityTagLabels: deps.immunityTagLabels });
    out.energyResistance.rows = mergeEnergyResistanceRows(energyResistanceAtoms, { energyTypeLabels: deps.energyTypeLabels });
    out.damageReduction.rows = mergeDamageReductionRows(damageReductionAtoms, { drBypassLabels: deps.drBypassLabels });
    out.creatureTypeOverlays.rows = mergeCreatureTypeOverlayRows(creatureTypeOverlayAtoms, {
        creatureTypeItemLabels: deps.creatureTypeItemLabels
    });
    out.subtypeOverlays.rows = mergeSubtypeOverlayRows(subtypeOverlayAtoms, {
        subtypeItemLabels: deps.subtypeItemLabels
    });

    const sensesUnionRows = mergeSenseRows(senseAtoms, deps);
    const { effectiveRows, suppressedSenseRows } = applySenseSuppressions(
        sensesUnionRows,
        out.senseSuppressions.grants,
        deps
    );
    out.senses.sensesUnionRows = sensesUnionRows;
    out.senses.rows = effectiveRows;
    out.senses.suppressed = suppressedSenseRows;
    return out;
}

/**
 * Aggregated structured capability grants for an actor (derived consumers use this entry point).
 *
 * @param {unknown} actor
 * @param {{ providers?: Array<(a: unknown) => unknown>, warn?: typeof console.warn, senseTypeLabels?: Record<string, string>, allVisionSenseTypeKeys?: string[], immunityTagLabels?: Record<string, string>, energyTypeLabels?: Record<string, string>, drBypassLabels?: Record<string, string>, creatureTypeItemLabels?: Record<string, string>, subtypeItemLabels?: Record<string, string> }} [deps]
 *   When `providers` is omitted, uses CONFIG.THIRDERA.capabilitySourceProviders (Foundry init).
 * @returns {CapabilityGrantsResult}
 */
export function getActiveCapabilityGrants(actor, deps = {}) {
    const warn = deps.warn ?? (typeof console !== "undefined" && console.warn?.bind?.(console)) ?? (() => {});
    try {
        const providers =
            deps.providers ??
            (typeof globalThis.CONFIG !== "undefined" && globalThis.CONFIG?.THIRDERA?.capabilitySourceProviders) ??
            [];
        const contributions = collectCapabilityContributions(actor, providers, { warn: deps.warn });
        const cfg = typeof globalThis.CONFIG !== "undefined" ? globalThis.CONFIG?.THIRDERA : undefined;
        return mergeCapabilityGrantContributions(contributions, {
            senseTypeLabels: deps.senseTypeLabels,
            allVisionSenseTypeKeys: deps.allVisionSenseTypeKeys,
            immunityTagLabels: deps.immunityTagLabels ?? cfg?.immunityTags,
            energyTypeLabels: deps.energyTypeLabels ?? cfg?.energyTypes,
            drBypassLabels: deps.drBypassLabels ?? cfg?.drBypassTypes,
            creatureTypeItemLabels: deps.creatureTypeItemLabels,
            subtypeItemLabels: deps.subtypeItemLabels
        });
    } catch (e) {
        warn("ThirdEra | getActiveCapabilityGrants failed:", e);
        return createEmptyCapabilityGrants();
    }
}

/**
 * Expose frozen category id list on CONFIG and ensure the provider registry array exists.
 * Call once from Hooks.once("init") after CONFIG.THIRDERA is assigned. Phase 1 registers no built-in providers.
 */
export function registerCapabilitySourceProviders() {
    const cfg = globalThis.CONFIG;
    if (!cfg?.THIRDERA) return;
    cfg.THIRDERA.capabilityGrantCategoryIds = Object.freeze([...CGS_CAPABILITY_CATEGORY_IDS]);
    if (!Array.isArray(cfg.THIRDERA.capabilitySourceProviders)) {
        cfg.THIRDERA.capabilitySourceProviders = [];
    }
}
