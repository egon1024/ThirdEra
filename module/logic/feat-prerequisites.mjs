/**
 * Feat prerequisite validation: given an actor and a feat document, determine whether
 * the actor meets the feat's prerequisites. All prerequisite feat references use document UUID
 * (see project rule item-references-by-id). Membership is checked by ID/UUID (sourceFeatUuid or sourceId).
 * @module logic/feat-prerequisites
 */

/**
 * Returns whether the actor has an item that is or derives from the given feat document UUID.
 * Uses flags.core.sourceId (compendium imports) or flags.thirdera.sourceFeatUuid (set when adding from level-up).
 * @param {Actor} actor
 * @param {string} featDocumentUuid - Document UUID of the required feat (world or compendium).
 * @returns {boolean}
 */
export function actorHasFeatByUuid(actor, featDocumentUuid) {
    if (!featDocumentUuid || !actor?.items) return false;
    const u = String(featDocumentUuid).trim();
    if (!u) return false;
    return actor.items.some(
        (item) =>
            item.type === "feat" &&
            (item.flags?.core?.sourceId === u || item.flags?.thirdera?.sourceFeatUuid === u)
    );
}

/**
 * Check if an actor meets a feat's structured prerequisites. Returns unmet reasons only (for display).
 * @param {Actor} actor - The character actor (must have system.combat.bab, system.abilities).
 * @param {Item} featDocument - The feat document (world or compendium item) with optional system.prerequisiteFeatUuids, prerequisiteBAB, prerequisiteAbilityScores.
 * @returns {Promise<{ met: boolean, reasons: string[] }>}
 */
export async function meetsFeatPrerequisites(actor, featDocument) {
    const reasons = [];
    const sys = featDocument?.system ?? {};
    const uuids = sys.prerequisiteFeatUuids ?? [];
    const babRequired = Math.max(0, Number(sys.prerequisiteBAB) || 0);
    const abilityScores = sys.prerequisiteAbilityScores ?? {};

    for (const uuid of uuids) {
        const u = String(uuid).trim();
        if (!u) continue;
        let doc;
        try {
            doc = await foundry.utils.fromUuid(u);
        } catch (_) {
            reasons.push(game.i18n.format("THIRDERA.FeatPrereq.RequiresFeatUnknown", { uuid: u }));
            continue;
        }
        if (!doc) {
            reasons.push(game.i18n.format("THIRDERA.FeatPrereq.RequiresFeatUnknown", { uuid: u }));
            continue;
        }
        const name = doc.name || game.i18n.localize("THIRDERA.FeatPrereq.UnknownFeat");
        if (!actorHasFeatByUuid(actor, u)) {
            reasons.push(game.i18n.format("THIRDERA.FeatPrereq.RequiresFeatMissing", { name }));
        }
    }

    if (babRequired > 0) {
        const actorBAB = Number(actor?.system?.combat?.bab) || 0;
        if (actorBAB < babRequired) {
            reasons.push(game.i18n.format("THIRDERA.FeatPrereq.RequiresBAB", { required: babRequired, current: actorBAB }));
        }
    }

    const abilityLabels = CONFIG.THIRDERA?.AbilityScores ?? { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };
    for (const [key, minVal] of Object.entries(abilityScores)) {
        const min = Math.max(0, Number(minVal) || 0);
        if (min <= 0) continue;
        const ability = actor?.system?.abilities?.[key];
        const effective = ability?.effective ?? ability?.value ?? 0;
        const current = Number(effective) || 0;
        if (current < min) {
            const label = abilityLabels[key] || key;
            reasons.push(game.i18n.format("THIRDERA.FeatPrereq.RequiresAbility", { ability: label, required: min, current }));
        }
    }

    return {
        met: reasons.length === 0,
        reasons
    };
}
