/**
 * CGS canonical templates + per-owned-item overrides (Option 1).
 *
 * ## Merge semantics (authoritative for runtime)
 *
 * **Inputs:** `template` and `overrides` are partial `cgsGrants`-shaped objects: `{ grants?: unknown[], senses?: unknown[] }`.
 * Arrays default to empty when missing. Unknown top-level keys are ignored.
 *
 * **Senses (`senses` rows):** Each row is `{ type?: string, range?: string }`. Match rows by **trimmed `type`**
 * (case-sensitive, same as compendium keys like `darkvision`). The first template row whose `type` matches an
 * override row is **shallow-merged** with that override (`{ ...templateRow, ...overrideRow }`), so override fields win.
 * Override sense rows whose `type` is not present in the template result are **appended** (no silent drop).
 *
 * **Typed defense / structured grants (`grants` rows):** Rows are plain objects with `category`. Replacement uses a
 * stable **merge key** per category (override replaces the first template row with the same key, else append):
 * - `sense` (grant-form): `sense|<senseType>`
 * - `spellGrant`: `spellGrant|<spellUuid>`
 * - `immunity`: `immunity|<tag>`
 * - `energyResistance`: `energyResistance|<energyType>`
 * - `damageReduction`: `damageReduction|<bypass>` (bypass normalized trimmed string; empty string groups “no bypass”)
 * - `creatureTypeOverlay`: `creatureTypeOverlay|<typeUuid>`
 * - `subtypeOverlay`: `subtypeOverlay|<subtypeUuid>`
 * - `senseSuppression`: `senseSuppression|<scope>|<senseTypes joined>` where `senseTypes` is sorted joined list when present
 * - **Unknown category:** `other|<category>|<stable JSON of row>` — collisions replace; unusual shapes should still append safely.
 *
 * **Override wins:** For matched rows, shallow merge means scalar/object fields on the override replace template fields.
 *
 * ## Template resolution (owned / embedded items)
 *
 * **UUID candidate order:** `system.cgsTemplateUuid` (trimmed) if non-empty, else `item.sourceId` (trimmed) when it looks
 * like a UUID / compendium id (contains `.` or starts with `Compendium.`).
 *
 * **When resolution runs:** If **any** of:
 * - `system.cgsGrantOverrides` has a non-empty `grants` or `senses` array, or
 * - `system.cgsTemplateUuid` is a non-empty string, or
 * - `system.cgsGrants` has **both** `grants` and `senses` empty (or missing) **and** a UUID candidate exists
 *
 * then the code attempts `deps.fromUuidSync(candidate)` (injected in tests). On success, the returned **Item**’s
 * `system.cgsGrants` becomes the **template base**. On failure, the base falls back to the owned item’s own
 * `system.cgsGrants`.
 *
 * **When resolution does not run:** If none of the above hold, the owned item’s `system.cgsGrants` is the base (legacy
 * behavior: fully materialized grants on the item).
 *
 * After base selection, **`mergeCgsGrantsTemplateWithOverrides(base, overrides)`** always runs (empty overrides is a no-op
 * aside from copying).
 *
 * @see module/logic/cgs-owned-item-grants.mjs
 */

/**
 * @param {unknown} v
 * @returns {{ grants: unknown[], senses: unknown[] }}
 */
export function normalizeCgsGrantsShape(v) {
    if (!v || typeof v !== "object") return { grants: [], senses: [] };
    const g = /** @type {{ grants?: unknown, senses?: unknown }} */ (v).grants;
    const s = /** @type {{ grants?: unknown, senses?: unknown }} */ (v).senses;
    return {
        grants: Array.isArray(g) ? g.slice() : [],
        senses: Array.isArray(s) ? s.slice() : []
    };
}

/**
 * @param {unknown} row
 * @returns {string}
 */
export function cgsGrantRowMergeKey(row) {
    if (!row || typeof row !== "object") return "other||";
    const r = /** @type {Record<string, unknown>} */ (row);
    const cat = typeof r.category === "string" ? r.category.trim() : "";
    const trim = (x) => (typeof x === "string" ? x.trim() : "");

    if (cat === "sense") {
        return `sense|${trim(/** @type {{ senseType?: string }} */ (r).senseType)}`;
    }
    if (cat === "spellGrant") {
        return `spellGrant|${trim(/** @type {{ spellUuid?: string }} */ (r).spellUuid)}`;
    }
    if (cat === "immunity") {
        return `immunity|${trim(/** @type {{ tag?: string }} */ (r).tag)}`;
    }
    if (cat === "energyResistance") {
        return `energyResistance|${trim(/** @type {{ energyType?: string }} */ (r).energyType)}`;
    }
    if (cat === "damageReduction") {
        return `damageReduction|${trim(/** @type {{ bypass?: string }} */ (r).bypass)}`;
    }
    if (cat === "creatureTypeOverlay") {
        return `creatureTypeOverlay|${trim(/** @type {{ typeUuid?: string }} */ (r).typeUuid)}`;
    }
    if (cat === "subtypeOverlay") {
        return `subtypeOverlay|${trim(/** @type {{ subtypeUuid?: string }} */ (r).subtypeUuid)}`;
    }
    if (cat === "senseSuppression") {
        const scope = trim(/** @type {{ scope?: string }} */ (r).scope);
        const st = Array.isArray(r.senseTypes)
            ? /** @type {unknown[]} */ (r.senseTypes)
                  .map((x) => (typeof x === "string" ? x.trim() : ""))
                  .filter(Boolean)
                  .sort()
                  .join(",")
            : "";
        return `senseSuppression|${scope}|${st}`;
    }

    let stable = "";
    try {
        stable = JSON.stringify(r);
    } catch {
        stable = String(cat);
    }
    return `other|${cat}|${stable}`;
}

/**
 * @param {unknown} senseRow
 * @returns {string}
 */
function senseRowTypeKey(senseRow) {
    if (!senseRow || typeof senseRow !== "object") return "";
    const t = /** @type {{ type?: string }} */ (senseRow).type;
    return typeof t === "string" ? t.trim() : "";
}

/**
 * Deep-merge template + overrides into a new `{ grants, senses }` shape.
 * @param {unknown} template
 * @param {unknown} overrides
 * @returns {{ grants: unknown[], senses: unknown[] }}
 */
export function mergeCgsGrantsTemplateWithOverrides(template, overrides) {
    const base = normalizeCgsGrantsShape(template);
    const over = normalizeCgsGrantsShape(overrides);

    /** @type {unknown[]} */
    const sensesOut = base.senses.map((row) =>
        row && typeof row === "object" ? { .../** @type {object} */ (row) } : row
    );
    for (const oRow of over.senses) {
        const key = senseRowTypeKey(oRow);
        if (!key) {
            if (oRow && typeof oRow === "object") sensesOut.push({ .../** @type {object} */ (oRow) });
            continue;
        }
        const idx = sensesOut.findIndex((r) => senseRowTypeKey(r) === key);
        if (idx >= 0) {
            const cur = sensesOut[idx] && typeof sensesOut[idx] === "object" ? /** @type {object} */ (sensesOut[idx]) : {};
            const o = oRow && typeof oRow === "object" ? /** @type {object} */ (oRow) : {};
            sensesOut[idx] = { ...cur, ...o };
        } else {
            sensesOut.push(oRow && typeof oRow === "object" ? { .../** @type {object} */ (oRow) } : oRow);
        }
    }

    /** @type {unknown[]} */
    const grantsOut = base.grants.map((row) =>
        row && typeof row === "object" ? { .../** @type {object} */ (row) } : row
    );
    /** @type {Map<string, number>} */
    const keyToIndex = new Map();
    for (let i = 0; i < grantsOut.length; i++) {
        const row = grantsOut[i];
        if (!row || typeof row !== "object") continue;
        const k = cgsGrantRowMergeKey(row);
        if (!keyToIndex.has(k)) keyToIndex.set(k, i);
    }
    for (const oRow of over.grants) {
        if (!oRow || typeof oRow !== "object") continue;
        const k = cgsGrantRowMergeKey(oRow);
        const idx = keyToIndex.get(k);
        const o = /** @type {object} */ (oRow);
        if (idx !== undefined) {
            const cur = grantsOut[idx] && typeof grantsOut[idx] === "object" ? /** @type {object} */ (grantsOut[idx]) : {};
            grantsOut[idx] = { ...cur, ...o };
        } else {
            grantsOut.push({ ...o });
            keyToIndex.set(k, grantsOut.length - 1);
        }
    }

    return { grants: grantsOut, senses: sensesOut };
}

/**
 * @param {unknown} item
 * @returns {string}
 */
export function getOwnedItemCgsTemplateUuidCandidate(item) {
    if (!item || typeof item !== "object") return "";
    const sys = /** @type {{ cgsTemplateUuid?: string }} */ (
        /** @type {{ system?: { cgsTemplateUuid?: string }, sourceId?: string, flags?: { core?: { sourceId?: string } } }} */ (
            item
        ).system ?? {}
    );
    const explicit = typeof sys.cgsTemplateUuid === "string" ? sys.cgsTemplateUuid.trim() : "";
    if (explicit) return explicit;
    const sid = typeof /** @type {{ sourceId?: string }} */ (item).sourceId === "string" ? item.sourceId.trim() : "";
    if (sid && (sid.includes(".") || sid.startsWith("Compendium."))) return sid;
    const flags = /** @type {{ flags?: { core?: { sourceId?: string } } }} */ (item).flags;
    const coreSid = typeof flags?.core?.sourceId === "string" ? flags.core.sourceId.trim() : "";
    if (coreSid && (coreSid.includes(".") || coreSid.startsWith("Compendium."))) return coreSid;
    return "";
}

/**
 * @param {unknown} sys
 * @returns {boolean}
 */
export function hasNonEmptyCgsGrantOverrides(sys) {
    if (!sys || typeof sys !== "object") return false;
    const o = /** @type {{ cgsGrantOverrides?: { grants?: unknown, senses?: unknown } }} */ (sys).cgsGrantOverrides;
    if (!o || typeof o !== "object") return false;
    const g = o.grants;
    const s = o.senses;
    return (Array.isArray(g) && g.length > 0) || (Array.isArray(s) && s.length > 0);
}

/**
 * @param {unknown} sys
 * @returns {boolean}
 */
export function hasExplicitCgsTemplateUuid(sys) {
    if (!sys || typeof sys !== "object") return false;
    const u = /** @type {{ cgsTemplateUuid?: string }} */ (sys).cgsTemplateUuid;
    return typeof u === "string" && u.trim().length > 0;
}

/**
 * @param {unknown} localCgs
 * @returns {boolean}
 */
export function isCgsGrantsMaterializationEmpty(localCgs) {
    const n = normalizeCgsGrantsShape(localCgs);
    return n.grants.length === 0 && n.senses.length === 0;
}

/**
 * Whether template UUID resolution should run for this owned item.
 * @param {unknown} item
 * @returns {boolean}
 */
export function shouldResolveTemplateCgsGrants(item) {
    if (!item || typeof item !== "object") return false;
    const sys = /** @type {{ system?: unknown }} */ (item).system ?? {};
    const uuid = getOwnedItemCgsTemplateUuidCandidate(item);
    if (!uuid) return false;
    if (hasNonEmptyCgsGrantOverrides(sys)) return true;
    if (hasExplicitCgsTemplateUuid(sys)) return true;
    const local = /** @type {{ cgsGrants?: unknown }} */ (sys).cgsGrants;
    return isCgsGrantsMaterializationEmpty(local);
}

/**
 * @param {unknown} doc
 * @returns {{ grants: unknown[], senses: unknown[] } | null}
 */
export function readCgsGrantsShapeFromTemplateItem(doc) {
    if (!doc || typeof doc !== "object") return null;
    const dn = /** @type {{ documentName?: string }} */ (doc).documentName;
    if (dn && dn !== "Item") return null;
    const sys = /** @type {{ system?: { cgsGrants?: unknown } }} */ (doc).system;
    if (!sys || typeof sys !== "object") return null;
    const cg = sys.cgsGrants;
    if (!cg || typeof cg !== "object") return null;
    return normalizeCgsGrantsShape(cg);
}

/**
 * @param {unknown} item
 * @param {{ fromUuidSync?: (uuid: string) => unknown, _resolvedCache?: Map<string, unknown> }} [deps]
 * @returns {{ grants: unknown[], senses: unknown[] } | null} Null when not found or not an item with cgsGrants.
 */
export function resolveTemplateCgsGrantsShape(item, deps = {}) {
    const uuid = getOwnedItemCgsTemplateUuidCandidate(item);
    if (!uuid) return null;
    const cache = deps._resolvedCache;
    if (cache?.has(uuid)) {
        const hit = cache.get(uuid);
        return hit ? normalizeCgsGrantsShape(hit) : null;
    }
    const fromUuidSync =
        deps.fromUuidSync ??
        (typeof globalThis.foundry?.utils?.fromUuidSync === "function"
            ? (u) => globalThis.foundry.utils.fromUuidSync(u)
            : () => null);
    let doc = null;
    try {
        doc = fromUuidSync(uuid);
    } catch {
        doc = null;
    }
    const shape = readCgsGrantsShapeFromTemplateItem(doc);
    const normalized = shape ? normalizeCgsGrantsShape(shape) : null;
    if (cache && normalized) cache.set(uuid, normalized);
    return normalized;
}

/**
 * Effective `{ grants, senses }` after template resolution + overrides merge (no atom expansion).
 * @param {unknown} item
 * @param {{ fromUuidSync?: (uuid: string) => unknown, _resolvedCache?: Map<string, unknown> }} [deps]
 * @returns {{ grants: unknown[], senses: unknown[] }}
 */
export function getEffectiveCgsGrantShapeForOwnedItem(item, deps = {}) {
    const sys = item && typeof item === "object" ? /** @type {{ system?: unknown }} */ (item).system ?? {} : {};
    const local = /** @type {{ cgsGrants?: unknown, cgsGrantOverrides?: unknown }} */ (sys);
    const localShape = normalizeCgsGrantsShape(local.cgsGrants);
    const overrides = normalizeCgsGrantsShape(local.cgsGrantOverrides);

    let base = localShape;
    if (shouldResolveTemplateCgsGrants(item)) {
        const resolved = resolveTemplateCgsGrantsShape(item, deps);
        if (resolved) base = resolved;
    }
    return mergeCgsGrantsTemplateWithOverrides(base, overrides);
}
