/**
 * Tooltip text for CGS provenance document links on actor sheets.
 * Foundry's Item#toAnchor uses CONFIG.Item.typeLabels with game.i18n.has(); ThirdEra labels use
 * THIRDERA.* keys and may not register as "has", so the dynamic tooltip falls back to DOCUMENT.Item ("Item").
 * We set data-tooltip-text explicitly: item type (feat, armor, …) plus the resolved display name.
 *
 * English fallbacks mirror lang/en.json `THIRDERA.TYPES.Item` / `THIRDERA.TYPES.Actor` when localize returns the key.
 */

/** @type {Readonly<Record<string, string>>} */
export const CGS_ITEM_TYPE_FALLBACK_LABELS = Object.freeze({
    spell: "Spell",
    weapon: "Weapon",
    armor: "Armor",
    equipment: "Equipment",
    feat: "Feat",
    skill: "Skill",
    race: "Race",
    class: "Class",
    feature: "Class Feature",
    domain: "Domain",
    school: "School of Magic",
    condition: "Condition",
    creatureType: "Creature Type",
    subtype: "Subtype"
});

/** @type {Readonly<Record<string, string>>} */
const CGS_ACTOR_TYPE_FALLBACK_LABELS = Object.freeze({
    character: "Character",
    npc: "NPC"
});

/** @type {Readonly<Record<string, string>>} */
const DOCUMENT_NAME_FALLBACK_LABELS = Object.freeze({
    Item: "Item",
    Actor: "Actor"
});

/**
 * @param {string} itemType
 * @param {{
 *   localize: (key: string) => string,
 *   itemTypeLabels?: Record<string, string> | null | undefined
 * }} deps
 * @returns {string}
 */
export function resolveThirdEraItemTypeDisplayName(itemType, deps) {
    if (typeof itemType !== "string" || !itemType.length) return "";
    const labels = deps.itemTypeLabels && typeof deps.itemTypeLabels === "object" ? deps.itemTypeLabels : {};
    const key = labels[itemType];
    if (typeof key === "string" && key.length > 0) {
        const s = deps.localize(key);
        if (s !== key) return s;
    }
    return CGS_ITEM_TYPE_FALLBACK_LABELS[itemType] ?? itemType;
}

/**
 * @param {string} actorType
 * @param {(key: string) => string} localize
 * @returns {string}
 */
export function resolveThirdEraActorTypeDisplayName(actorType, localize) {
    if (typeof actorType !== "string" || !actorType.length) return "";
    const key = `THIRDERA.TYPES.Actor.${actorType}`;
    const s = localize(key);
    if (s !== key) return s;
    return CGS_ACTOR_TYPE_FALLBACK_LABELS[actorType] ?? actorType;
}

/**
 * @param {{ documentName?: string, type?: string, name?: string } | null | undefined} doc
 * @param {string} displayName Resolved provenance label (often the item name).
 * @param {{
 *   localize: (key: string) => string,
 *   itemTypeLabels?: Record<string, string> | null | undefined
 * }} deps
 * @returns {string}
 */
export function formatCgsProvenanceLinkTooltip(doc, displayName, deps) {
    const loc = deps.localize;
    const unknownKey = "THIRDERA.CGS.ProvenanceUnknownSource";
    const unknownRaw = loc(unknownKey);
    const unknown = unknownRaw !== unknownKey ? unknownRaw : "Unknown source";
    const name =
        (typeof displayName === "string" && displayName.trim()) ||
        (typeof doc?.name === "string" && doc.name.trim()) ||
        "";

    if (!doc || typeof doc.documentName !== "string") {
        return name || unknown;
    }

    if (doc.documentName === "Item" && typeof doc.type === "string" && doc.type.length > 0) {
        const typePart = resolveThirdEraItemTypeDisplayName(doc.type, deps);
        if (typePart && name) return `${typePart}: ${name}`;
        return name || typePart || unknown;
    }

    if (doc.documentName === "Actor" && typeof doc.type === "string" && doc.type.length > 0) {
        const typePart = resolveThirdEraActorTypeDisplayName(doc.type, loc);
        if (typePart && name) return `${typePart}: ${name}`;
        return name || typePart || unknown;
    }

    const docKey = `DOCUMENT.${doc.documentName}`;
    const docPart = loc(docKey);
    const docLabel =
        docPart !== docKey ? docPart : DOCUMENT_NAME_FALLBACK_LABELS[doc.documentName] ?? doc.documentName;
    if (docLabel && name) return `${docLabel}: ${name}`;
    return name || docLabel || unknown;
}
