import {
    backfillCharacterSystemChangeObject,
    backfillCharacterSystemSourceForActor,
    backfillCharacterSystemSourceInPlace
} from "../logic/character-system-source-backfill.mjs";
import { getSpellsForDomain } from "../logic/domain-spells.mjs";
import {
    incrementCgsSpellGrantCastsMap,
    shouldUseCgsGrantCastMapForCast
} from "../logic/cgs-spell-grant-cast.mjs";
import { getMergedSpellGrantRowsForActor } from "../logic/cgs-spell-grant-rows.mjs";
import {
    findMergedSpellGrantRowForActorSpell,
    normalizeCgsSpellGrantUsesPerDay
} from "../logic/cgs-spell-grant-prep.mjs";
import { filterNpcSkillItemDataForCreate } from "../logic/npc-embedded-skill-identity.mjs";
import { parseSaveType } from "../logic/spell-save-helpers.mjs";
import { resolveSpellTargetTypeUuidsFromPacks } from "../logic/cgs-spell-target-type-resolve-runtime.mjs";
import { validateSpellTargetsCreatureTypes } from "../logic/spell-creature-type-targeting.mjs";

/**
 * HTML for Success/Failure in roll flavor (chat template renders flavor with triple braces).
 * @param {boolean} success
 * @returns {string}
 */
function htmlRollDcOutcome(success) {
    const resultKey = success ? "THIRDERA.SpellSave.SaveResultSuccess" : "THIRDERA.SpellSave.SaveResultFailure";
    const text = foundry.utils.escapeHTML(game.i18n.localize(resultKey));
    const mod = success ? "thirdera-roll-outcome--success" : "thirdera-roll-outcome--failure";
    return `<span class="thirdera-roll-outcome ${mod}">${text}</span>`;
}

/**
 * Extended Actor document class for Third Era
 * @extends {Actor}
 */
export class ThirdEraActor extends Actor {

    /**
     * Block duplicate embedded skills on NPCs (same identity as `npcEmbeddedSkillIdentity` in
     * `npc-embedded-skill-identity.mjs`) or earlier in this batch. Prevents compendium/import/drop bugs.
     * @inheritdoc
     */
    async createEmbeddedDocuments(embeddedName, data, operation) {
        if (embeddedName === "Item" && this.type === "npc" && Array.isArray(data) && data.length) {
            const before = data.length;
            const filtered = filterNpcSkillItemDataForCreate(this.items, data);
            const skipped = before - filtered.length;
            if (skipped > 0) {
                console.warn(`Third Era | Skipped ${skipped} duplicate NPC skill embed(s) on ${this.name ?? this.id}.`);
            }
            if (filtered.length === 0) return [];
            data = filtered;
        }
        return super.createEmbeddedDocuments(embeddedName, data, operation);
    }

    /**
     * Augment the basic actor data with additional dynamic data.
     */
    prepareData() {
        super.prepareData();
    }

    /**
     * Prepare character data that doesn't depend on items or effects
     */
    prepareBaseData() {
        super.prepareBaseData();
    }

    /**
     * Prepare character data that depends on items and effects
     */
    prepareDerivedData() {
        super.prepareDerivedData();

        const actorData = this;
        const systemData = actorData.system;
        const flags = actorData.flags.thirdera || {};

        // Make separate methods for each Actor type (character, npc, etc.) to keep
        // things organized
        if (actorData.type === 'character') this._prepareCharacterData(actorData);
        if (actorData.type === 'npc') this._prepareNPCData(actorData);
    }

    /** @inheritdoc */
    async _preUpdate(changed, options, user) {
        if (this.type === "character") {
            const curSys = this.system?._source ?? this._source?.system;
            // Embedded Item updates often send `items` on the Actor without `system`; validation still needs
            // `details` / `experience` on the merged model.
            if (changed?.items && !changed?.system) {
                changed.system = {
                    details: foundry.utils.deepClone(curSys?.details ?? {}),
                    experience: foundry.utils.deepClone(curSys?.experience ?? { value: 0, max: 1000 })
                };
                backfillCharacterSystemSourceInPlace(changed.system);
            }
            if (changed?.system) {
                backfillCharacterSystemChangeObject(changed.system, this);
            }
            backfillCharacterSystemSourceForActor(this);
        }
        return super._preUpdate(changed, options, user);
    }

    /**
     * Prepare Character specific derived data
     */
    _prepareCharacterData(actorData) {
        const systemData = actorData.system;

        // Add any additional character-specific calculations here
        // For now, the data model handles most calculations
    }

    /**
     * Prepare NPC specific derived data
     */
    _prepareNPCData(actorData) {
        const systemData = actorData.system;

        // Add any additional NPC-specific calculations here
    }

    /**
     * Roll a skill check (uses prepared modifier total when available, e.g. Phase 6 skill modifiers).
     * @param {string} skillName - The name of the skill to roll
     */
    async rollSkillCheck(skillName) {
        const skill = this.items.find(i => i.type === 'skill' && i.name === skillName);

        if (!skill) {
            ui.notifications.warn(`Skill ${skillName} not found on actor.`);
            return null;
        }

        const skillData = skill.system;
        const total = (skillData.modifier?.total != null && Number.isFinite(skillData.modifier.total))
            ? skillData.modifier.total
            : (this.system.abilities[skillData.ability]?.mod || 0) + (skillData.ranks || 0) + (skillData.modifier?.misc || 0);

        const roll = await new Roll(`1d20 + ${total}`).roll();

        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            flavor: `${skillName} Check`
        });

        return roll;
    }

    /**
     * Roll a skill check by skill key when the actor has no skill item (modifier-only skill, Phase 6).
     * Uses 0 ranks, ability mod from the skill's key ability (looked up from world/compendium), plus modifier-only total.
     * @param {string} skillKey - system.key of the skill (e.g. "hide")
     */
    async rollSkillCheckByKey(skillKey) {
        if (!skillKey) {
            ui.notifications.warn("No skill key provided.");
            return null;
        }
        const list = this.system.modifierOnlySkills ?? [];
        const entry = list.find(
            (e) => (e.key || "").toLowerCase() === (skillKey || "").toLowerCase()
        );
        if (!entry) {
            ui.notifications.warn(`Skill key "${skillKey}" not found in modifier-only skills.`);
            return null;
        }
        const skillItem = game.items?.find?.(
            (i) => i.type === "skill" && (i.system?.key ?? "").toLowerCase() === (entry.key || "").toLowerCase()
        );
        const abilityId = skillItem?.system?.ability || "int";
        const abilityMod = this.system.abilities[abilityId]?.mod ?? 0;
        const total = abilityMod + (entry.total ?? 0);
        const displayName = skillItem?.name ?? entry.key;

        const roll = await new Roll(`1d20 + ${total}`).roll();
        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            flavor: `${displayName} Check (modifiers only)`
        });
        return roll;
    }

    /**
     * Roll an ability check
     * @param {string} abilityId - The ability score to roll (str, dex, con, int, wis, cha)
     */
    async rollAbilityCheck(abilityId) {
        const ability = this.system.abilities[abilityId];

        if (!ability) {
            ui.notifications.warn(`Ability ${abilityId} not found.`);
            return null;
        }

        const roll = await new Roll(`1d20 + ${ability.mod}`).roll();

        const abilityName = CONFIG.THIRDERA?.AbilityScores?.[abilityId] || abilityId.toUpperCase();

        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            flavor: `${abilityName} Check`
        });

        return roll;
    }

    /**
     * Roll a saving throw.
     * @param {string} saveId - The save to roll (fort, ref, will)
     * @param {Object} [options={}]
     * @param {number} [options.dc] - Optional DC to show in the roll message (e.g. vs spell DC)
     */
    async rollSavingThrow(saveId, { dc } = {}) {
        const save = this.system.saves[saveId];

        if (!save) {
            ui.notifications.warn(`Save ${saveId} not found.`);
            return null;
        }

        const roll = await new Roll(`1d20 + ${save.total}`).roll();

        const saveName = CONFIG.THIRDERA?.Saves?.[saveId] || saveId.toUpperCase();
        const modSigned = save.total >= 0 ? `+${save.total}` : String(save.total);
        let flavor = `${saveName} Save (${modSigned})`;
        if (typeof dc === "number" && Number.isFinite(dc)) {
            flavor += ` vs DC ${dc}`;
            const total = Math.round(roll.total * 100) / 100;
            const success = total >= dc;
            flavor += ` — ${htmlRollDcOutcome(success)}`;
        }

        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            flavor
        });

        return roll;
    }

    /**
     * Find the actor's Concentration skill item: match `system.key === "concentration"` first, then display name "Concentration".
     * @returns {Item|null}
     */
    _findConcentrationSkillItem() {
        const byKey = this.items.find(
            (i) => i.type === "skill" && (i.system?.key ?? "").toLowerCase() === "concentration"
        );
        if (byKey) return byKey;
        return this.items.find((i) => i.type === "skill" && i.name === "Concentration") ?? null;
    }

    /**
     * Roll a Concentration check (same bonus resolution as skill items / modifier-only skills).
     * Flavor mirrors {@link ThirdEraActor#rollSavingThrow}: modifier, optional `vs DC N`, and success/failure when `dc` is finite.
     * @param {Object} [options={}]
     * @param {number} [options.dc] - DC to compare the roll total against (e.g. defensive casting)
     * @param {string} [options.label] - Optional prefix (e.g. reason for the check)
     * @returns {Promise<Roll|null>}
     */
    async rollConcentrationCheck({ dc, label } = {}) {
        const skillItem = this._findConcentrationSkillItem();
        let total;
        let displayName;
        let modifiersOnly = false;

        if (skillItem) {
            const skillData = skillItem.system;
            total = (skillData.modifier?.total != null && Number.isFinite(skillData.modifier.total))
                ? skillData.modifier.total
                : (this.system.abilities[skillData.ability]?.mod || 0) + (skillData.ranks || 0) + (skillData.modifier?.misc || 0);
            displayName = skillItem.name;
        } else {
            const entry = this.system.modifierOnlySkills?.find(
                (e) => (e.key || "").toLowerCase() === "concentration"
            );
            if (entry) {
                const skillRef = game.items?.find?.(
                    (i) => i.type === "skill" && (i.system?.key ?? "").toLowerCase() === (entry.key || "").toLowerCase()
                );
                const abilityId = skillRef?.system?.ability || "con";
                const abilityMod = this.system.abilities[abilityId]?.mod ?? 0;
                total = abilityMod + (entry.total ?? 0);
                displayName = skillRef?.name ?? entry.key;
                modifiersOnly = true;
            } else {
                ui.notifications.warn(game.i18n.localize("THIRDERA.Concentration.NoSkillItem"));
                return null;
            }
        }

        const roll = await new Roll(`1d20 + ${total}`).roll();
        const modSigned = total >= 0 ? `+${total}` : String(total);
        const flavorKey = modifiersOnly
            ? "THIRDERA.Concentration.CheckFlavorModifiersOnly"
            : "THIRDERA.Concentration.CheckFlavor";
        let flavor = game.i18n.format(flavorKey, { name: displayName, mod: modSigned });
        if (label) {
            flavor = `${label}: ${flavor}`;
        }
        if (typeof dc === "number" && Number.isFinite(dc)) {
            flavor += ` vs DC ${dc}`;
            const rolled = Math.round(roll.total * 100) / 100;
            const success = rolled >= dc;
            flavor += ` — ${htmlRollDcOutcome(success)}`;
        }

        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            flavor
        });

        return roll;
    }

    /**
     * Spell penetration check (D&D 3.5 SRD): {@code 1d20 + caster level} must meet or exceed the target’s spell resistance.
     * @param {Object} [options={}]
     * @param {number} [options.casterLevel] - Caster level for this spell (truncated integer; non-finite defaults to 0)
     * @param {number} [options.spellResistance] - Target SR (required; non-negative integer after normalization)
     * @param {string} [options.label] - Optional prefix in roll flavor (e.g. spell name)
     * @returns {Promise<Roll|null>}
     */
    async rollSpellPenetration({ casterLevel, spellResistance, label } = {}) {
        const clRaw = Number(casterLevel);
        const cl = Number.isFinite(clRaw) ? Math.trunc(clRaw) : 0;
        const srRaw = Number(spellResistance);
        if (!Number.isFinite(srRaw)) {
            ui.notifications.warn(game.i18n.localize("THIRDERA.SpellPenetration.InvalidSpellResistance"));
            return null;
        }
        const sr = Math.max(0, Math.trunc(srRaw));

        const roll = await new Roll(`1d20 + ${cl}`).roll();
        const clSigned = cl >= 0 ? `+${cl}` : String(cl);
        let flavor = game.i18n.format("THIRDERA.SpellPenetration.Flavor", { cl: clSigned });
        if (label) {
            flavor = `${label}: ${flavor}`;
        }
        flavor += game.i18n.format("THIRDERA.SpellPenetration.VsSR", { sr });
        const total = Math.round(roll.total * 100) / 100;
        const success = total >= sr;
        flavor += ` — ${htmlRollDcOutcome(success)}`;

        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            flavor
        });

        return roll;
    }

    /**
     * Roll a natural attack (NPC/monster stat block). Uses derived attack bonus (primary = melee total, secondary = melee total − 5).
     * @param {number} index - Index into system.statBlock.naturalAttacks
     * @returns {Promise<Roll|null>}
     */
    async rollNaturalAttack(index) {
        if (this.type !== "npc") {
            ui.notifications.warn("Natural attacks are only available on NPCs.");
            return null;
        }
        const attacks = this.system.statBlock?.naturalAttacks;
        if (!Array.isArray(attacks) || index < 0 || index >= attacks.length) {
            ui.notifications.warn("Invalid natural attack.");
            return null;
        }
        const atk = attacks[index];
        const bonus = atk.attackBonus ?? 0;
        const roll = await new Roll(`1d20 + ${bonus}`).roll();
        const name = (atk.name || "").trim() || game.i18n.localize("THIRDERA.NPC.NaturalAttacks");
        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            flavor: `${name} (${atk.primary === "true" ? game.i18n.localize("THIRDERA.NPC.Primary") : game.i18n.localize("THIRDERA.NPC.Secondary")})`
        });
        return roll;
    }

    /**
     * Roll natural attack damage (NPC/monster stat block). Uses derived formula (primary = full Str, secondary = half Str).
     * @param {number} index - Index into system.statBlock.naturalAttacks
     * @returns {Promise<Roll|null>}
     */
    async rollNaturalDamage(index) {
        if (this.type !== "npc") {
            ui.notifications.warn("Natural attacks are only available on NPCs.");
            return null;
        }
        const attacks = this.system.statBlock?.naturalAttacks;
        if (!Array.isArray(attacks) || index < 0 || index >= attacks.length) {
            ui.notifications.warn("Invalid natural attack.");
            return null;
        }
        const atk = attacks[index];
        const dice = (atk.dice || "").trim() || "1d4";
        const mod = atk.damageMod ?? 0;
        const formula = mod >= 0 ? `${dice} + ${mod}` : `${dice} - ${Math.abs(mod)}`;
        const roll = await new Roll(formula).roll();
        const name = (atk.name || "").trim() || game.i18n.localize("THIRDERA.NPC.NaturalAttacks");
        const typeLabel = atk.damageType ? ` ${atk.damageType}` : "";
        const primaryOrSecondary = atk.primary === "true"
            ? game.i18n.localize("THIRDERA.NPC.Primary")
            : game.i18n.localize("THIRDERA.NPC.Secondary");
        const strLabel = mod >= 0 ? `+${mod}` : `−${Math.abs(mod)}`;
        const breakdown = game.i18n.format("THIRDERA.NPC.DamageFormulaBreakdown", {
            formula,
            dice,
            strMod: strLabel,
            primaryOrSecondary
        });
        const minimumOne = roll.total < 1;
        const rollToSend = minimumOne ? await new Roll("1").roll() : roll;
        const flavorSuffix = minimumOne
            ? ` — ${game.i18n.localize("THIRDERA.NPC.DamageMinimum1")} (${game.i18n.localize("THIRDERA.NPC.Rolled")} ${roll.total})`
            : "";
        rollToSend.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            flavor: `${name} Damage${typeLabel}: ${breakdown}${flavorSuffix}`
        });
        return rollToSend;
    }

    /**
     * Cast a spell: increment cast count and post a chat message with Save DC breakdown and spell resistance.
     * Used by the sheet Cast button and (Phase 2) by hotbar macros.
     * @param {Item} spellItem       The spell item to cast (must be type "spell" on this actor)
     * @param {Object} options
     * @param {string} options.classItemId  The class item ID (from spellcastingByClass) for DC and slot context
     * @param {number|string} options.spellLevel  Spell level 0-9 for this class
     * @param {Actor[]|string[]} [options.targetActors]  Optional targets (Actor docs or actor UUIDs); stored on message for Roll save
     * @param {boolean} [options.viaCgsGrant]  When true and the spell matches an SLA-style CGS row, use `system.cgsSpellGrantCasts` instead of `spellItem.system.cast`
     * @param {boolean} [options.fromCgsRtcCapabilityGrant]  When true (Cast from CGS RTC panel): skip class prepared/slot warnings; also use the same SLA-style `cgsSpellGrantCasts` path when the merged grant is at-will or has `usesPerDay`
     * @returns {Promise<boolean>}   True if cast was applied and message posted
     *
     * Chat message `flags.thirdera.spellCast` includes (for consumers such as concentration / SR UI):
     * `dc`, `saveType`, `spellName`, `spellUuid`, optional `targetActorUuids`,
     * `spellLevel` (0–9), `classItemId` (embedded class item id on this actor), `casterLevel` (for that class at cast time),
     * `srKey` (spell item's spell resistance key, e.g. yes/no/yes-harmless).
     */
    async castSpell(spellItem, {
        classItemId,
        spellLevel,
        targetActors: rawTargets,
        viaCgsGrant = false,
        fromCgsRtcCapabilityGrant = false
    }) {
        if (!spellItem || spellItem.type !== "spell") return false;
        if (this.type !== "character") return false;

        const systemData = this.system;
        const spellcastingByClass = systemData.spellcastingByClass;
        if (!Array.isArray(spellcastingByClass)) return false;

        const classData = spellcastingByClass.find(c => c.classItemId === classItemId);
        if (!classData) return false;

        const level = typeof spellLevel === "string" ? parseInt(spellLevel, 10) : spellLevel;
        if (Number.isNaN(level) || level < 0 || level > 9) return false;

        // Domain spells: identified by name match to class's domain spell list at this level. They use domain slots only (1 per level), not regular slots/prepared.
        let domainSpellsAtLevel = classData.domainSpellsByLevel?.[level] ?? classData.domainSpellsByLevel?.[String(level)] ?? [];
        let domainSpellNamesAtLevel = new Set(
            domainSpellsAtLevel.map((e) => (e.spellName || "").toLowerCase().trim()).filter(Boolean)
        );
        let isDomainSpell = domainSpellNamesAtLevel.has((spellItem.name || "").toLowerCase().trim());

        // Fallback: when derived data had no domain spell list (e.g. prepared on server without getSpellsForDomain), resolve client-side so the first cast uses domain logic instead of prepared.
        if (!isDomainSpell && classData.domains?.length && typeof getSpellsForDomain === "function") {
            const spellNameLower = (spellItem.name || "").trim().toLowerCase();
            const fallbackNames = new Set();
            for (const dom of classData.domains) {
                const domainKey = (dom.domainKey || "").trim();
                if (!domainKey) continue;
                try {
                    const granted = getSpellsForDomain(domainKey);
                    for (const entry of granted) {
                        if (entry.level === level && (entry.spellName || "").trim()) {
                            fallbackNames.add((entry.spellName || "").trim().toLowerCase());
                        }
                    }
                } catch (_) { /* ignore */ }
            }
            if (fallbackNames.has(spellNameLower)) {
                isDomainSpell = true;
                domainSpellNamesAtLevel = fallbackNames;
            }
        }

        // Optional slot check: warn if no slot available, do not block
        const preparationType = classData.preparationType;
        const spellsPerDay = classData.spellsPerDay || {};
        const slotsAtLevel = spellsPerDay[level] ?? spellsPerDay[String(level)] ?? 0;
        const domainSlotsAtLevel = classData.domainSpellSlots?.[level] ?? classData.domainSpellSlots?.[String(level)] ?? 0;

        const cgsGrantRow = findMergedSpellGrantRowForActorSpell(spellItem, getMergedSpellGrantRowsForActor(this));
        const useCgsGrantCastMap = shouldUseCgsGrantCastMapForCast(
            viaCgsGrant,
            fromCgsRtcCapabilityGrant,
            cgsGrantRow
        );
        const skipClassSlotCastWarnings = fromCgsRtcCapabilityGrant === true;

        if (isDomainSpell) {
            // Domain spells use domain slots only (typically 1 per level). Do not count against regular prepared/spontaneous slots.
            let domainCastSum = 0;
            for (const item of this.items) {
                if (item.type !== "spell") continue;
                if (!domainSpellNamesAtLevel.has((item.name || "").toLowerCase().trim())) continue;
                domainCastSum += (item.system.cast ?? 0);
            }
            // Only warn when they would exceed (not when using the last slot). Avoid warning when domainSlotsAtLevel is 0 (data fallback should grant 1).
            const wouldExceed = domainSlotsAtLevel > 0 && domainCastSum >= domainSlotsAtLevel;
            if (wouldExceed) {
                ui.notifications.warn(game.i18n.format("THIRDERA.Spells.NoSlotsRemaining", { spell: spellItem.name }));
            }
        } else if (useCgsGrantCastMap) {
            const grantUuid = typeof cgsGrantRow.spellUuid === "string" ? cgsGrantRow.spellUuid.trim() : "";
            if (cgsGrantRow.atWill !== true && grantUuid) {
                const cap = normalizeCgsSpellGrantUsesPerDay(cgsGrantRow.usesPerDay);
                if (cap !== undefined && cap > 0) {
                    const used = Number(systemData.cgsSpellGrantCasts?.[grantUuid] ?? 0) || 0;
                    if (used >= cap) {
                        ui.notifications.warn(
                            game.i18n.format("THIRDERA.Spells.CgsGrantUsesExhausted", { spell: spellItem.name })
                        );
                    }
                }
            }
        } else if (preparationType === "spontaneous" && !skipClassSlotCastWarnings) {
            const { SpellData } = await import("../data/item-spell.mjs");
            const spellListKey = classData.spellListKey;
            const shortlistIds = new Set(systemData.spellShortlistByClass?.[classItemId] || []);
            let castSum = 0;
            for (const item of this.items) {
                if (item.type !== "spell") continue;
                if (domainSpellNamesAtLevel.has((item.name || "").toLowerCase().trim())) continue; // exclude domain spells from regular slot count
                const itemLevel = SpellData.getLevelForClass(item.system, spellListKey);
                const onShortlistAtLevel = shortlistIds.has(item.id) && (item.system?.level ?? 0) === level;
                if (itemLevel === level || onShortlistAtLevel) castSum += (item.system.cast ?? 0);
            }
            const remaining = Math.max(0, slotsAtLevel - castSum);
            if (remaining <= 0) {
                ui.notifications.warn(game.i18n.format("THIRDERA.Spells.NoSlotsRemaining", { spell: spellItem.name }));
            }
        } else if (preparationType === "prepared" && !skipClassSlotCastWarnings) {
            const prepared = spellItem.system.prepared ?? 0;
            const cast = spellItem.system.cast ?? 0;
            if (prepared <= 0 || cast >= prepared) {
                ui.notifications.warn(game.i18n.format("THIRDERA.Spells.NoPreparedCastRemaining", { spell: spellItem.name }));
            }
        }

        if (useCgsGrantCastMap) {
            const grantUuid = typeof cgsGrantRow.spellUuid === "string" ? cgsGrantRow.spellUuid.trim() : "";
            if (grantUuid) {
                const prev =
                    systemData.cgsSpellGrantCasts && typeof systemData.cgsSpellGrantCasts === "object"
                        ? /** @type {Record<string, number>} */ (systemData.cgsSpellGrantCasts)
                        : {};
                const next = incrementCgsSpellGrantCastsMap(prev, grantUuid);
                await this.update({ "system.cgsSpellGrantCasts": next });
            }
        } else {
            const currentCast = spellItem.system.cast ?? 0;
            await spellItem.update({ "system.cast": currentCast + 1 });
        }

        const abilityMod = classData.abilityMod ?? 0;
        const abilityName = CONFIG.THIRDERA?.AbilityScores?.[classData.castingAbility] ?? classData.castingAbility ?? "";
        const totalDC = 10 + level + abilityMod;
        const abilityModSigned = abilityMod >= 0 ? `+${abilityMod}` : String(abilityMod);
        const srKey = spellItem.system.spellResistance ?? "";
        const srLabel = (CONFIG.THIRDERA?.spellResistanceChoices?.[srKey] ?? srKey) || "-";

        const actorName = this.name;
        const spellName = spellItem.name;
        const castsLabel = game.i18n.localize("THIRDERA.Spells.CastMessageCastsVerb");
        const dcPayload = { spellLevel: level, abilityMod: abilityModSigned, abilityName, total: totalDC };
        const srPayload = { value: srLabel };
        const dcLine = abilityMod === 0
            ? game.i18n.format("THIRDERA.Spells.SaveDCBreakdownNoAbility", { spellLevel: level, total: totalDC })
            : game.i18n.format("THIRDERA.Spells.SaveDCBreakdown", dcPayload);
        const srLine = game.i18n.format("THIRDERA.Spells.SpellResistanceLine", srPayload);

        let targetActorUuids = [];
        let targetNamesLine = "";
        if (Array.isArray(rawTargets) && rawTargets.length > 0) {
            const seen = new Set();
            const names = [];
            for (const t of rawTargets) {
                const actor = typeof t === "string" ? await foundry.utils.fromUuid(t) : t;
                if (actor?.uuid && (actor.type === "character" || actor.type === "npc") && !seen.has(actor.uuid)) {
                    seen.add(actor.uuid);
                    targetActorUuids.push(actor.uuid);
                    names.push(actor.name || "?");
                }
            }
            if (targetActorUuids.length > 0) {
                targetNamesLine = `<p class="cast-targets">${game.i18n.format("THIRDERA.Spells.TargetsLine", { names: names.join(", ") })}</p>`;
            }
        }

        const spellTypeUuids = await resolveSpellTargetTypeUuidsFromPacks(spellItem.system);
        let creatureTypeRestrictionLine = "";
        if (spellTypeUuids.length > 0) {
            const typeNames = spellTypeUuids.map((u) => {
                try {
                    const doc = foundry.utils.fromUuidSync(u);
                    return doc?.name || u;
                } catch (_) { return u; }
            });
            creatureTypeRestrictionLine = `<p class="cast-type-restriction">${game.i18n.format("THIRDERA.SpellCreatureTypeTargetingChatLine", { types: typeNames.join(", ") })}</p>`;

            if (targetActorUuids.length > 0) {
                const targetData = [];
                for (const uuid of targetActorUuids) {
                    try {
                        const a = foundry.utils.fromUuidSync(uuid);
                        if (a?.system) targetData.push({ name: a.name || "?", uuid, systemData: a.system });
                    } catch (_) { /* skip */ }
                }
                const { results } = validateSpellTargetsCreatureTypes(spellTypeUuids, targetData);
                for (const r of results) {
                    if (!r.valid) {
                        ui.notifications.warn(game.i18n.format("THIRDERA.SpellCreatureTypeTargetingCastWarn", {
                            spell: spellName,
                            target: r.name
                        }));
                    }
                }
            }
        }

        const grantSourceLine = useCgsGrantCastMap
            ? `<p class="cast-grant-source">${game.i18n.localize("THIRDERA.CGS.CastMessageFromCapabilityGrant")}</p>`
            : "";

        const content = `<div class="thirdera cast-message">
  <p><strong>${actorName}</strong> ${castsLabel} <strong>${spellName}</strong>.</p>
  ${grantSourceLine}
  <div class="cast-dc-breakdown">${dcLine}</div>
  <p>${srLine}</p>
  ${creatureTypeRestrictionLine}
  ${targetNamesLine}
</div>`;

        const saveType = parseSaveType(spellItem.system.savingThrow);
        const casterLevelRaw = classData.casterLevel;
        const casterLevel =
            typeof casterLevelRaw === "number" && Number.isFinite(casterLevelRaw) ? Math.max(0, Math.floor(casterLevelRaw)) : 0;

        const spellCastFlags = {
            dc: totalDC,
            saveType,
            spellName,
            spellUuid: spellItem.uuid ?? null,
            spellLevel: level,
            classItemId,
            casterLevel,
            srKey: srKey || "",
            viaCgsGrant: useCgsGrantCastMap
        };
        if (targetActorUuids.length > 0) {
            spellCastFlags.targetActorUuids = targetActorUuids;
        }

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content,
            flags: { thirdera: { spellCast: spellCastFlags } }
        });

        return true;
    }

    /**
     * Resolve a source (Item or UUID string) to a spell document. Returns null if not found or not a spell.
     * @param {Item|string} source - Spell document or UUID of a spell document
     * @returns {Promise<Item|null>}
     */
    static async _resolveSpellSource(source) {
        if (!source) return null;
        let doc = typeof source === "string" ? await foundry.utils.fromUuid(source) : source;
        if (!doc?.type || doc.type !== "spell") return null;
        return doc;
    }

    /**
     * Add a single spell to this actor with source UUID so it can be recognized as "already known" (e.g. in level-up Spell List).
     * @param {Item|string} source - Spell document or UUID of a spell document
     * @param {{ embeddedAsCgsGrantOnly?: boolean }} [options] - When true, marks the embed so it can be removed when CGS spell grants no longer reference it.
     * @returns {Promise<Item|null>} The created embedded spell item, or null if source invalid or not a spell
     */
    async addSpell(source, { embeddedAsCgsGrantOnly = false } = {}) {
        const doc = await ThirdEraActor._resolveSpellSource(source);
        if (!doc) return null;
        const clone = doc.toObject();
        delete clone._id;
        clone.flags = {
            ...clone.flags,
            thirdera: {
                ...(clone.flags?.thirdera || {}),
                sourceSpellUuid: doc.uuid,
                ...(embeddedAsCgsGrantOnly ? { embeddedForCgsGrant: true } : {})
            }
        };
        const created = await this.createEmbeddedDocuments("Item", [clone]);
        return created?.[0] ?? null;
    }

    /**
     * Add multiple spells to this actor with source UUIDs. All valid sources are created in one batch.
     * @param {Array<Item|string>} sources - Array of spell documents or UUIDs
     * @returns {Promise<Item[]>} The created embedded spell items (order matches successful sources)
     */
    async addSpells(sources) {
        if (!Array.isArray(sources) || sources.length === 0) return [];
        const toCreate = [];
        for (const source of sources) {
            const doc = await ThirdEraActor._resolveSpellSource(source);
            if (!doc) continue;
            const clone = doc.toObject();
            delete clone._id;
            clone.flags = {
                ...clone.flags,
                thirdera: {
                    ...(clone.flags?.thirdera || {}),
                    sourceSpellUuid: doc.uuid
                }
            };
            toCreate.push(clone);
        }
        if (toCreate.length === 0) return [];
        return this.createEmbeddedDocuments("Item", toCreate);
    }
}
