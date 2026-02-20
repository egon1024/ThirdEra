/**
 * Auto-applied conditions derived from HP (dead, dying, disabled, stable) and from combat (flat-footed).
 * These are synced as ActiveEffects with flags.thirdera.derivedFrom so we only manage our own effects.
 */

const HP_DERIVED = "hp";
const COMBAT_DERIVED = "combat";

/** Condition IDs we auto-apply from HP (SRD: disabled at 0, dying -1..-9, stable when stabilized, dead at -10). */
const HP_CONDITION_IDS = new Set(["dead", "dying", "stable", "disabled", "unconscious"]);

/**
 * Get the HP-derived condition ID for an actor based on current HP and stable flag.
 * D&D 3.5: Disabled (0 HP), Dying (-1 to -9, not stable), Stable (-1 to -9, stable), Dead (-10 or below).
 * Unconscious is not returned as a separate id; Dying and Stable represent unconscious states.
 * @param {Actor} actor
 * @returns {string|null} conditionId or null if no HP-derived condition
 */
export function getDerivedHpConditionId(actor) {
    const hp = actor.system?.attributes?.hp;
    if (!hp) return null;
    const value = Number(hp.value);
    const stable = !!hp.stable;
    if (value > 0) return null;
    if (value <= -10) return "dead";
    if (value < 0 && value > -10) return stable ? "stable" : "dying";
    if (value === 0) return "disabled";
    return null;
}

/**
 * Get status effect info for a condition ID from CONFIG or condition items.
 * @param {string} conditionId
 * @returns {{ id: string, name: string, img: string }|null}
 */
function getConditionStatus(conditionId) {
    const id = String(conditionId).toLowerCase().trim();
    const fromConfig = CONFIG.statusEffects?.find(e => e.id === id);
    if (fromConfig) return { id, name: fromConfig.name || id, img: fromConfig.img || "icons/svg/aura.svg" };
    const item = CONFIG.THIRDERA?.conditionItemsById?.get(id);
    if (item) return { id, name: item.name || id, img: item.img || "icons/svg/aura.svg" };
    return { id, name: id, img: "icons/svg/aura.svg" };
}

/**
 * Find an existing derived effect on the actor by source (hp or combat).
 * @param {Actor} actor
 * @param {string} source "hp" | "combat"
 * @returns {ActiveEffect|null}
 */
function getDerivedEffect(actor, source) {
    return (actor.effects ?? []).find(
        e => e.getFlag?.("thirdera", "derivedFrom") === source
    ) ?? null;
}

/**
 * Sync HP-derived condition: ensure exactly one effect with derivedFrom=hp exists when HP state warrants it,
 * and that it has the correct status; remove it when HP > 0. Clears hp.stable when HP > 0.
 * @param {Actor} actor World actor (not token actor)
 */
export async function syncDerivedHpCondition(actor) {
    if (!actor?.system?.attributes?.hp) return;
    const worldActor = actor.isToken ? (game.actors.get(actor.id) ?? actor) : actor;
    const currentId = getDerivedHpConditionId(worldActor);
    const existing = getDerivedEffect(worldActor, HP_DERIVED);

    if (currentId === null) {
        if (existing) await worldActor.deleteEmbeddedDocuments("ActiveEffect", [existing.id]);
        const hp = worldActor.system.attributes.hp;
        if (hp.stable) await worldActor.update({ "system.attributes.hp.stable": false });
        return;
    }

    const status = getConditionStatus(currentId);
    if (!status) return;

    if (existing) {
        const existingStatuses = existing.statuses;
        if (existingStatuses?.has?.(currentId) && existingStatuses.size === 1) return;
        await worldActor.updateEmbeddedDocuments("ActiveEffect", [{
            _id: existing.id,
            name: status.name,
            img: status.img,
            statuses: [currentId]
        }]);
        return;
    }

    await worldActor.createEmbeddedDocuments("ActiveEffect", [{
        name: status.name,
        img: status.img,
        statuses: [currentId],
        flags: { thirdera: { derivedFrom: HP_DERIVED } }
    }]);
}

/**
 * Whether this actor is flat-footed in the current combat (has not yet acted this round).
 * @param {Actor} actor
 * @returns {boolean}
 */
export function isFlatFootedFromCombat(actor) {
    const combat = game.combat;
    if (!combat || combat.turn === null || combat.turn === undefined) return false;
    const turns = (combat.turns?.length && combat.turns) || Array.from(combat.combatants ?? []);
    const myIndex = turns.findIndex(c => (c.actorId ?? c.actor?.id) === actor.id);
    if (myIndex < 0) return false;
    return combat.turn < myIndex;
}

const FLAT_FOOTED_ID = "flat-footed";

/**
 * Sync flat-footed from combat: add effect when actor hasn't acted this round, remove when they have or combat ends.
 * @param {Actor} actor World actor
 */
export async function syncDerivedFlatFootedCondition(actor) {
    const worldActor = actor?.isToken ? (game.actors.get(actor.id) ?? actor) : actor;
    if (!worldActor) return;
    const shouldHave = isFlatFootedFromCombat(worldActor);
    const existing = getDerivedEffect(worldActor, COMBAT_DERIVED);

    if (!shouldHave) {
        if (existing) await worldActor.deleteEmbeddedDocuments("ActiveEffect", [existing.id]);
        return;
    }

    if (existing) return;

    const status = getConditionStatus(FLAT_FOOTED_ID);
    await worldActor.createEmbeddedDocuments("ActiveEffect", [{
        name: status.name,
        img: status.img,
        statuses: [FLAT_FOOTED_ID],
        flags: { thirdera: { derivedFrom: COMBAT_DERIVED } }
    }]);
}

/**
 * Sync flat-footed for all actors that are in the current combat.
 */
export async function syncFlatFootedForCombat() {
    const combat = game.combat;
    if (!combat?.combatants?.size) return;
    const actorIds = new Set();
    for (const c of combat.combatants) {
        const aid = c.actorId ?? c.actor?.id;
        if (aid) actorIds.add(aid);
    }
    for (const id of actorIds) {
        const actor = game.actors.get(id);
        if (actor) await syncDerivedFlatFootedCondition(actor);
    }
}

/**
 * Remove combat-derived flat-footed from an actor (e.g. when combat ends).
 * @param {Actor} actor
 */
export async function removeDerivedFlatFooted(actor) {
    const worldActor = actor?.isToken ? (game.actors.get(actor.id) ?? actor) : actor;
    if (!worldActor) return;
    const existing = getDerivedEffect(worldActor, COMBAT_DERIVED);
    if (existing) await worldActor.deleteEmbeddedDocuments("ActiveEffect", [existing.id]);
}

/**
 * Check if an ActiveEffect is system-derived (from HP or combat).
 * @param {ActiveEffect} effect
 * @returns {string|null} "hp" | "combat" | null
 */
export function getDerivedFrom(effect) {
    return effect.getFlag?.("thirdera", "derivedFrom") ?? null;
}
