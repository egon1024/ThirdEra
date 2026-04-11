/**
 * Resolve display labels for CGS creature type / subtype overlay UUIDs (Phase 5f).
 * Used after a first `getActiveCapabilityGrants` pass to label merged overlay rows on the second pass.
 *
 * @param {{ creatureTypeOverlays?: { rows?: unknown[] }, subtypeOverlays?: { rows?: unknown[] } } | null | undefined} cgs
 * @param {{ fromUuidSync?: (uuid: string) => { type?: string, name?: string } | null | undefined }} [deps]
 * @returns {{ creatureTypeItemLabels: Record<string, string>, subtypeItemLabels: Record<string, string> }}
 */
export function buildCgsOverlayItemLabelMaps(cgs, deps = {}) {
    /** @type {Record<string, string>} */
    const creatureTypeItemLabels = {};
    /** @type {Record<string, string>} */
    const subtypeItemLabels = {};
    const fromUuid =
        deps.fromUuidSync ??
        (typeof globalThis.foundry !== "undefined" && globalThis.foundry?.utils?.fromUuidSync) ??
        null;
    if (typeof fromUuid !== "function") {
        return { creatureTypeItemLabels, subtypeItemLabels };
    }

    for (const r of cgs?.creatureTypeOverlays?.rows ?? []) {
        const u = typeof r?.typeUuid === "string" ? r.typeUuid.trim() : "";
        if (!u) continue;
        try {
            const doc = fromUuid(u);
            if (doc?.type === "creatureType" && typeof doc.name === "string" && doc.name.trim()) {
                creatureTypeItemLabels[u] = doc.name.trim();
            }
        } catch (_) {
            /* invalid uuid */
        }
    }
    for (const r of cgs?.subtypeOverlays?.rows ?? []) {
        const u = typeof r?.subtypeUuid === "string" ? r.subtypeUuid.trim() : "";
        if (!u) continue;
        try {
            const doc = fromUuid(u);
            if (doc?.type === "subtype" && typeof doc.name === "string" && doc.name.trim()) {
                subtypeItemLabels[u] = doc.name.trim();
            }
        } catch (_) {
            /* invalid uuid */
        }
    }
    return { creatureTypeItemLabels, subtypeItemLabels };
}
