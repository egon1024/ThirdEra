/**
 * Custom defense labels (hybrid with CONFIG) — merge display labels for immunity tags,
 * energy types (including energy resistance type strings), and DR bypass keys from optional
 * Item documents (`defenseCatalog` type; UI: Custom defense labels).
 *
 * @see .cursor/plans/cgs-phased-implementation.md (Future — Typed defense catalogs)
 */

/** @type {readonly string[]} */
export const DEFENSE_CATALOG_KINDS = Object.freeze(["immunityTag", "energyType", "energyResistance", "drBypass"]);

/**
 * Best-effort machine key from item name when no catalogKey is authored on create.
 * Splits on non-alphanumeric, lowercases first word, uppercases following word starts → camelCase
 * (e.g. "Cold iron" → "coldIron", "Fire" → "fire"). May not match every CONFIG grant key;
 * compendium JSON can still set catalogKey explicitly.
 *
 * @param {string | undefined | null} name
 * @returns {string}
 */
export function defaultCatalogKeyFromDisplayName(name) {
    const raw = typeof name === "string" ? name.trim() : "";
    if (!raw) return "";
    const parts = raw
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
    if (!parts.length) return "";
    return parts[0] + parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

/**
 * @param {Record<string, string> | undefined} base
 * @param {Record<string, string> | undefined} override
 * @returns {Record<string, string>}
 */
export function mergeStringLabelRecords(base, override) {
    const a = base && typeof base === "object" ? base : {};
    const b = override && typeof override === "object" ? override : {};
    return { ...a, ...b };
}

/**
 * @param {Array<{ name?: string, system?: { catalogKey?: string, catalogKind?: string } }>} docs
 * @returns {{ immunityTagLabels: Record<string, string>, energyTypeLabels: Record<string, string>, drBypassLabels: Record<string, string> }}
 */
export function buildTypedDefenseCatalogMapsFromPlainDocs(docs) {
    /** @type {Record<string, string>} */
    const immunityTagLabels = {};
    /** @type {Record<string, string>} */
    const energyTypeLabels = {};
    /** @type {Record<string, string>} */
    const drBypassLabels = {};
    if (!Array.isArray(docs)) {
        return { immunityTagLabels, energyTypeLabels, drBypassLabels };
    }
    for (const doc of docs) {
        const key = typeof doc?.system?.catalogKey === "string" ? doc.system.catalogKey.trim() : "";
        const kind = typeof doc?.system?.catalogKind === "string" ? doc.system.catalogKind.trim() : "";
        if (!key) continue;
        const label =
            typeof doc.name === "string" && doc.name.trim() ? doc.name.trim() : key;
        if (kind === "immunityTag") immunityTagLabels[key] = label;
        else if (kind === "energyType" || kind === "energyResistance") energyTypeLabels[key] = label;
        else if (kind === "drBypass") drBypassLabels[key] = label;
    }
    return { immunityTagLabels, energyTypeLabels, drBypassLabels };
}

/**
 * @param {{
 *   immunityTags?: Record<string, string>,
 *   energyTypes?: Record<string, string>,
 *   drBypassTypes?: Record<string, string>
 * } | undefined} configThirdera
 * @param {{ immunityTagLabels?: Record<string, string>, energyTypeLabels?: Record<string, string>, drBypassLabels?: Record<string, string> } | undefined} catalog
 */
export function mergeConfigAndTypedDefenseCatalogMaps(configThirdera, catalog) {
    const cfg = configThirdera && typeof configThirdera === "object" ? configThirdera : {};
    const cat = catalog && typeof catalog === "object" ? catalog : {};
    return {
        immunityTagLabels: mergeStringLabelRecords(cfg.immunityTags, cat.immunityTagLabels),
        energyTypeLabels: mergeStringLabelRecords(cfg.energyTypes, cat.energyTypeLabels),
        drBypassLabels: mergeStringLabelRecords(cfg.drBypassTypes, cat.drBypassLabels)
    };
}
