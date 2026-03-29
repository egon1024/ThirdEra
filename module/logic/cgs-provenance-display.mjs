/**
 * CGS provenance display planning (Phase 4) — pure rules for who sees which source labels
 * and which UUIDs may become sheet links. HTML is built in the actor sheet (Handlebars SafeString).
 *
 * @typedef {{ label?: string, sourceRef?: Record<string, unknown> }} CgsProvenanceSourceEntry
 * @typedef {{ showLabel: boolean, linkUuid: string | null, useLabel: string }} CgsProvenanceSourcePlan
 *
 * @see .cursor/plans/cgs-implementation.md §7
 */

/**
 * @param {Record<string, unknown> | undefined} sourceRef
 * @returns {string | null}
 */
export function extractCgsSourceLinkUuid(sourceRef) {
    if (!sourceRef || typeof sourceRef !== "object") return null;
    const u = sourceRef.uuid;
    if (typeof u !== "string") return null;
    const t = u.trim();
    return t || null;
}

/**
 * Decide visibility and linking for one merged provenance source (senses and future categories).
 *
 * @param {CgsProvenanceSourceEntry | null | undefined} sourceEntry
 * @param {{
 *   isGM: boolean,
 *   user: unknown,
 *   sheetActor: { uuid?: string, testUserPermission?: (user: unknown, level: string) => boolean } | null | undefined,
 *   resolveUuid: (uuid: string) => { testUserPermission?: (user: unknown, level: string) => boolean, name?: string } | null | undefined
 * }} ctx
 * @returns {CgsProvenanceSourcePlan}
 */
export function planCgsSourceDisplay(sourceEntry, ctx) {
    const fallback = "Unknown source";
    const label = typeof sourceEntry?.label === "string" ? sourceEntry.label.trim() : "";
    const ref = sourceEntry?.sourceRef && typeof sourceEntry.sourceRef === "object" ? sourceEntry.sourceRef : undefined;
    const useLabel = label || fallback;

    if (ctx.isGM) {
        const linkUuid = extractCgsSourceLinkUuid(ref);
        return { showLabel: true, linkUuid, useLabel };
    }

    const canSeeSheetActor =
        ctx.sheetActor?.testUserPermission?.(ctx.user, "OBSERVER") === true;

    if (!ref) {
        return { showLabel: true, linkUuid: null, useLabel };
    }

    const kind = typeof ref.kind === "string" ? ref.kind : "";

    if (kind === "statBlock") {
        return { showLabel: true, linkUuid: null, useLabel };
    }

    if (kind === "actorCgsGrants") {
        if (!canSeeSheetActor) {
            return { showLabel: false, linkUuid: null, useLabel: fallback };
        }
        const linkUuid = extractCgsSourceLinkUuid(ref) ?? (typeof ctx.sheetActor?.uuid === "string" ? ctx.sheetActor.uuid.trim() || null : null);
        return { showLabel: true, linkUuid, useLabel };
    }

    const linkUuid = extractCgsSourceLinkUuid(ref);
    if (!linkUuid) {
        return { showLabel: true, linkUuid: null, useLabel };
    }

    const doc = ctx.resolveUuid(linkUuid);
    if (!doc || doc.testUserPermission?.(ctx.user, "OBSERVER") !== true) {
        return { showLabel: false, linkUuid: null, useLabel: fallback };
    }

    return {
        showLabel: true,
        linkUuid,
        useLabel: label || (typeof doc.name === "string" && doc.name.trim()) || fallback
    };
}

/**
 * @param {Array<{ label?: string, sources?: CgsProvenanceSourceEntry[] }> | null | undefined} rows
 * @param {Parameters<typeof planCgsSourceDisplay>[1]} ctx
 * @returns {Array<{ senseLabel: string, sources: CgsProvenanceSourcePlan[] }>}
 */
export function enrichCgsMergedSenseRowsForProvenance(rows, ctx) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => ({
        senseLabel: typeof row?.label === "string" ? row.label : "",
        sources: Array.isArray(row?.sources) ? row.sources.map((s) => planCgsSourceDisplay(s, ctx)) : []
    }));
}

/**
 * Phase 5a: suppressed sense rows (Stage B) — original sources + suppressing condition/item sources.
 *
 * @param {Array<{ senseLabel?: string, sources?: CgsProvenanceSourceEntry[], suppressingSources?: CgsProvenanceSourceEntry[] }> | null | undefined} rows
 * @param {Parameters<typeof planCgsSourceDisplay>[1]} ctx
 * @returns {Array<{ senseLabel: string, senseSources: CgsProvenanceSourcePlan[], suppressingSources: CgsProvenanceSourcePlan[] }>}
 */
export function enrichCgsSuppressedSenseRowsForProvenance(rows, ctx) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => ({
        senseLabel: typeof row?.senseLabel === "string" ? row.senseLabel : "",
        senseSources: Array.isArray(row?.sources) ? row.sources.map((s) => planCgsSourceDisplay(s, ctx)) : [],
        suppressingSources: Array.isArray(row?.suppressingSources)
            ? row.suppressingSources.map((s) => planCgsSourceDisplay(s, ctx))
            : []
    }));
}
