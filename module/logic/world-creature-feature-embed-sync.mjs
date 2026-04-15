/**
 * Helpers to find embedded creature-feature items that trace to a world (or compendium) template,
 * used when syncing a saved world item to actor copies (see ThirdEraItemSheet._syncWorldCreatureFeatureToActorCopies).
 */

/**
 * @param {{ items?: unknown }} actor
 * @returns {unknown[]}
 */
function itemsArrayFromActor(actor) {
    if (!actor?.items) return [];
    const c = actor.items;
    if (Array.isArray(c)) return c;
    if (typeof c.contents !== "undefined" && Array.isArray(c.contents)) return c.contents;
    if (typeof c.values === "function") return Array.from(c.values());
    return [];
}

/**
 * Whether the actor has an embedded creature feature whose `sourceId` matches the world template UUID.
 * @param {{ items?: unknown }} actor
 * @param {string} worldItemUuid
 * @returns {boolean}
 */
export function actorHasCreatureFeatureWithWorldSourceId(actor, worldItemUuid) {
    if (!worldItemUuid) return false;
    return itemsArrayFromActor(actor).some(
        (it) => it?.type === "creatureFeature" && it.sourceId === worldItemUuid
    );
}

/**
 * Whether the actor has an embedded creature feature with the given display name (trimmed exact match).
 * @param {{ items?: unknown }} actor
 * @param {string} docName
 * @returns {boolean}
 */
export function actorHasCreatureFeatureNamed(actor, docName) {
    const name = (docName ?? "").trim();
    if (!name) return false;
    return itemsArrayFromActor(actor).some(
        (it) => it?.type === "creatureFeature" && (it.name ?? "").trim() === name
    );
}

/**
 * Embedded creatureFeature items that should receive data pushed from the world template.
 * Matches by `sourceId === worldItemUuid` or, when `docName` is non-empty, by same trimmed name (feat sync parity).
 * @param {{ items?: unknown }} actor
 * @param {string} worldItemUuid
 * @param {string} docName
 * @returns {unknown[]}
 */
export function getEmbeddedCreatureFeaturesMatchingWorldTemplate(actor, worldItemUuid, docName) {
    const items = itemsArrayFromActor(actor);
    const name = (docName ?? "").trim();
    return items.filter(
        (it) => it?.type === "creatureFeature"
            && (it.sourceId === worldItemUuid || (Boolean(name) && (it.name ?? "").trim() === name))
    );
}
