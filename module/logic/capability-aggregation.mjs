/**
 * Capability Grant System (CGS) — aggregation core (parallel to GMS / modifier-aggregation).
 * Structured grants with per-category merge and provenance; numeric modifiers stay in getActiveModifiers.
 *
 * Phase 2: senses Stage A (union + dedupe by senseType + normalized range), provenance on rows;
 * senseSuppression grants collected (unchanged list) for Phase 5a Stage B — suppression not applied yet.
 *
 * @typedef {{ label: string, grants: unknown[], sourceRef?: Record<string, unknown> }} CapabilityContribution
 * @typedef {{ label: string, sourceRef?: Record<string, unknown> }} CgsSourceEntry
 * @typedef {{ senseType: string, range: string, label: string, sources: CgsSourceEntry[] }} MergedSenseRow
 * @typedef {Record<string, { rows?: unknown[], grants?: unknown[] }>} CapabilityGrantsResult
 *
 * @see .cursor/plans/cgs-implementation.md
 * @see .cursor/plans/cgs-phased-implementation.md
 */

// ---------------------------------------------------------------------------
// Registered output categories (stable keys on getActiveCapabilityGrants result)
// ---------------------------------------------------------------------------

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
        senses: { rows: [] },
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
 * Phase 2: senses (Stage A) + raw senseSuppression bucket; other categories empty.
 *
 * @param {CapabilityContribution[]} contributions
 * @param {{ senseTypeLabels?: Record<string, string> }} [deps]
 * @returns {CapabilityGrantsResult}
 */
export function mergeCapabilityGrantContributions(contributions, deps = {}) {
    const out = createEmptyCapabilityGrants();
    /** @type {Array<{ senseType: string, range?: string, label?: string, _source: CgsSourceEntry }>} */
    const senseAtoms = [];

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
                out.senseSuppressions.grants.push(
                    typeof structuredClone === "function" ? structuredClone(g) : { ...g }
                );
            }
        }
    }

    out.senses.rows = mergeSenseRows(senseAtoms, deps);
    return out;
}

/**
 * Aggregated structured capability grants for an actor (derived consumers use this entry point).
 *
 * @param {unknown} actor
 * @param {{ providers?: Array<(a: unknown) => unknown>, warn?: typeof console.warn, senseTypeLabels?: Record<string, string> }} [deps]
 *   When `providers` is omitted, uses CONFIG.THIRDERA.capabilitySourceProviders (Foundry init).
 * @returns {CapabilityGrantsResult}
 */
export function getActiveCapabilityGrants(actor, deps = {}) {
    const providers =
        deps.providers ??
        (typeof globalThis.CONFIG !== "undefined" && globalThis.CONFIG?.THIRDERA?.capabilitySourceProviders) ??
        [];
    const contributions = collectCapabilityContributions(actor, providers, { warn: deps.warn });
    return mergeCapabilityGrantContributions(contributions, {
        senseTypeLabels: deps.senseTypeLabels
    });
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
