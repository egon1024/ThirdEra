/**
 * Pure helpers to resolve CGS compendium reference keys to UUIDs (creature types,
 * subtypes, spells) for JSON authoring. Used by CompendiumLoader after packs load.
 */

/**
 * @param {Array<{ system?: { key?: string }, uuid?: string }>} typeDocs
 * @returns {Map<string, string>}
 */
export function buildCreatureTypeKeyToUuidMap(typeDocs) {
    const m = new Map();
    if (!Array.isArray(typeDocs)) return m;
    for (const doc of typeDocs) {
        const k = typeof doc.system?.key === "string" ? doc.system.key.trim() : "";
        const u = typeof doc.uuid === "string" ? doc.uuid.trim() : "";
        if (k && u) m.set(k, u);
    }
    return m;
}

/**
 * @param {Array<{ system?: { key?: string }, uuid?: string }>} subtypeDocs
 * @returns {Map<string, string>}
 */
export function buildSubtypeKeyToUuidMap(subtypeDocs) {
    return buildCreatureTypeKeyToUuidMap(subtypeDocs);
}

/**
 * @param {Array<{ system?: { key?: string }, uuid?: string }>} spellDocs
 * @returns {Map<string, string>}
 */
export function buildSpellKeyToUuidMap(spellDocs) {
    const m = new Map();
    if (!Array.isArray(spellDocs)) return m;
    for (const doc of spellDocs) {
        const k = typeof doc.system?.key === "string" ? doc.system.key.trim() : "";
        const u = typeof doc.uuid === "string" ? doc.uuid.trim() : "";
        if (k && u) m.set(k, u);
    }
    return m;
}

/**
 * Merge type + subtype keys into targetCreatureTypeUuids (spell targeting accepts both).
 *
 * @param {unknown} system - spell system data
 * @param {Map<string, string>} typeKeyToUuid
 * @param {Map<string, string>} subtypeKeyToUuid
 * @returns {{ targetCreatureTypeUuids: string[], clearTypeKeys: boolean, clearSubtypeKeys: boolean } | null}
 */
export function resolveSpellTargetCreatureKeys(system, typeKeyToUuid, subtypeKeyToUuid) {
    if (!system || typeof system !== "object") return null;
    const tck = system.targetCreatureTypeKeys;
    const sck = system.targetCreatureSubtypeKeys;
    const hasT = Array.isArray(tck) && tck.some((x) => String(x).trim());
    const hasS = Array.isArray(sck) && sck.some((x) => String(x).trim());
    if (!hasT && !hasS) return null;

    const set = new Set();
    const existing = system.targetCreatureTypeUuids;
    if (Array.isArray(existing)) {
        for (const u of existing) {
            const s = typeof u === "string" ? u.trim() : "";
            if (s) set.add(s);
        }
    }
    let unresolvedT = 0;
    if (Array.isArray(tck)) {
        for (const raw of tck) {
            const k = typeof raw === "string" ? raw.trim() : "";
            if (!k) continue;
            const u = typeKeyToUuid.get(k);
            if (u) set.add(u);
            else unresolvedT++;
        }
    }
    let unresolvedS = 0;
    if (Array.isArray(sck)) {
        for (const raw of sck) {
            const k = typeof raw === "string" ? raw.trim() : "";
            if (!k) continue;
            const u = subtypeKeyToUuid.get(k);
            if (u) set.add(u);
            else unresolvedS++;
        }
    }
    return {
        targetCreatureTypeUuids: [...set],
        clearTypeKeys: hasT && unresolvedT === 0,
        clearSubtypeKeys: hasS && unresolvedS === 0
    };
}

/**
 * Merge mechanical creature gate keys into mechanicalCreatureGateUuids.
 *
 * @param {unknown} system - armor / weapon / equipment system
 * @param {Map<string, string>} typeKeyToUuid
 * @param {Map<string, string>} subtypeKeyToUuid
 * @returns {{ mechanicalCreatureGateUuids: string[], clearTypeKeys: boolean, clearSubtypeKeys: boolean } | null}
 */
export function resolveMechanicalCreatureGateKeys(system, typeKeyToUuid, subtypeKeyToUuid) {
    if (!system || typeof system !== "object") return null;
    const gtk = system.mechanicalCreatureGateTypeKeys;
    const gsk = system.mechanicalCreatureGateSubtypeKeys;
    const hasT = Array.isArray(gtk) && gtk.some((x) => String(x).trim());
    const hasS = Array.isArray(gsk) && gsk.some((x) => String(x).trim());
    if (!hasT && !hasS) return null;
    const set = new Set();
    const existing = system.mechanicalCreatureGateUuids;
    if (Array.isArray(existing)) {
        for (const u of existing) {
            const s = typeof u === "string" ? u.trim() : "";
            if (s) set.add(s);
        }
    }
    let unresolvedT = 0;
    if (Array.isArray(gtk)) {
        for (const raw of gtk) {
            const k = typeof raw === "string" ? raw.trim() : "";
            if (!k) continue;
            const u = typeKeyToUuid.get(k);
            if (u) set.add(u);
            else unresolvedT++;
        }
    }
    let unresolvedS = 0;
    if (Array.isArray(gsk)) {
        for (const raw of gsk) {
            const k = typeof raw === "string" ? raw.trim() : "";
            if (!k) continue;
            const u = subtypeKeyToUuid.get(k);
            if (u) set.add(u);
            else unresolvedS++;
        }
    }
    return {
        mechanicalCreatureGateUuids: [...set],
        clearTypeKeys: hasT && unresolvedT === 0,
        clearSubtypeKeys: hasS && unresolvedS === 0
    };
}

/**
 * Resolve spellKey, typeKey, subtypeKey inside cgsGrants.grants[].
 *
 * @param {unknown[]} grants
 * @param {{ spellKeyToUuid: Map<string, string>, typeKeyToUuid: Map<string, string>, subtypeKeyToUuid: Map<string, string> }} maps
 * @returns {{ grants: unknown[], changed: boolean }}
 */
export function resolveCgsGrantReferenceKeys(grants, maps) {
    if (!Array.isArray(grants) || grants.length === 0) {
        return { grants: grants ?? [], changed: false };
    }
    const { spellKeyToUuid, typeKeyToUuid, subtypeKeyToUuid } = maps;
    let changed = false;
    const out = grants.map((g) => {
        if (!g || typeof g !== "object") return g;
        const cat = g.category;
        if (cat === "spellGrant") {
            const su = typeof g.spellUuid === "string" ? g.spellUuid.trim() : "";
            const sk = typeof g.spellKey === "string" ? g.spellKey.trim() : "";
            if (su || !sk) return g;
            const uuid = spellKeyToUuid.get(sk);
            if (!uuid) return g;
            changed = true;
            const { spellKey: _omit, ...rest } = g;
            return { ...rest, spellUuid: uuid };
        }
        if (cat === "creatureTypeOverlay") {
            const tu = typeof g.typeUuid === "string" ? g.typeUuid.trim() : "";
            const tk = typeof g.typeKey === "string" ? g.typeKey.trim() : "";
            if (tu || !tk) return g;
            const uuid = typeKeyToUuid.get(tk);
            if (!uuid) return g;
            changed = true;
            const { typeKey: _omit, ...rest } = g;
            return { ...rest, typeUuid: uuid };
        }
        if (cat === "subtypeOverlay") {
            const su = typeof g.subtypeUuid === "string" ? g.subtypeUuid.trim() : "";
            const sk = typeof g.subtypeKey === "string" ? g.subtypeKey.trim() : "";
            if (su || !sk) return g;
            const uuid = subtypeKeyToUuid.get(sk);
            if (!uuid) return g;
            changed = true;
            const { subtypeKey: _omit, ...rest } = g;
            return { ...rest, subtypeUuid: uuid };
        }
        return g;
    });
    return { grants: out, changed };
}
