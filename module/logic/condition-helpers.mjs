/**
 * Helpers for applying condition mechanical effects (Phase 2).
 * Resolves active condition effects on an actor to condition items and aggregates
 * their "changes" into modifiers for AC, speed, saves, and attack.
 */

/** Condition change keys we interpret. Values are numbers except acLoseDex (1 = true). */
const CONDITION_KEYS = new Set([
    "ac", "acLoseDex", "speedMultiplier",
    "saveFort", "saveRef", "saveWill",
    "attack", "attackMelee", "attackRanged"
]);

/**
 * Get a map of conditionId -> condition item (from compendium + world).
 * Cached per call; callers may call once per prepareDerivedData.
 * @param {Object} [options] Optional. If { worldOnly: true }, only world items (e.g. for init before compendium ready).
 * @returns {Promise<Map<string, Item>>} Map of conditionId (lowercase) to condition Item
 */
export async function getConditionItemsMap(options = {}) {
    const map = new Map();
    const add = (item) => {
        const raw = item.system?.conditionId?.trim();
        if (!raw) return;
        const id = String(raw).toLowerCase();
        if (!map.has(id)) map.set(id, item);
    };

    if (!options.worldOnly && game.packs) {
        const pack = game.packs.get("thirdera.thirdera_conditions");
        if (pack) {
            const docs = await pack.getDocuments();
            for (const item of docs) add(item);
        }
    }
    for (const item of (game.items?.contents ?? [])) {
        if (item.type === "condition") add(item);
    }
    return map;
}

/**
 * Synchronous: get condition items from CONFIG.THIRDERA.conditionItemsById (populated at ready)
 * merged with world items (world overrides). Use from prepareDerivedData.
 * @returns {Map<string, Item>} Map of conditionId (lowercase) to condition Item
 */
export function getConditionItemsMapSync() {
    const map = new Map();
    const cached = CONFIG.THIRDERA?.conditionItemsById;
    if (cached) for (const [id, item] of cached) map.set(id, item);
    for (const item of (game.items?.contents ?? [])) {
        if (item.type !== "condition") continue;
        const raw = item.system?.conditionId?.trim();
        if (!raw) continue;
        const id = String(raw).toLowerCase();
        map.set(id, item);
    }
    return map;
}

/**
 * Aggregate condition modifiers from an actor's active effects.
 * Effects must have statuses that match condition IDs; we look up condition items (world + compendium)
 * and sum their changes. Uses world-only condition map so this is safe to call from prepareDerivedData.
 * @param {Actor} actor The actor (character or npc)
 * @param {Map<string, Item>} conditionMap Map from conditionId to condition Item (e.g. getConditionItemsMapSync())
 * @returns {{ ac: number, acBreakdown: Array<{label: string, value: number}>, loseDexToAc: boolean, speedMultiplier: number, saves: { fort: number, ref: number, will: number }, saveBreakdown: { fort: Array<{label: string, value: number}>, ref: Array<{label: string, value: number}>, will: Array<{label: string, value: number}> }, attackMelee: number, attackRanged: number, attackMeleeBreakdown: Array<{label: string, value: number}>, attackRangedBreakdown: Array<{label: string, value: number}> }}
 */
export function getActiveConditionModifiers(actor, conditionMap) {
    const out = {
        ac: 0,
        acBreakdown: [],
        loseDexToAc: false,
        speedMultiplier: 1,
        saves: { fort: 0, ref: 0, will: 0 },
        saveBreakdown: { fort: [], ref: [], will: [] },
        attackMelee: 0,
        attackRanged: 0,
        attackMeleeBreakdown: [],
        attackRangedBreakdown: []
    };

    const effects = actor.effects ?? [];
    for (const effect of effects) {
        const statuses = effect.statuses;
        if (!statuses || statuses.size === 0) continue;
        for (const statusId of statuses) {
            const conditionId = String(statusId).toLowerCase().trim();
            const conditionItem = conditionMap.get(conditionId);
            if (!conditionItem) continue;
            const changes = conditionItem.system?.changes ?? [];
            const name = conditionItem.name || conditionId;

            for (const c of changes) {
                const key = (c.key || "").trim();
                if (!CONDITION_KEYS.has(key)) continue;
                const value = Number(c.value);
                if (Number.isNaN(value)) continue;

                switch (key) {
                    case "ac":
                        out.ac += value;
                        out.acBreakdown.push({ label: name, value });
                        break;
                    case "acLoseDex":
                        if (value !== 0) out.loseDexToAc = true;
                        break;
                    case "speedMultiplier":
                        if (value > 0 && value <= 1) out.speedMultiplier *= value;
                        break;
                    case "saveFort":
                        out.saves.fort += value;
                        out.saveBreakdown.fort.push({ label: name, value });
                        break;
                    case "saveRef":
                        out.saves.ref += value;
                        out.saveBreakdown.ref.push({ label: name, value });
                        break;
                    case "saveWill":
                        out.saves.will += value;
                        out.saveBreakdown.will.push({ label: name, value });
                        break;
                    case "attack":
                        out.attackMelee += value;
                        out.attackRanged += value;
                        out.attackMeleeBreakdown.push({ label: name, value });
                        out.attackRangedBreakdown.push({ label: name, value });
                        break;
                    case "attackMelee":
                        out.attackMelee += value;
                        out.attackMeleeBreakdown.push({ label: name, value });
                        break;
                    case "attackRanged":
                        out.attackRanged += value;
                        out.attackRangedBreakdown.push({ label: name, value });
                        break;
                    default:
                        break;
                }
            }
        }
    }

    return out;
}
