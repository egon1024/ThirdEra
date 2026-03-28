/**
 * Capability Grant System (CGS) — aggregation core (parallel to GMS / modifier-aggregation).
 * Structured grants with per-category merge and provenance; numeric modifiers stay in getActiveModifiers.
 *
 * Phase 1: registry, provider collection with error isolation, stable empty merged output per category.
 * Per-category merge (senses, etc.) lands in later phases.
 *
 * @typedef {{ label: string, grants: unknown[], sourceRef?: Record<string, unknown> }} CapabilityContribution
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
 * Phase 1: always returns the stable empty structure (merge rules added in Phase 2+).
 *
 * @param {CapabilityContribution[]} _contributions
 * @returns {CapabilityGrantsResult}
 */
export function mergeCapabilityGrantContributions(_contributions) {
    return createEmptyCapabilityGrants();
}

/**
 * Aggregated structured capability grants for an actor (derived consumers use this entry point).
 *
 * @param {unknown} actor
 * @param {{ providers?: Array<(a: unknown) => unknown>, warn?: typeof console.warn }} [deps]
 *   When `providers` is omitted, uses CONFIG.THIRDERA.capabilitySourceProviders (Foundry init).
 * @returns {CapabilityGrantsResult}
 */
export function getActiveCapabilityGrants(actor, deps = {}) {
    const providers =
        deps.providers ??
        (typeof globalThis.CONFIG !== "undefined" && globalThis.CONFIG?.THIRDERA?.capabilitySourceProviders) ??
        [];
    const contributions = collectCapabilityContributions(actor, providers, { warn: deps.warn });
    return mergeCapabilityGrantContributions(contributions);
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
