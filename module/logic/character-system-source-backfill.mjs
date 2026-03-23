/**
 * Backfill required character `system` keys on the plain object Foundry validates during updates.
 * `CharacterData.migrateData` runs at model construction, but embedded Item updates can validate the
 * parent Actor against `_source.system` that still omits nested fields added in later schema versions.
 * This mutates the live source in place (idempotent).
 * @param {object} [source] Character system plain object
 */
export function backfillCharacterSystemSourceInPlace(source) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
        return;
    }
    const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

    if (!isPlainObject(source.details)) {
        source.details = {};
    }
    if (source.details.naturalHealingBonus === undefined) {
        source.details.naturalHealingBonus = 0;
    }
    if (source.details.spellResistance === undefined) {
        source.details.spellResistance = 0;
    }

    if (!isPlainObject(source.experience)) {
        source.experience = {};
    }
    if (source.experience.value === undefined) {
        source.experience.value = 0;
    }
    if (source.experience.max === undefined) {
        source.experience.max = 1000;
    }
}

/**
 * Patch an incoming `changed.system` object so nested `details` / `experience` objects
 * include required fields. Foundry may merge a delta whose `details` omits keys added
 * in later schema versions while the actor's live `_source` is already valid.
 * Only mutates `details` / `experience` when those keys exist on the delta (non-null objects).
 * @param {object} changeSystem - `changes.system` from Actor._preUpdate
 * @param {Actor} actor
 */
export function backfillCharacterSystemChangeObject(changeSystem, actor) {
    if (!changeSystem || typeof changeSystem !== "object" || Array.isArray(changeSystem)) return;
    const cur = actor.system?._source ?? actor._source?.system;

    const badDetails = !("details" in changeSystem)
        || changeSystem.details === undefined
        || changeSystem.details === null
        || typeof changeSystem.details !== "object"
        || Array.isArray(changeSystem.details);
    const badExperience = !("experience" in changeSystem)
        || changeSystem.experience === undefined
        || changeSystem.experience === null
        || typeof changeSystem.experience !== "object"
        || Array.isArray(changeSystem.experience);

    // Spell/item flows often pass `changed.system` without top-level `details` / `experience`.
    if (badDetails && cur?.details) {
        changeSystem.details = foundry.utils.deepClone(cur.details);
    }
    if (badExperience && cur?.experience) {
        changeSystem.experience = foundry.utils.deepClone(cur.experience);
    }

    if (changeSystem.details != null && typeof changeSystem.details === "object" && !Array.isArray(changeSystem.details)) {
        if (changeSystem.details.naturalHealingBonus === undefined) {
            changeSystem.details.naturalHealingBonus = cur?.details?.naturalHealingBonus ?? 0;
        }
        if (changeSystem.details.spellResistance === undefined) {
            changeSystem.details.spellResistance = cur?.details?.spellResistance ?? 0;
        }
    }
    if (changeSystem.experience != null && typeof changeSystem.experience === "object" && !Array.isArray(changeSystem.experience)) {
        if (changeSystem.experience.value === undefined) {
            changeSystem.experience.value = cur?.experience?.value ?? 0;
        }
        if (changeSystem.experience.max === undefined) {
            changeSystem.experience.max = cur?.experience?.max ?? 1000;
        }
    }
}

export function backfillCharacterSystemSourceForActor(actor) {
    if (!actor || actor.type !== "character") {
        return;
    }
    const sysModel = actor.system;
    const fromModel = sysModel?._source;
    const fromActorRoot = actor._source?.system;
    const src = fromModel ?? fromActorRoot;
    backfillCharacterSystemSourceInPlace(src);
}
