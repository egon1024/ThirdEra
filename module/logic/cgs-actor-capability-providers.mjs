/**
 * Built-in CGS source providers for actor system data (Phase 2 — senses).
 * Registered from thirdera.mjs after registerCapabilitySourceProviders().
 *
 * @see .cursor/plans/cgs-implementation.md
 */

/**
 * Legacy NPC stat block senses → sense grants (merged with cgsGrants and future item providers).
 *
 * @param {unknown} actor
 * @returns {Array<{ label: string, grants: unknown[], sourceRef?: Record<string, unknown> }>}
 */
export function cgsNpcStatBlockSensesProvider(actor) {
    if (!actor || typeof actor !== "object" || actor.type !== "npc") return [];
    const senses = actor.system?.statBlock?.senses;
    if (!Array.isArray(senses) || senses.length === 0) return [];
    const grants = [];
    for (const s of senses) {
        if (!s || typeof s !== "object") continue;
        const t = typeof s.type === "string" ? s.type.trim() : "";
        if (!t) continue;
        grants.push({
            category: "sense",
            senseType: t,
            range: typeof s.range === "string" ? s.range : ""
        });
    }
    if (grants.length === 0) return [];
    return [
        {
            label: "Stat block",
            sourceRef: { kind: "statBlock" },
            grants
        }
    ];
}

/**
 * Actor-authored senses under system.cgsGrants.senses (PC + NPC).
 *
 * @param {unknown} actor
 * @returns {Array<{ label: string, grants: unknown[], sourceRef?: Record<string, unknown> }>}
 */
export function cgsActorCgsGrantsSensesProvider(actor) {
    if (!actor || typeof actor !== "object") return [];
    const senses = actor.system?.cgsGrants?.senses;
    if (!Array.isArray(senses) || senses.length === 0) return [];
    const grants = [];
    for (const s of senses) {
        if (!s || typeof s !== "object") continue;
        const t = typeof s.type === "string" ? s.type.trim() : "";
        if (!t) continue;
        grants.push({
            category: "sense",
            senseType: t,
            range: typeof s.range === "string" ? s.range : ""
        });
    }
    if (grants.length === 0) return [];
    return [
        {
            label: "CGS Mechanics",
            sourceRef: { kind: "actorCgsGrants", uuid: actor.uuid },
            grants
        }
    ];
}
