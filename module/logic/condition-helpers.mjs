/**
 * Helpers for applying condition mechanical effects (Phase 2).
 * Resolves active condition effects on an actor to condition items and aggregates
 * their "changes" into modifiers for AC, speed, saves, and attack.
 *
 * Phase 5a: shared effect listing / status id extraction for modifier and CGS condition providers.
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
 * Status IDs from an effect (Set, Array, or plain source). Used by modifier and CGS condition providers.
 *
 * @param {Object} effect ActiveEffect document or plain effect object
 * @returns {string[]}
 */
export function getEffectStatusIds(effect) {
    if (!effect) return [];
    const s = effect.statuses;
    if (s instanceof Set) return Array.from(s);
    if (Array.isArray(s)) return s;
    const src = effect._source ?? effect.toObject?.() ?? effect;
    const raw = src?.statuses;
    if (Array.isArray(raw)) return raw;
    if (raw instanceof Set) return Array.from(raw);
    const legacyId = effect.flags?.core?.statusId ?? effect.getFlag?.("core", "statusId");
    if (legacyId) return [legacyId];
    return [];
}

/**
 * Effect objects for condition resolution: embedded collection or actor source during data prep.
 *
 * @param {unknown} actor
 * @returns {unknown[]}
 */
export function getActorEffectsList(actor) {
    const fromDoc = actor?.effects ?? [];
    const docIsCollection = fromDoc && typeof fromDoc.size === "number" && typeof fromDoc.entries === "function";
    const docList = docIsCollection ? Array.from(fromDoc) : (Array.isArray(fromDoc) ? fromDoc : []);
    if (docList.length > 0) return docList;
    const src = actor?._source ?? actor?.toObject?.() ?? {};
    const fromSource = src?.effects;
    const sourceList = Array.isArray(fromSource) ? fromSource : [];
    return sourceList.length > 0 ? sourceList : docList;
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

    const effects = getActorEffectsList(actor);
    for (const effect of effects) {
        const statuses = effect.statuses;
        const statusList =
            statuses instanceof Set
                ? Array.from(statuses)
                : Array.isArray(statuses)
                  ? statuses
                  : getEffectStatusIds(effect);
        if (!statusList.length) continue;
        for (const statusId of statusList) {
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
                const entryLabel = (c.label && String(c.label).trim()) ? String(c.label).trim() : name;

                switch (key) {
                    case "ac":
                        out.ac += value;
                        out.acBreakdown.push({ label: entryLabel, value });
                        break;
                    case "acLoseDex":
                        if (value !== 0) out.loseDexToAc = true;
                        break;
                    case "speedMultiplier":
                        if (value > 0 && value <= 1) out.speedMultiplier *= value;
                        break;
                    case "saveFort":
                        out.saves.fort += value;
                        out.saveBreakdown.fort.push({ label: entryLabel, value });
                        break;
                    case "saveRef":
                        out.saves.ref += value;
                        out.saveBreakdown.ref.push({ label: entryLabel, value });
                        break;
                    case "saveWill":
                        out.saves.will += value;
                        out.saveBreakdown.will.push({ label: entryLabel, value });
                        break;
                    case "attack":
                        out.attackMelee += value;
                        out.attackRanged += value;
                        out.attackMeleeBreakdown.push({ label: entryLabel, value });
                        out.attackRangedBreakdown.push({ label: entryLabel, value });
                        break;
                    case "attackMelee":
                        out.attackMelee += value;
                        out.attackMeleeBreakdown.push({ label: entryLabel, value });
                        break;
                    case "attackRanged":
                        out.attackRanged += value;
                        out.attackRangedBreakdown.push({ label: entryLabel, value });
                        break;
                    default:
                        break;
                }
            }
        }
    }

    return out;
}
