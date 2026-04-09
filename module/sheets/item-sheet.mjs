/**
 * Item sheet for Third Era items using ApplicationV2
 * @extends {foundry.applications.sheets.ItemSheetV2}
 */
import { addDomainSpellsToActor, getSpellsForDomain } from "../logic/domain-spells.mjs";
import {
    buildSystemUpdateSourceChangesFromReturnedItem,
    staleSheetItemDocNeedsSystemResync
} from "../logic/cgs-stale-item-sheet-sync.mjs";
import { getSystemChangesFromForm } from "../logic/mechanical-effects-form.mjs";
import { SkillPickerDialog } from "../applications/skill-picker-dialog.mjs";
import { buildSpellGrantSheetRowsFromGrants } from "../logic/cgs-spell-grant-item-sheet.mjs";
import {
    buildDamageReductionSheetRowsFromGrants,
    buildEnergyResistanceSheetRowsFromGrants,
    buildImmunitySheetRowsFromGrants
} from "../logic/cgs-typed-defense-item-sheet.mjs";
import {
    buildCreatureTypeOverlaySheetRowsFromGrants,
    buildSubtypeOverlaySheetRowsFromGrants
} from "../logic/cgs-type-overlay-item-sheet.mjs";

export class ThirdEraItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.sheets.ItemSheetV2
) {

    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["thirdera", "sheet", "item"],
        position: { width: 520, height: 600 },
        form: {
            submitOnChange: true,
            closeOnSubmit: false
        },
        window: {
            resizable: true,
            minimizable: true,
            controls: [
                {
                    icon: "fa-solid fa-trash",
                    label: "Delete",
                    action: "deleteItem",
                }
            ]
        },
        actions: {
            rollAttack: ThirdEraItemSheet.onRollAttack,
            rollDamage: ThirdEraItemSheet.onRollDamage,
            changeTab: ThirdEraItemSheet.onChangeTab,
            deleteItem: ThirdEraItemSheet.onItemDeleteHeader,
            removeClassSkill: ThirdEraItemSheet.onRemoveClassSkill,
            removeExcludedSkill: ThirdEraItemSheet.onRemoveExcludedSkill,
            removeFeature: ThirdEraItemSheet.onRemoveFeature,
            addAutoGrantedFeat: ThirdEraItemSheet.onAddAutoGrantedFeat,
            removeAutoGrantedFeat: ThirdEraItemSheet.onRemoveAutoGrantedFeat,
            setAutoGrantedToConditional: ThirdEraItemSheet.onSetAutoGrantedToConditional,
            setAutoGrantedToUnconditional: ThirdEraItemSheet.onSetAutoGrantedToUnconditional,
            addConditionalFeatUuid: ThirdEraItemSheet.onAddConditionalFeatUuid,
            removeConditionalFeatUuid: ThirdEraItemSheet.onRemoveConditionalFeatUuid,
            removeDomain: ThirdEraItemSheet.onRemoveDomain,
            addScalingRow: ThirdEraItemSheet.onAddScalingRow,
            removeScalingRow: ThirdEraItemSheet.onRemoveScalingRow,
            removeLevelByClass: ThirdEraItemSheet.onRemoveLevelByClass,
            removeLevelByDomain: ThirdEraItemSheet.onRemoveLevelByDomain,
            clearSchool: ThirdEraItemSheet.onClearSchool,
            addSchoolDescriptor: ThirdEraItemSheet.onAddSchoolDescriptor,
            removeSchoolDescriptor: ThirdEraItemSheet.onRemoveSchoolDescriptor,
            removeOppositionSchool: ThirdEraItemSheet.onRemoveOppositionSchool,
            addSubschool: ThirdEraItemSheet.onAddSubschool,
            removeSubschool: ThirdEraItemSheet.onRemoveSubschool,
            addDescriptorTag: ThirdEraItemSheet.onAddDescriptorTag,
            removeDescriptorTag: ThirdEraItemSheet.onRemoveDescriptorTag,
            openConditionDescription: ThirdEraItemSheet.onOpenConditionDescription,
            openEditorBox: ThirdEraItemSheet.onOpenEditorBox,
            addConditionChange: ThirdEraItemSheet.onAddMechanicalEffectRow,
            removeConditionChange: ThirdEraItemSheet.onRemoveMechanicalEffectRow,
            addFeatModifierChange: ThirdEraItemSheet.onAddMechanicalEffectRow,
            removeFeatModifierChange: ThirdEraItemSheet.onRemoveMechanicalEffectRow,
            addMechanicalEffectRow: ThirdEraItemSheet.onAddMechanicalEffectRow,
            removeMechanicalEffectRow: ThirdEraItemSheet.onRemoveMechanicalEffectRow,
            chooseSkillForModifier: ThirdEraItemSheet.onChooseSkillForModifier,
            editImage: ThirdEraItemSheet.onEditImage,
            addPrerequisiteFeat: ThirdEraItemSheet.onAddPrerequisiteFeat,
            removePrerequisiteFeat: ThirdEraItemSheet.onRemovePrerequisiteFeat,
            addCgsSense: ThirdEraItemSheet.onAddCgsSense,
            removeCgsSense: ThirdEraItemSheet.onRemoveCgsSense,
            addCgsSpellGrant: ThirdEraItemSheet.onAddCgsSpellGrant,
            removeCgsSpellGrant: ThirdEraItemSheet.onRemoveCgsSpellGrant,
            addCgsTypedDefense: ThirdEraItemSheet.onAddCgsTypedDefense,
            removeCgsTypedDefense: ThirdEraItemSheet.onRemoveCgsTypedDefense,
            addCgsTypeOverlay: ThirdEraItemSheet.onAddCgsTypeOverlay,
            removeCgsTypeOverlay: ThirdEraItemSheet.onRemoveCgsTypeOverlay,
            removeMechanicalCreatureGate: ThirdEraItemSheet.onRemoveMechanicalCreatureGate,
            removeSpellCreatureTypeTarget: ThirdEraItemSheet.onRemoveSpellCreatureTypeTarget,
            addSpellCreatureTypeTargetFromSelect: ThirdEraItemSheet.onAddSpellCreatureTypeTargetFromSelect
        }
    };

    /** @override */
    static PARTS = {
        sheet: {
            template: "systems/thirdera/templates/item/item-weapon-sheet.hbs",
            scrollable: [".sheet-body"],
            root: true
        }
    };

    /** @override */
    tabGroups = {
        primary: "description"
    };

    /** @override */
    _configureRenderParts(options) {
        const parts = super._configureRenderParts(options);
        // Dynamically set the template based on item type
        parts.sheet.template = `systems/thirdera/templates/item/item-${this.document.type}-sheet.hbs`;
        parts.sheet.scrollable = [".sheet-body .tab"];
        // Wire form so change/submit on inputs and selects (e.g. spell subschool) trigger document update
        parts.sheet.forms = { "form": this.options.form };
        return parts;
    }

    /** @override */
    _attachPartListeners(partId, htmlElement, options) {
        super._attachPartListeners(partId, htmlElement, options);
        // Sync subschool select to document on every render (fixes value disappearing after panel refresh).
        // Use this.element: for root parts Foundry moves htmlElement's children into the prior DOM node,
        // so htmlElement is detached and has no children; the live form is this.element.
        if (partId === "sheet" && this.document?.type === "spell") {
            const formInDom = this.element?.tagName === "FORM" ? this.element : this.element?.querySelector?.("form");
            const subschoolSel = formInDom?.querySelector?.('select[name="system.schoolSubschool"]');
            const docSubschool = this.document.system?.schoolSubschool ?? "";
            if (subschoolSel) subschoolSel.value = docSubschool;
            const srSel = formInDom?.querySelector?.('select[name="system.spellResistance"]');
            const docSr = this.document.system?.spellResistance ?? "";
            if (srSel) srSel.value = docSr;
        }
        // Sync auto-granted feat selects to document on every render (fixes value disappearing after panel refresh).
        if (partId === "sheet" && this.document?.type === "class") {
            const formInDom = this.element?.tagName === "FORM" ? this.element : this.element?.querySelector?.("form");
            const ag = this.document?.system?.autoGrantedFeats;
            const arr = Array.isArray(ag) ? ag : (ag && typeof ag === "object" ? Object.keys(ag).filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b)).map(k => ag[k]) : []);
            for (let i = 0; i < arr.length; i++) {
                const entry = arr[i];
                const featUuidSel = formInDom?.querySelector(`select[name="system.autoGrantedFeats.${i}.featUuid"]`);
                if (featUuidSel && entry) {
                    const docVal = (entry.featUuid ?? "").trim();
                    if (featUuidSel.value !== docVal) featUuidSel.value = docVal;
                }
                const featUuids = entry?.featUuids ?? [];
                for (let j = 0; j < featUuids.length; j++) {
                    const condSel = formInDom?.querySelector(`select[name="system.autoGrantedFeats.${i}.featUuids.${j}"]`);
                    if (condSel) {
                        const docVal = (featUuids[j] != null ? String(featUuids[j]).trim() : "");
                        if (condSel.value !== docVal) condSel.value = docVal;
                    }
                }
            }
            // Intercept change on conditional feat selects: update document directly and prevent form submit so a one-slot submit cannot race with "Add feat to list" and overwrite two slots.
            formInDom?.addEventListener("change", (ev) => {
                const el = ev.target;
                if (el?.tagName !== "SELECT" || typeof el?.name !== "string") return;
                const m = el.name.match(/^system\.autoGrantedFeats\.(\d+)\.featUuids\.(\d+)$/);
                if (!m) return;
                const entryIdx = parseInt(m[1], 10);
                const slotIdx = parseInt(m[2], 10);
                if (Number.isNaN(entryIdx) || Number.isNaN(slotIdx)) return;
                const docList = ThirdEraItemSheet.normalizeAutoGrantedFeatsToArray(this.document?.system?.autoGrantedFeats);
                if (entryIdx < 0 || entryIdx >= docList.length) return;
                const value = (el.value != null ? String(el.value) : "").trim();
                const docEntry = docList[entryIdx];
                const docUuids = [...(docEntry?.featUuids ?? [])];
                while (docUuids.length <= slotIdx) docUuids.push("");
                docUuids[slotIdx] = value;
                const toSet = docList.map((e, idx) => ({
                    level: e?.level ?? 1,
                    featUuid: (e?.featUuid ?? "").trim(),
                    featUuids: idx === entryIdx ? docUuids : [...(e?.featUuids ?? [])]
                }));
                this.document.update({ system: { autoGrantedFeats: toSet } }).catch(() => {});
                ev.preventDefault();
                ev.stopImmediatePropagation();
            }, true);
        }
        if (partId === "sheet" && ThirdEraItemSheet.#itemTypesWithCgsSensesUi.has(this.document?.type)) {
            const formCgs = this.element?.tagName === "FORM" ? this.element : this.element?.querySelector?.("form");
            formCgs?.addEventListener(
                "change",
                (ev) => {
                    const el = ev.target;
                    if (!el?.classList?.contains?.("cgs-spell-grant-field")) return;
                    ev.preventDefault();
                    ev.stopImmediatePropagation();
                    ThirdEraItemSheet.onCgsSpellGrantFieldChange(this, el).catch(() => {});
                },
                true
            );
            formCgs?.addEventListener(
                "change",
                (ev) => {
                    const el = ev.target;
                    if (!el?.classList?.contains?.("cgs-defense-field")) return;
                    ev.preventDefault();
                    ev.stopImmediatePropagation();
                    ThirdEraItemSheet.onCgsTypedDefenseFieldChange(this, el).catch(() => {});
                },
                true
            );
            formCgs?.addEventListener(
                "change",
                (ev) => {
                    const el = ev.target;
                    if (!el?.classList?.contains?.("cgs-type-overlay-field")) return;
                    ev.preventDefault();
                    ev.stopImmediatePropagation();
                    ThirdEraItemSheet.onCgsTypeOverlayFieldChange(this, el).catch(() => {});
                },
                true
            );
        }
        // Mechanical effects table: save on blur and Enter (condition, feat, race, armor, weapon, equipment)
        if (partId === "sheet") {
            const root = this.element;
            const fields = root?.querySelectorAll?.(".mechanical-effects-field");
            if (fields?.length) {
                fields.forEach((el) => {
                    el.addEventListener("blur", () => {
                        if (this._preservedScrollTop === undefined) {
                            const tab = root?.querySelector?.(".sheet-body .tab.active");
                            if (tab) this._preservedScrollTop = tab.scrollTop;
                        }
                        this.submit();
                    });
                    el.addEventListener("keydown", (e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            if (this._preservedScrollTop === undefined) {
                                const tab = root?.querySelector?.(".sheet-body .tab.active");
                                if (tab) this._preservedScrollTop = tab.scrollTop;
                            }
                            this.submit();
                        }
                    });
                });
            }
            // Phase 6: sync key-type dropdown to hidden key input; when "Skill" is selected, open picker instead of showing button
            const keyTypeSelects = root?.querySelectorAll?.(".mechanical-effects-key-type");
            if (keyTypeSelects?.length) {
                keyTypeSelects.forEach((select) => {
                    select.addEventListener("change", async () => {
                        const row = select.closest(".mechanical-effects-row");
                        const keyInput = row?.querySelector?.(".mechanical-effects-key-input");
                        if (!keyInput || select.value === undefined) return;
                        if (select.value === "skill") {
                            const idx = parseInt(row?.dataset?.changeIndex ?? select.dataset?.changeIndex, 10);
                            const prevKey = keyInput.value || "";
                            const dialog = new SkillPickerDialog({
                                id: "thirdera-skill-picker",
                                resolve: async (skillKey) => {
                                    if (!skillKey || Number.isNaN(idx)) return;
                                    const tab = this.element?.querySelector?.(".sheet-body .tab.active");
                                    if (tab) this._preservedScrollTop = tab.scrollTop;
                                    const doc = this.document;
                                    const updates = [...(doc.system.changes || [])];
                                    if (updates[idx]) {
                                        updates[idx] = { ...updates[idx], key: `skill.${skillKey}` };
                                        await doc.update({ "system.changes": updates }, { render: false });
                                        if (doc.type === "feat") await this._syncWorldFeatToActorCopies();
                                        else if (doc.type === "race" && !doc.actor && doc.uuid) await this._syncWorldRaceToActorCopies();
                                        else if (doc.type !== "condition") {
                                            if (doc.actor) {
                                                const actor = doc.actor;
                                                if (typeof actor.prepareData === "function") await actor.prepareData();
                                                if (actor.sheet?.rendered) await actor.sheet.render();
                                            } else if (["armor", "weapon", "equipment"].includes(doc.type) && doc.uuid) {
                                                await this._syncWorldItemToActorCopies();
                                            }
                                        }
                                        await this.render(true);
                                    }
                                },
                                onClose: () => {
                                    select.value = prevKey ? (prevKey.startsWith("skill.") ? "skill" : prevKey) : "";
                                }
                            });
                            await dialog.render(true);
                            return;
                        }
                        keyInput.value = select.value;
                        if (this._preservedScrollTop === undefined) {
                            const tab = root?.querySelector?.(".sheet-body .tab.active");
                            if (tab) this._preservedScrollTop = tab.scrollTop;
                        }
                        this.submit();
                    });
                });
            }
        }
    }

    /** @override */
    async _preparePartContext(partId, context, options) {
        return super._preparePartContext(partId, context, options);
    }

    /** @override */
    async _renderHTML(context, options) {
        return super._renderHTML(context, options);
    }

    /** @override */
    _onChangeForm(formConfig, event) {
        return super._onChangeForm(formConfig, event);
    }

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const item = this.document;
        let systemData = item.system;
        try {
            return await this._prepareContextBody(context, item, systemData);
        } catch (err) {
            console.error("[ThirdEra] Item sheet _prepareContext error:", err);
            throw err;
        }
    }

    /**
     * Body of _prepareContext (split so we can try/catch and log).
     * @param {object} context - from super._prepareContext
     * @param {Item} item - this.document
     * @param {object} systemData - item.system
     * @returns {Promise<object>} context for template
     */
    async _prepareContextBody(context, item, systemData) {

        // Add CONFIG data
        const config = {
            abilityScores: CONFIG.THIRDERA?.AbilityScores || {},
            saves: CONFIG.THIRDERA?.Saves || {},
            armorTypes: CONFIG.THIRDERA?.armorTypes || {},
            sizes: CONFIG.THIRDERA?.sizes || {},
            weaponHandedness: CONFIG.THIRDERA?.weaponHandedness || {},
            hitDice: CONFIG.THIRDERA?.hitDice || {},
            babProgressions: CONFIG.THIRDERA?.babProgressions || {},
            saveProgressions: CONFIG.THIRDERA?.saveProgressions || {},
            casterTypes: CONFIG.THIRDERA?.casterTypes || {},
            preparationTypes: CONFIG.THIRDERA?.preparationTypes || {},
            spellListAccessTypes: CONFIG.THIRDERA?.spellListAccessTypes || {},
            castingAbilities: CONFIG.THIRDERA?.castingAbilities || {},
            spellListKeys: CONFIG.THIRDERA?.spellListKeys || {},
            spellResistanceChoices: CONFIG.THIRDERA?.spellResistanceChoices || {},
            senseTypes: CONFIG.THIRDERA?.senseTypes || {},
            immunityTags: CONFIG.THIRDERA?.immunityTags || {},
            energyTypes: CONFIG.THIRDERA?.energyTypes || {},
            drBypassTypes: CONFIG.THIRDERA?.drBypassTypes || {}
        };

        // Enrich HTML description and other fields
        const enriched = {
            description: await foundry.applications.ux.TextEditor.enrichHTML(systemData.description, { async: true, relativeTo: item }),
            materialDescription: await foundry.applications.ux.TextEditor.enrichHTML(systemData.components?.materialDescription || "<ul><li></li></ul>", { async: true, relativeTo: item }),
            benefit: systemData.benefit ? await foundry.applications.ux.TextEditor.enrichHTML(systemData.benefit, { async: true, relativeTo: item }) : "",
            special: systemData.special ? await foundry.applications.ux.TextEditor.enrichHTML(systemData.special, { async: true, relativeTo: item }) : "",
            otherRacialTraits:
                item.type === "race" && systemData.otherRacialTraits
                    ? await foundry.applications.ux.TextEditor.enrichHTML(systemData.otherRacialTraits, {
                          async: true,
                          relativeTo: item
                      })
                    : ""
        };

        // Prepare spells per day table - ensure we have entries for all 20 levels
        let spellsPerDayTable = [];
        if (item.type === "class" && systemData.spellcasting?.spellsPerDayTable) {
            const existingTable = systemData.spellcasting.spellsPerDayTable;
            for (let level = 1; level <= 20; level++) {
                const existingEntry = existingTable.find(e => e.classLevel === level);
                if (existingEntry) {
                    spellsPerDayTable.push(existingEntry);
                } else {
                    // Create default entry for this level
                    spellsPerDayTable.push({
                        classLevel: level,
                        spellLevel0: 0,
                        spellLevel1: 0,
                        spellLevel2: 0,
                        spellLevel3: 0,
                        spellLevel4: 0,
                        spellLevel5: 0,
                        spellLevel6: 0,
                        spellLevel7: 0,
                        spellLevel8: 0,
                        spellLevel9: 0
                    });
                }
            }
        } else if (item.type === "class") {
            // Initialize empty table for all 20 levels
            for (let level = 1; level <= 20; level++) {
                spellsPerDayTable.push({
                    classLevel: level,
                    spellLevel0: 0,
                    spellLevel1: 0,
                    spellLevel2: 0,
                    spellLevel3: 0,
                    spellLevel4: 0,
                    spellLevel5: 0,
                    spellLevel6: 0,
                    spellLevel7: 0,
                    spellLevel8: 0,
                    spellLevel9: 0
                });
            }
        }

        // Prepare spells known table (spontaneous casters) - same shape as spells per day, entries for levels 1-20
        let spellsKnownTable = [];
        if (item.type === "class" && systemData.spellcasting?.preparationType === "spontaneous") {
            const existingTable = systemData.spellcasting.spellsKnownTable ?? [];
            for (let level = 1; level <= 20; level++) {
                const existingEntry = existingTable.find(e => e.classLevel === level);
                if (existingEntry) {
                    spellsKnownTable.push(existingEntry);
                } else {
                    spellsKnownTable.push({
                        classLevel: level,
                        spellLevel0: 0,
                        spellLevel1: 0,
                        spellLevel2: 0,
                        spellLevel3: 0,
                        spellLevel4: 0,
                        spellLevel5: 0,
                        spellLevel6: 0,
                        spellLevel7: 0,
                        spellLevel8: 0,
                        spellLevel9: 0
                    });
                }
            }
        }

        // For spells with a school: look up the school to populate subschool and descriptor options
        let schoolSubschoolOptions = [];
        let schoolDescriptorOptions = [];
        let schoolDescriptorOptionsForAdd = [];
        if (item.type === "spell" && systemData.schoolKey) {
            const school = await ThirdEraItemSheet.findSchoolByKey(systemData.schoolKey);
            if (school) {
                const subschools = school.system?.subschools ?? [];
                const descriptorTags = school.system?.descriptorTags ?? [];
                schoolSubschoolOptions = [...new Set(subschools)].filter(Boolean).sort();
                schoolDescriptorOptions = [...new Set(descriptorTags)].filter(Boolean).sort();
                // Include current values if not in school list (preserves legacy/custom)
                const currentSub = systemData.schoolSubschool?.trim();
                if (currentSub && !schoolSubschoolOptions.includes(currentSub)) {
                    schoolSubschoolOptions.push(currentSub);
                    schoolSubschoolOptions.sort();
                }
                const currentDescs = systemData.schoolDescriptors ?? [];
                for (const d of currentDescs) {
                    const t = d?.trim();
                    if (t && !schoolDescriptorOptions.includes(t)) {
                        schoolDescriptorOptions.push(t);
                    }
                }
                schoolDescriptorOptions.sort();
                // Options available to add (exclude already selected)
                const selected = new Set(currentDescs.map((d) => d?.trim()).filter(Boolean));
                schoolDescriptorOptionsForAdd = schoolDescriptorOptions.filter((opt) => !selected.has(opt));
            }
            // Always include current subschool so the select is rendered and can show it (e.g. when school item not found)
            const currentSub = systemData.schoolSubschool?.trim();
            if (currentSub && !schoolSubschoolOptions.includes(currentSub)) {
                schoolSubschoolOptions.push(currentSub);
                schoolSubschoolOptions.sort();
            }
        }

        // Domain: granted spells derived from spell documents' levelsByDomain (read-only on sheet)
        let grantedSpells = [];
        if (item.type === "domain" && systemData.key) {
            grantedSpells = getSpellsForDomain(systemData.key);
        }

        // Class: auto-granted feats — build available feats list and display names for current entries
        let availableFeats = [];
        let autoGrantedFeatsForDisplay = [];
        /** @type {Array<{level?: number, featUuid?: string, featUuids?: string[]}>} */
        let autoGrantedFeatsArray = [];
        if (item.type === "class") {
            const seen = new Map();
            const worldFeats = (game.items?.contents ?? []).filter((i) => i.type === "feat");
            for (const doc of worldFeats) {
                const u = doc.uuid?.trim();
                if (!u) continue;
                if (!seen.has(u)) seen.set(u, { uuid: u, name: doc.name || "—", packName: game.i18n.localize("Type.world") || "World" });
            }
            for (const pack of game.packs?.values() ?? []) {
                if (pack.documentName !== "Item") continue;
                try {
                    const docs = await pack.getDocuments({ type: "feat" });
                    for (const doc of docs) {
                        const u = doc.uuid?.trim();
                        if (!u) continue;
                        if (!seen.has(u)) seen.set(u, { uuid: u, name: doc.name || "—", packName: pack.metadata?.label ?? pack.collection });
                    }
                } catch (_) { /* ignore */ }
            }
            availableFeats = [...seen.values()].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));

            autoGrantedFeatsArray = ThirdEraItemSheet.normalizeAutoGrantedFeatsToArray(systemData.autoGrantedFeats);
            for (const entry of autoGrantedFeatsArray) {
                const featUuid = (entry.featUuid ?? "").trim();
                let featName = "";
                if (featUuid) {
                    const match = availableFeats.find((f) => f.uuid === featUuid);
                    featName = match ? match.name : "";
                    if (!featName) {
                        try {
                            const doc = await foundry.utils.fromUuid(featUuid);
                            featName = doc?.name ?? game.i18n.localize("THIRDERA.LevelUp.FeatureUnknown") ?? "—";
                        } catch (_) {
                            featName = "—";
                        }
                    }
                }
                autoGrantedFeatsForDisplay.push({ level: entry.level ?? 1, featUuid, featName });
            }
        }

        // Class/race skill lists: resolve key → display name so we store only key
        let classSkillsForDisplay = [];
        let excludedSkillsForDisplay = [];
        if (item.type === "class" && systemData.classSkills?.length) {
            classSkillsForDisplay = systemData.classSkills
                .map((e) => ({
                    key: e.key,
                    displayName: e.name?.trim() || ThirdEraItemSheet.getSkillDisplayName(e.key) || e.key
                }))
                .sort((a, b) => a.displayName.localeCompare(b.displayName));
        }
        if (item.type === "race" && systemData.excludedSkills?.length) {
            excludedSkillsForDisplay = systemData.excludedSkills
                .map((e) => ({
                    key: e.key,
                    displayName: e.name?.trim() || ThirdEraItemSheet.getSkillDisplayName(e.key) || e.key
                }))
                .sort((a, b) => a.displayName.localeCompare(b.displayName));
        }

        // Feat: resolve prerequisite feat UUIDs to names for display; build dropdown of available feats (world + compendiums)
        let prerequisiteFeatsDisplay = [];
        let availableFeatsForPrereq = [];
        if (item.type === "feat") {
            const existingUuids = new Set((systemData.prerequisiteFeatUuids ?? []).map((u) => String(u).trim()).filter(Boolean));
            for (const u of systemData.prerequisiteFeatUuids ?? []) {
                const uuid = String(u).trim();
                if (!uuid) continue;
                let name = game.i18n.localize("THIRDERA.FeatPrereq.UnknownFeat");
                try {
                    const doc = await foundry.utils.fromUuid(uuid);
                    if (doc?.name) name = doc.name;
                } catch (_) { /* ignore */ }
                prerequisiteFeatsDisplay.push({ uuid, name });
            }
            const seen = new Map();
            const worldFeats = (game.items?.contents ?? []).filter((i) => i.type === "feat");
            for (const doc of worldFeats) {
                const u = doc.uuid?.trim();
                if (!u || existingUuids.has(u)) continue;
                const name = doc.name || game.i18n.localize("THIRDERA.FeatPrereq.UnknownFeat");
                if (!seen.has(u)) seen.set(u, { uuid: u, name, packName: game.i18n.localize("Type.world") || "World" });
            }
            for (const pack of game.packs?.values() ?? []) {
                if (pack.documentName !== "Item") continue;
                try {
                    const docs = await pack.getDocuments({ type: "feat" });
                    for (const doc of docs) {
                        const u = doc.uuid?.trim();
                        if (!u || existingUuids.has(u)) continue;
                        const name = doc.name || game.i18n.localize("THIRDERA.FeatPrereq.UnknownFeat");
                        if (!seen.has(u)) seen.set(u, { uuid: u, name, packName: pack.metadata?.label ?? pack.collection });
                    }
                } catch (_) { /* ignore */ }
            }
            availableFeatsForPrereq = [...seen.values()].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
        }

        // For class, expose system as a plain object with autoGrantedFeats normalized to an array (Handlebars needs plain objects).
        // Add _index to each entry so the template can output correct select names inside nested {{#each}} (../index is not in scope there).
        // For conditional entries, add _featsForSlot[j] = feats available for slot j (exclude feats already chosen in slots 0..j-1; include current slot value so selection shows).
        let systemForContext = systemData;
        if (item.type === "condition") {
            // Ensure system is always an object with changes array so template never sees undefined (avoids "Cannot convert undefined or null to object" in selectOptions/each).
            systemForContext = { ...(systemData || {}), changes: Array.isArray(systemData?.changes) ? systemData.changes : [] };
        }
        if (item.type === "feat") {
            systemForContext = { ...(systemData || {}), changes: Array.isArray(systemData?.changes) ? systemData.changes : [] };
        }
        if (item.type === "race") {
            systemForContext = { ...(systemData || {}), changes: Array.isArray(systemData?.changes) ? systemData.changes : [] };
        }
        if (item.type === "feature") {
            const plain =
                typeof systemData?.toObject === "function"
                    ? systemData.toObject(false)
                    : { ...(systemData || {}) };
            const cg = systemData?.cgsGrants;
            plain.cgsGrants = {
                grants: foundry.utils.duplicate(cg?.grants ?? []),
                senses: foundry.utils.duplicate(cg?.senses ?? [])
            };
            systemForContext = plain;
        }
        if (item.type === "armor" || item.type === "weapon" || item.type === "equipment") {
            systemForContext = {
                ...(systemData || {}),
                changes: Array.isArray(systemData?.changes) ? systemData.changes : [],
                mechanicalCreatureGateUuids: foundry.utils.duplicate(systemData?.mechanicalCreatureGateUuids ?? [])
            };
        }
        if (item.type === "defenseCatalog") {
            systemForContext =
                typeof systemData?.toObject === "function"
                    ? systemData.toObject(false)
                    : { ...(systemData || {}) };
        }
        const grantsForSpellUi = Array.isArray(systemForContext?.cgsGrants?.grants)
            ? systemForContext.cgsGrants.grants
            : Array.isArray(systemData?.cgsGrants?.grants)
              ? systemData.cgsGrants.grants
              : [];
        /** @type {ReturnType<typeof buildSpellGrantSheetRowsFromGrants>} */
        let cgsSpellGrantRows = [];
        /** @type {ReturnType<typeof buildImmunitySheetRowsFromGrants>} */
        let cgsImmunityRows = [];
        /** @type {ReturnType<typeof buildEnergyResistanceSheetRowsFromGrants>} */
        let cgsEnergyResistanceRows = [];
        /** @type {ReturnType<typeof buildDamageReductionSheetRowsFromGrants>} */
        let cgsDamageReductionRows = [];
        /** @type {ReturnType<typeof buildCreatureTypeOverlaySheetRowsFromGrants>} */
        let cgsCreatureTypeOverlayRows = [];
        /** @type {ReturnType<typeof buildSubtypeOverlaySheetRowsFromGrants>} */
        let cgsSubtypeOverlayRows = [];
        /** @type {Array<{ uuid: string, name: string }>} */
        let cgsOverlayCreatureTypeChoices = [];
        /** @type {Array<{ uuid: string, name: string }>} */
        let cgsOverlaySubtypeChoices = [];
        if (ThirdEraItemSheet.#itemTypesWithCgsSensesUi.has(item.type)) {
            const spellNameForUuid = (uuid) => {
                try {
                    const d = foundry.utils.fromUuidSync(uuid);
                    return (d?.name && String(d.name)) || "";
                } catch (_) {
                    return "";
                }
            };
            cgsSpellGrantRows = buildSpellGrantSheetRowsFromGrants(grantsForSpellUi, { spellNameForUuid });
            cgsImmunityRows = buildImmunitySheetRowsFromGrants(grantsForSpellUi);
            cgsEnergyResistanceRows = buildEnergyResistanceSheetRowsFromGrants(grantsForSpellUi);
            cgsDamageReductionRows = buildDamageReductionSheetRowsFromGrants(grantsForSpellUi);
            cgsCreatureTypeOverlayRows = buildCreatureTypeOverlaySheetRowsFromGrants(grantsForSpellUi);
            cgsSubtypeOverlayRows = buildSubtypeOverlaySheetRowsFromGrants(grantsForSpellUi);
            const typesPack = game.packs.get("thirdera.thirdera_creature_types");
            const subtypesPack = game.packs.get("thirdera.thirdera_subtypes");
            const typesFromPack = typesPack ? await typesPack.getDocuments() : [];
            const typesFromWorld = (game.items?.contents ?? []).filter((i) => i.type === "creatureType");
            const subtypesFromPack = subtypesPack ? await subtypesPack.getDocuments() : [];
            const subtypesFromWorld = (game.items?.contents ?? []).filter((i) => i.type === "subtype");
            const allOvTypes = [...typesFromPack, ...typesFromWorld];
            const allOvSubtypes = [...subtypesFromPack, ...subtypesFromWorld];
            const ovSort = (a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
            cgsOverlayCreatureTypeChoices = allOvTypes
                .map((doc) => ({ uuid: doc.uuid, name: doc.name || "—" }))
                .sort((a, b) => ovSort({ name: a.name }, { name: b.name }));
            cgsOverlaySubtypeChoices = allOvSubtypes
                .map((doc) => ({ uuid: doc.uuid, name: doc.name || "—" }))
                .sort((a, b) => ovSort({ name: a.name }, { name: b.name }));
        }

        /** @type {Array<{ gateIndex: number, name: string, uuid: string }>} */
        let mechanicalCreatureGateRows = [];
        if (item.type === "armor" || item.type === "weapon" || item.type === "equipment") {
            const raw = Array.isArray(systemForContext?.mechanicalCreatureGateUuids)
                ? systemForContext.mechanicalCreatureGateUuids
                : [];
            mechanicalCreatureGateRows = raw.map((uuid, gateIndex) => {
                const u = typeof uuid === "string" ? uuid.trim() : "";
                let name = u;
                if (u) {
                    try {
                        const d = foundry.utils.fromUuidSync(u);
                        if (d?.name) name = d.name;
                    } catch (_) {
                        /* keep uuid */
                    }
                }
                return { gateIndex, name, uuid: u };
            });
        }

        /** @type {Array<{ targetIndex: number, name: string, uuid: string }>} */
        let spellCreatureTypeTargetingRows = [];
        /** @type {Array<{ uuid: string, name: string }>} */
        let spellCreatureTypeChoicesTypes = [];
        /** @type {Array<{ uuid: string, name: string }>} */
        let spellCreatureTypeChoicesSubtypes = [];
        let hasSpellCreatureTypeChoicesForAdd = false;
        let hasSpellCreatureTypeChoiceTypes = false;
        let hasSpellCreatureTypeChoiceSubtypes = false;
        if (item.type === "spell") {
            const raw = Array.isArray(systemForContext?.targetCreatureTypeUuids)
                ? systemForContext.targetCreatureTypeUuids
                : [];
            const selected = new Set(
                raw.map((u) => (typeof u === "string" ? u.trim() : "")).filter(Boolean)
            );
            spellCreatureTypeTargetingRows = raw.map((uuid, targetIndex) => {
                const u = typeof uuid === "string" ? uuid.trim() : "";
                let name = u;
                if (u) {
                    try {
                        const d = foundry.utils.fromUuidSync(u);
                        if (d?.name) name = d.name;
                    } catch (_) {
                        /* keep uuid */
                    }
                }
                return { targetIndex, name, uuid: u };
            });
            const typesPack = game.packs.get("thirdera.thirdera_creature_types");
            const subtypesPack = game.packs.get("thirdera.thirdera_subtypes");
            const typesFromPack = typesPack ? await typesPack.getDocuments() : [];
            const typesFromWorld = (game.items?.contents ?? []).filter((i) => i.type === "creatureType");
            const subtypesFromPack = subtypesPack ? await subtypesPack.getDocuments() : [];
            const subtypesFromWorld = (game.items?.contents ?? []).filter((i) => i.type === "subtype");
            const nameSort = (a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
            spellCreatureTypeChoicesTypes = [...typesFromPack, ...typesFromWorld]
                .map((doc) => ({ uuid: (doc.uuid || "").trim(), name: doc.name || "—" }))
                .filter((e) => e.uuid && !selected.has(e.uuid))
                .sort(nameSort);
            spellCreatureTypeChoicesSubtypes = [...subtypesFromPack, ...subtypesFromWorld]
                .map((doc) => ({ uuid: (doc.uuid || "").trim(), name: doc.name || "—" }))
                .filter((e) => e.uuid && !selected.has(e.uuid))
                .sort(nameSort);
            hasSpellCreatureTypeChoiceTypes = spellCreatureTypeChoicesTypes.length > 0;
            hasSpellCreatureTypeChoiceSubtypes = spellCreatureTypeChoicesSubtypes.length > 0;
            hasSpellCreatureTypeChoicesForAdd = hasSpellCreatureTypeChoiceTypes || hasSpellCreatureTypeChoiceSubtypes;
        }

        if (item.type === "class") {
            const rawSystem = item._source?.system ?? item.toObject?.()?.system;
            const systemPlain = (rawSystem && typeof rawSystem === "object")
                ? foundry.utils.deepClone(rawSystem)
                : (typeof systemData?.toObject === "function" ? systemData.toObject() : systemData);
            const autoGrantedWithIndex = autoGrantedFeatsArray.map((e, i) => {
                const base = { ...e, _index: i };
                const uuids = e?.featUuids ?? [];
                if (uuids.length) {
                    base._featsForSlot = uuids.map((_, j) => {
                        const previousUuids = uuids.slice(0, j).map((u) => (u != null ? String(u).trim() : "")).filter(Boolean);
                        const currentVal = (uuids[j] != null ? String(uuids[j]).trim() : "");
                        return availableFeats.filter((f) => {
                            const fu = (f.uuid || "").trim();
                            return fu === currentVal || !previousUuids.includes(fu);
                        });
                    });
                    base._canSwitchToUnconditional = uuids.length < 2;
                }
                return base;
            });
            systemForContext = { ...systemPlain, autoGrantedFeats: autoGrantedWithIndex };
        }

        return {
            ...context,
            item,
            system: systemForContext,
            config,
            enriched,
            tabs: this.tabGroups,
            editable: this.isEditable,
            isOwned: !!item.parent,
            spellsPerDayTable,
            spellsKnownTable,
            schoolSubschoolOptions,
            schoolDescriptorOptions,
            schoolDescriptorOptionsForAdd,
            hasSchoolSubschoolOptions: schoolSubschoolOptions.length > 0,
            hasSchoolDescriptorOptionsForAdd: schoolDescriptorOptionsForAdd.length > 0,
            hasSchoolDescriptorsSection: schoolDescriptorOptions.length > 0 || (systemData.schoolDescriptors ?? []).length > 0,
            grantedSpells,
            classSkillsForDisplay,
            excludedSkillsForDisplay,
            prerequisiteFeatsDisplay,
            availableFeatsForPrereq,
            availableFeats,
            autoGrantedFeatsForDisplay,
            // Key options for mechanical effects table (condition, feat, race, armor, weapon, equipment)
            ...(item.type === "armor" || item.type === "equipment" || item.type === "weapon"
                ? {
                      equippedScopeLabelKey:
                          item.type === "weapon"
                              ? "THIRDERA.MechanicalApplyScopeEquippedWeapon"
                              : "THIRDERA.MechanicalApplyScopeEquippedArmor"
                  }
                : {}),
            changeKeyOptions: (item.type === "condition" || item.type === "feat" || item.type === "race" || item.type === "armor" || item.type === "weapon" || item.type === "equipment") ? (ThirdEraItemSheet.getConditionChangeKeyOptions() ?? {}) : {},
            conditionChangeKeys: item.type === "condition" ? (ThirdEraItemSheet.getConditionChangeKeyOptions() ?? {}) : {},
            modifierChangeKeys: (item.type === "feat" || item.type === "race" || item.type === "condition" || item.type === "armor" || item.type === "weapon" || item.type === "equipment") ? (ThirdEraItemSheet.getConditionChangeKeyOptions() ?? {}) : {},
            cgsSpellGrantRows,
            cgsImmunityRows,
            cgsEnergyResistanceRows,
            cgsDamageReductionRows,
            cgsCreatureTypeOverlayRows,
            cgsSubtypeOverlayRows,
            cgsOverlayCreatureTypeChoices,
            cgsOverlaySubtypeChoices,
            mechanicalCreatureGateRows,
            spellCreatureTypeTargetingRows,
            spellCreatureTypeChoicesTypes,
            spellCreatureTypeChoicesSubtypes,
            hasSpellCreatureTypeChoicesForAdd,
            hasSpellCreatureTypeChoiceTypes,
            hasSpellCreatureTypeChoiceSubtypes
        };
    }

    /**
     * Resolve a skill key to a display name from world items (sync). Used for class/race skill lists.
     * @param {string} key   Skill system.key
     * @returns {string}    Skill name or key if not found
     */
    static getSkillDisplayName(key) {
        if (!key || !game.items?.size) return key ?? "";
        const k = String(key).toLowerCase();
        const skill = game.items.find(
            (i) => i.type === "skill" && (i.system?.key ?? "").toLowerCase() === k
        );
        return skill?.name ?? key;
    }

    /** Condition effect key options for the condition sheet dropdown (key -> localized label). Sorted alphabetically by label (blank first). */
    static getConditionChangeKeyOptions() {
        const t = (key) => game.i18n.localize(`THIRDERA.ConditionChangeKeys.${key}`);
        const entries = [
            { key: "ac", label: t("ac") },
            { key: "acLoseDex", label: t("acLoseDex") },
            { key: "speedMultiplier", label: t("speedMultiplier") },
            { key: "saveFort", label: t("saveFort") },
            { key: "saveRef", label: t("saveRef") },
            { key: "saveWill", label: t("saveWill") },
            { key: "initiative", label: t("initiative") },
            { key: "attack", label: t("attack") },
            { key: "attackMelee", label: t("attackMelee") },
            { key: "attackRanged", label: t("attackRanged") },
            { key: "naturalHealingPerDay", label: t("naturalHealingPerDay") },
            { key: "ability.str", label: t("abilityStr") },
            { key: "ability.dex", label: t("abilityDex") },
            { key: "ability.con", label: t("abilityCon") },
            { key: "ability.int", label: t("abilityInt") },
            { key: "ability.wis", label: t("abilityWis") },
            { key: "ability.cha", label: t("abilityCha") },
            { key: "skill", label: t("skill") }
        ];
        entries.sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang ?? "en"));
        const out = { "": "—" };
        for (const { key, label } of entries) {
            out[key] = label;
        }
        return out;
    }

    /**
     * When an owned item (feat, race, armor, weapon, equipment) is updated from this sheet, refresh the actor
     * so the character sheet shows new modifiers and item-derived stats (AC, etc.) immediately.
     */
    async _onOwnedItemDocumentUpdate() {
        const doc = this.document;
        const actorDirect = doc?.actor ?? doc?.parent;
        const actorFromUuid = doc?.uuid && game?.actors ? (() => { const p = String(doc.uuid).split("."); return p[0] === "Actor" && p[1] ? game.actors.get(p[1]) ?? null : null; })() : null;
        const actor = actorDirect ?? actorFromUuid;
        if (actor && typeof actor.prepareData === "function") {
            await actor.prepareData();
            // ApplicationV2: render({ force: true }) schedules maximize().then(bringToFront) without awaiting it,
            // so the actor sheet can end up above an open item sheet (same for all actor re-renders from this module).
            if (actor.sheet?.rendered) await actor.sheet.render();
        }
    }

    /** @override */
    async close(options = {}) {
        if (this._featUpdateListenerBound && this.document?.off && this._featUpdateHandler) {
            this.document.off("update", this._featUpdateHandler);
            this._featUpdateListenerBound = false;
        }
        return super.close(options);
    }

    /** @override */
    async _preRender(context, options) {
        await super._preRender(context, options);
        // Only capture focus if it hasn't been explicitly tracked by _processFormData (e.g. following a row)
        if (!this._focusedInputName) {
            const focused = document.activeElement;
            if (this.element?.contains(focused) && focused.name) {
                this._focusedInputName = focused.name;
            }
        }
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);

        // When this sheet is for an owned item that affects actor stats (feat, armor, weapon, equipment),
        // refresh the actor (and its sheet) when the item is updated so modifiers and derived stats update dynamically.
        const doc = this.document;
        const typesThatAffectActor = ["feat", "armor", "weapon", "equipment"];
        const resolvedOwner = doc && (doc.actor ?? doc.parent);
        const resolvedOwnerFromUuid = doc?.uuid && game?.actors ? (() => { const p = String(doc.uuid).split("."); return p[0] === "Actor" && p[1] ? game.actors.get(p[1]) ?? null : null; })() : null;
        const owner = resolvedOwner ?? resolvedOwnerFromUuid;
        if (doc && typesThatAffectActor.includes(doc.type) && owner && !this._featUpdateListenerBound) {
            this._featUpdateHandler = this._onOwnedItemDocumentUpdate.bind(this);
            doc.on?.("update", this._featUpdateHandler);
            this._featUpdateListenerBound = true;
        }

        // Restore manual scroll position if set (prevents jumping when adding/removing rows)
        if (this._preservedScrollTop !== undefined) {
            const preservedScroll = this._preservedScrollTop;
            // Defer clear so a second render in the same tick (e.g. after feat update) also restores scroll
            const scrollToRestore = preservedScroll;
            setTimeout(() => { this._preservedScrollTop = undefined; }, 100);
            const tab = this.element.querySelector(".sheet-body .tab.active");
            if (tab && scrollToRestore > 0) {
                // Restore immediately
                tab.scrollTop = scrollToRestore;
                // Also restore after frames to ensure it sticks (DOM updates may reset it)
                requestAnimationFrame(() => {
                    const t = this.element?.querySelector?.(".sheet-body .tab.active");
                    if (t && t.scrollTop !== scrollToRestore) t.scrollTop = scrollToRestore;
                });
                setTimeout(() => {
                    const t = this.element?.querySelector?.(".sheet-body .tab.active");
                    if (t && t.scrollTop !== scrollToRestore) t.scrollTop = scrollToRestore;
                }, 10);
                setTimeout(() => {
                    const t = this.element?.querySelector?.(".sheet-body .tab.active");
                    if (t && t.scrollTop !== scrollToRestore) t.scrollTop = scrollToRestore;
                }, 100);
            }
        }

        // Capture scroll position on any form change (before submit) so scrollable tabs (e.g. condition Mechanical effects) don't jump to top
        const form = this.form ?? (this.element?.tagName === "FORM" ? this.element : this.element?.querySelector?.("form"));
        form?.addEventListener("change", () => {
            if (this._preservedScrollTop !== undefined) return;
            const tab = this.element?.querySelector?.(".sheet-body .tab.active");
            if (tab) this._preservedScrollTop = tab.scrollTop;
        }, true);

        // Restore focus after re-render (preserves tab navigation with submitOnChange)
        if (this._focusedInputName) {
            const inputName = this._focusedInputName;
            this._focusedInputName = null;
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
                const input = this.element.querySelector(`[name="${inputName}"]`);
                if (input) {
                    input.focus();
                    input.select();
                }
            });
        }

        // Manual listener for ProseMirror changes
        const editors = this.element.querySelectorAll("prose-mirror");
        editors.forEach(editor => {
            editor.addEventListener("change", (event) => {
                this.submit();
            });
        });

        // Spells per day table input handlers
        const spellsPerDayInputs = this.element.querySelectorAll(".spells-per-day-input");
        spellsPerDayInputs.forEach((input, index) => {
            // Store original value on focus
            let originalValue = input.value || "0";
            
            input.addEventListener("focus", (event) => {
                // Select all text when focused
                event.target.select();
                // Store the current value as the original
                originalValue = event.target.value || "0";
            });

            input.addEventListener("keydown", (event) => {
                if (event.key === "Tab" || event.key === "Enter") {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    // Get all inputs in the table
                    const allInputs = Array.from(this.element.querySelectorAll(".spells-per-day-input"));
                    const currentIndex = allInputs.indexOf(event.target);
                    
                    let nextIndex;
                    if (event.key === "Tab" && event.shiftKey) {
                        // Shift+Tab: move to previous cell (wrap to previous row if at start)
                        nextIndex = currentIndex - 1;
                        if (nextIndex < 0) {
                            // Wrap to the last cell
                            nextIndex = allInputs.length - 1;
                        }
                    } else if (event.key === "Tab") {
                        // Tab: move to next cell (wrap to next row if at end)
                        nextIndex = (currentIndex + 1) % allInputs.length;
                    } else if (event.key === "Enter") {
                        // Enter: move down to next row (same column)
                        // There are 10 columns (spell levels 0-9), so add 10 to go down one row
                        nextIndex = currentIndex + 10;
                        // If we've gone past the end, wrap to the beginning of the same column
                        if (nextIndex >= allInputs.length) {
                            // Find which column we're in (0-9)
                            const column = currentIndex % 10;
                            // Go to the first row of this column
                            nextIndex = column;
                        }
                    }
                    
                    // Validate current value before moving
                    const value = event.target.value;
                    if (value === "" || isNaN(parseInt(value, 10)) || parseInt(value, 10) < 0) {
                        const revertValue = originalValue === "" || isNaN(parseInt(originalValue, 10)) ? "0" : originalValue;
                        event.target.value = revertValue;
                    }
                    
                    // Capture scroll position before triggering change
                    const tab = this.element.querySelector(".sheet-body .tab.active");
                    if (tab) {
                        this._preservedScrollTop = tab.scrollTop;
                    }
                    
                    // Get the next input's name attribute to preserve for focus restoration
                    const nextInput = allInputs[nextIndex];
                    if (nextInput && nextInput.name) {
                        this._focusedInputName = nextInput.name;
                    }
                    
                    // Trigger change event to save the value (will cause re-render)
                    event.target.dispatchEvent(new Event("change", { bubbles: true }));
                }
            });

            input.addEventListener("change", (event) => {
                // Capture scroll position on change event (before form submission)
                const tab = this.element.querySelector(".sheet-body .tab.active");
                if (tab && this._preservedScrollTop === undefined) {
                    this._preservedScrollTop = tab.scrollTop;
                }
            });

            input.addEventListener("blur", (event) => {
                // Only validate on blur if it wasn't triggered by our keyboard navigation
                // (keyboard navigation will have already validated and set _focusedInputName)
                // Check if we're navigating to another spells-per-day input
                const isNavigating = this._focusedInputName && (this._focusedInputName.includes("spellsPerDayTable") || this._focusedInputName.includes("spellsKnownTable"));
                
                if (!isNavigating) {
                    const value = event.target.value;
                    
                    // If empty or not a valid number, revert to original value
                    if (value === "" || isNaN(parseInt(value, 10)) || parseInt(value, 10) < 0) {
                        const revertValue = originalValue === "" || isNaN(parseInt(originalValue, 10)) ? "0" : originalValue;
                        event.target.value = revertValue;
                        // Capture scroll position before triggering change
                        const tab = this.element.querySelector(".sheet-body .tab.active");
                        if (tab) {
                            this._preservedScrollTop = tab.scrollTop;
                        }
                        // Trigger change event to save the reverted value (will cause re-render)
                        event.target.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                    // Clear focused input name if not navigating (will be set by keyboard handler if navigating)
                    this._focusedInputName = null;
                }
            });
        });

        // Manual listeners for string-boolean checkboxes (not form-bound)
        this.element.querySelectorAll("input[data-string-field]").forEach(cb => {
            cb.addEventListener("change", async (event) => {
                const field = event.target.dataset.stringField;
                const value = event.target.checked ? "true" : "false";
                await this.document.update({ [field]: value });
            });
        });

        // Drag-and-drop: class/race/spell/school/domain (existing); feat/feature/armor/weapon/equipment for CGS spell-grant rows.
        const dropSheetTypes =
            this.document.type === "class" ||
            this.document.type === "race" ||
            this.document.type === "spell" ||
            this.document.type === "school" ||
            this.document.type === "domain" ||
            ThirdEraItemSheet.#itemTypesWithCgsSensesUi.has(this.document.type);
        if (dropSheetTypes) {
            const DragDropImpl = foundry.applications?.ux?.DragDrop?.implementation;
            if (DragDropImpl) {
                new DragDropImpl({
                permissions: { drop: () => this.isEditable },
                callbacks: { drop: this._onDrop.bind(this) }
            }).bind(this.element);
            }
        }

        // Spell: applying a selection from the "Add descriptor" dropdown adds the descriptor (no need to click +)
        if (this.document.type === "spell") {
            const descriptorAddSelect = this.element.querySelector(".school-descriptor-add-select");
            if (descriptorAddSelect) {
                descriptorAddSelect.addEventListener("change", async (event) => {
                    event.stopPropagation(); // prevent form change handler from submitting and overwriting descriptors
                    const value = event.target.value?.trim();
                    if (!value) return;
                    const current = [...(this.document.system.schoolDescriptors ?? [])];
                    if (current.includes(value)) {
                        event.target.value = "";
                        return;
                    }
                    current.push(value);
                    current.sort();
                    await this.document.update({ "system.schoolDescriptors": current });
                    event.target.value = "";
                });
            }
        }

        // Toggle container fields visibility for equipment items
        if (this.document.type === "equipment") {
            const containerCheckbox = this.element.querySelector("input[name='system.isContainer']");
            const containerFields = this.element.querySelector(".container-fields");
            
            const toggleContainerFields = () => {
                const isContainer = containerCheckbox?.checked || false;
                if (containerFields) {
                    containerFields.style.display = isContainer ? "" : "none";
                }
            };
            
            // Set initial state
            toggleContainerFields();
            
            // Update on change
            if (containerCheckbox) {
                containerCheckbox.addEventListener("change", toggleContainerFields);
            }
        }
    }

    /**
     * Handle drop events on class/race item sheets.
     * @param {DragEvent} event
     */
    async _onDrop(event) {
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
        let droppedItem = null;
        if (data.type === "Item") {
            droppedItem = await Item.implementation.fromDropData(data);
        } else if (data.uuid) {
            const doc = await foundry.utils.fromUuid(data.uuid);
            if (doc?.documentName === "Item") droppedItem = doc;
        }
        if (!droppedItem) {
            return;
        }

        const spellGrantDropRow = event.target.closest?.("[data-cgs-spell-grant-drop]");
        const spellGrantPanel = event.target.closest?.(".cgs-spell-grants-panel");
        const inCgsItemUi = ThirdEraItemSheet.#itemTypesWithCgsSensesUi.has(this.document.type);
        const spellDropOnGrantUi =
            inCgsItemUi && droppedItem.type === "spell" && (spellGrantDropRow || spellGrantPanel);
        if (spellDropOnGrantUi) {
            if (!this.isEditable) {
                ui.notifications?.warn?.(game.i18n.localize("THIRDERA.ItemSheet.SenseEditNotAllowed"));
                return;
            }
            const doc = this.document;
            const grants = foundry.utils.duplicate(doc.system?.cgsGrants?.grants ?? []);
            const spellUuid = (droppedItem.uuid ?? "").trim();
            if (!spellUuid) {
                return;
            }

            if (spellGrantDropRow) {
                const idx = parseInt(spellGrantDropRow.dataset.cgsSpellGrantIndex, 10);
                if (Number.isNaN(idx)) {
                    return;
                }
                const row = grants[idx];
                if (!row || row.category !== "spellGrant") {
                    ui.notifications?.warn?.(game.i18n.localize("THIRDERA.CGS.SpellGrantDropWrongRow"));
                    return;
                }
                grants[idx] = { ...grants[idx], category: "spellGrant", spellUuid };
            } else {
                grants.push({ category: "spellGrant", spellUuid });
            }

            const tab = this.element?.querySelector?.(".sheet-body .tab.active");
            if (tab) this._preservedScrollTop = tab.scrollTop;
            const senses = foundry.utils.duplicate(doc.system?.cgsGrants?.senses ?? []);
            const cgsPayload = ThirdEraItemSheet.#plainCgsPayload(doc, { grants, senses });
            try {
                await ThirdEraItemSheet.#applyCgsGrantsThroughSheetSubmit(this, cgsPayload);
                await ThirdEraItemSheet.#afterCgsSensesMutation(this);
                await this.render(true);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                ui.notifications?.error?.(msg);
            }
            return;
        }

        const typeOverlayDropRow = event.target.closest?.("[data-cgs-creature-type-overlay-drop]");
        const subtypeOverlayDropRow = event.target.closest?.("[data-cgs-subtype-overlay-drop]");
        const typeOverlayPanel = event.target.closest?.(".cgs-type-overlays-panel");
        const typeDropOnOverlayUi =
            inCgsItemUi &&
            droppedItem.type === "creatureType" &&
            (typeOverlayDropRow || (typeOverlayPanel && !subtypeOverlayDropRow));
        const subtypeDropOnOverlayUi =
            inCgsItemUi && droppedItem.type === "subtype" && (subtypeOverlayDropRow || typeOverlayPanel);
        if (typeDropOnOverlayUi || subtypeDropOnOverlayUi) {
            if (!this.isEditable) {
                ui.notifications?.warn?.(game.i18n.localize("THIRDERA.ItemSheet.SenseEditNotAllowed"));
                return;
            }
            const doc = this.document;
            const grants = foundry.utils.duplicate(doc.system?.cgsGrants?.grants ?? []);
            const itemUuid = (droppedItem.uuid ?? "").trim();
            if (!itemUuid) return;

            if (typeDropOnOverlayUi) {
                if (typeOverlayDropRow) {
                    const idx = parseInt(typeOverlayDropRow.dataset.cgsTypeOverlayIndex, 10);
                    if (Number.isNaN(idx)) return;
                    const row = grants[idx];
                    if (!row || row.category !== "creatureTypeOverlay") {
                        ui.notifications?.warn?.(game.i18n.localize("THIRDERA.CGS.TypeOverlayDropWrongRow"));
                        return;
                    }
                    grants[idx] = { ...grants[idx], category: "creatureTypeOverlay", typeUuid: itemUuid };
                } else {
                    grants.push({ category: "creatureTypeOverlay", typeUuid: itemUuid });
                }
            } else if (subtypeDropOnOverlayUi) {
                if (subtypeOverlayDropRow) {
                    const idx = parseInt(subtypeOverlayDropRow.dataset.cgsSubtypeOverlayIndex, 10);
                    if (Number.isNaN(idx)) return;
                    const row = grants[idx];
                    if (!row || row.category !== "subtypeOverlay") {
                        ui.notifications?.warn?.(game.i18n.localize("THIRDERA.CGS.TypeOverlayDropWrongRow"));
                        return;
                    }
                    grants[idx] = { ...grants[idx], category: "subtypeOverlay", subtypeUuid: itemUuid };
                } else {
                    grants.push({ category: "subtypeOverlay", subtypeUuid: itemUuid });
                }
            }

            const tab = this.element?.querySelector?.(".sheet-body .tab.active");
            if (tab) this._preservedScrollTop = tab.scrollTop;
            const senses = foundry.utils.duplicate(doc.system?.cgsGrants?.senses ?? []);
            const cgsPayload = ThirdEraItemSheet.#plainCgsPayload(doc, { grants, senses });
            try {
                await ThirdEraItemSheet.#applyCgsGrantsThroughSheetSubmit(this, cgsPayload);
                await ThirdEraItemSheet.#afterCgsSensesMutation(this);
                await this.render(true);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                ui.notifications?.error?.(msg);
            }
            return;
        }

        const mechanicalGateDrop = event.target.closest?.("[data-mechanical-gate-drop]");
        const gearTypes = new Set(["armor", "equipment", "weapon"]);
        if (
            mechanicalGateDrop &&
            gearTypes.has(this.document.type) &&
            (droppedItem.type === "creatureType" || droppedItem.type === "subtype")
        ) {
            if (!this.isEditable) {
                ui.notifications?.warn?.(game.i18n.localize("THIRDERA.ItemSheet.SenseEditNotAllowed"));
                return;
            }
            const itemUuid = (droppedItem.uuid ?? "").trim();
            if (!itemUuid) return;
            const uuids = foundry.utils.duplicate(this.document.system?.mechanicalCreatureGateUuids ?? []);
            if (!uuids.includes(itemUuid)) {
                uuids.push(itemUuid);
            }
            const tabEl = this.element?.querySelector?.(".sheet-body .tab.active");
            if (tabEl) this._preservedScrollTop = tabEl.scrollTop;
            await this.document.update({ "system.mechanicalCreatureGateUuids": uuids });
            await this.render(true);
            return;
        }

        const spellTypeTargetingDrop = event.target.closest?.("[data-spell-type-targeting-drop]");
        if (
            spellTypeTargetingDrop &&
            this.document.type === "spell" &&
            (droppedItem.type === "creatureType" || droppedItem.type === "subtype")
        ) {
            if (!this.isEditable) {
                ui.notifications?.warn?.(game.i18n.localize("THIRDERA.ItemSheet.SenseEditNotAllowed"));
                return;
            }
            const itemUuid = (droppedItem.uuid ?? "").trim();
            if (!itemUuid) return;
            const uuids = foundry.utils.duplicate(this.document.system?.targetCreatureTypeUuids ?? []);
            if (!uuids.includes(itemUuid)) {
                uuids.push(itemUuid);
            }
            const tabEl = this.element?.querySelector?.(".sheet-body .tab.active");
            if (tabEl) this._preservedScrollTop = tabEl.scrollTop;
            await this.document.update({ "system.targetCreatureTypeUuids": uuids });
            await this.render(true);
            return;
        }

        // Handle school drops on spell or school sheets
        if (droppedItem.type === "school" && (this.document.type === "spell" || this.document.type === "school")) {
            const tab = this.element.querySelector(".sheet-body .tab.active");
            if (tab) this._preservedScrollTop = tab.scrollTop;

            if (this.document.type === "spell") {
                const schoolKey = droppedItem.system?.key?.trim() || droppedItem.name.toLowerCase().replace(/\s+/g, "");
                const schoolName = droppedItem.name;
                await this.document.update({
                    "system.schoolKey": schoolKey,
                    "system.schoolName": schoolName,
                    "system.schoolSubschool": "",
                    "system.schoolDescriptors": []
                });
                return;
            }
            if (this.document.type === "school") {
                if (droppedItem.id === this.document.id) {
                    ui.notifications.info("A school cannot be its own opposition school.");
                    return;
                }
                const schoolKey = droppedItem.system?.key?.trim() || droppedItem.name.toLowerCase().replace(/\s+/g, "");
                const schoolName = droppedItem.name;
                const current = [...(this.document.system.oppositionSchools || [])];
                if (current.some(e => e.schoolKey === schoolKey)) {
                    ui.notifications.info(`${schoolName} is already in the opposition schools list.`);
                    return;
                }
                current.push({ schoolKey, schoolName });
                current.sort((a, b) => a.schoolName.localeCompare(b.schoolName));
                await this.document.update({ "system.oppositionSchools": current });
                return;
            }
        }

        // Handle class and domain drops on spell sheets (level by class / level by domain)
        if (this.document.type === "spell") {
            const tab = this.element.querySelector(".sheet-body .tab.active");
            if (tab) this._preservedScrollTop = tab.scrollTop;

            if (droppedItem.type === "class") {
                const name = droppedItem.name?.toLowerCase() || "";
                const explicitKey = droppedItem.system?.spellcasting?.spellListKey?.trim();
                const classKey = explicitKey || (name === "wizard" || name === "sorcerer" ? "sorcererWizard" : name);
                const className = droppedItem.name;

                const levelInput = await foundry.applications.api.DialogV2.prompt({
                    window: { title: "Spell Level for Class" },
                    content: `<form><div class="form-group"><label>At what spell level can ${className} cast ${this.document.name}?</label><input type="number" name="level" value="1" min="0" max="9" autofocus /></div></form>`,
                    ok: { callback: (e, btn, dlg) => parseInt(btn.form.elements.level.value) || 0 },
                    rejectClose: false
                });
                if (levelInput == null) return;

                const current = [...(this.document.system.levelsByClass || [])];
                if (current.some(e => e.classKey === classKey)) {
                    ui.notifications.info(`${className} is already in the spell's class list.`);
                    return;
                }
                current.push({ classKey, className, level: levelInput });
                current.sort((a, b) => a.className.localeCompare(b.className) || a.level - b.level);
                await this.document.update({ "system.levelsByClass": current });
                return;
            }

            if (droppedItem.type === "domain") {
                const domainKey = droppedItem.system?.key;
                if (!domainKey) {
                    ui.notifications.warn(`${droppedItem.name} has no domain key — save the domain first to auto-generate one.`);
                    return;
                }
                const domainName = droppedItem.name;

                const levelInput = await foundry.applications.api.DialogV2.prompt({
                    window: { title: "Spell Level for Domain" },
                    content: `<form><div class="form-group"><label>At what spell level does the ${domainName} domain grant ${this.document.name}?</label><input type="number" name="level" value="1" min="1" max="9" autofocus /></div></form>`,
                    ok: { callback: (e, btn, dlg) => parseInt(btn.form.elements.level.value) || 1 },
                    rejectClose: false
                });
                if (levelInput == null) return;

                const current = [...(this.document.system.levelsByDomain || [])];
                if (current.some(e => e.domainKey === domainKey)) {
                    ui.notifications.info(`${domainName} is already in the spell's domain list.`);
                    return;
                }
                current.push({ domainKey, domainName, level: levelInput });
                current.sort((a, b) => a.domainName.localeCompare(b.domainName) || a.level - b.level);
                await this.document.update({ "system.levelsByDomain": current });
                return;
            }
        }

        // Handle domain drops on class sheets (spellcasting domains)
        if (droppedItem.type === "domain" && this.document.type === "class") {
            // Preserve scroll position
            const tab = this.element.querySelector(".sheet-body .tab.active");
            if (tab) this._preservedScrollTop = tab.scrollTop;

            const domainKey = droppedItem.system?.key;
            if (!domainKey) {
                ui.notifications.warn(`${droppedItem.name} has no domain key — save the domain item first to auto-generate one.`);
                return;
            }

            // Check if spellcasting is enabled
            const spellcasting = this.document.system.spellcasting;
            if (!spellcasting || !spellcasting.enabled) {
                ui.notifications.warn(`Spellcasting must be enabled for ${this.document.name} before adding domains.`);
                return;
            }

            const current = [...(spellcasting.domains || [])];
            // Check for duplicate
            if (current.some(e => e.domainKey === domainKey)) {
                ui.notifications.info(`${droppedItem.name} is already assigned to ${this.document.name}.`);
                return;
            }
            current.push({ domainItemId: droppedItem.id, domainName: droppedItem.name, domainKey });
            current.sort((a, b) => a.domainName.localeCompare(b.domainName));
            await this.document.update({ "system.spellcasting.domains": current });

            // If this class is owned by an actor, auto-add domain spells to the character
            const owner = this.document.actor;
            if (owner) {
                const added = await addDomainSpellsToActor(owner, this.document, domainKey);
                if (added > 0) {
                    ui.notifications.info(`${droppedItem.name}: ${added} domain spell(s) added to ${owner.name}.`);
                }
            }

            return;
        }

        // Handle spell drops on domain sheets (inverse of domain-on-spell: add this domain to the spell's levelsByDomain)
        if (this.document.type === "domain" && droppedItem.type === "spell") {
            const tab = this.element.querySelector(".sheet-body .tab.active");
            if (tab) this._preservedScrollTop = tab.scrollTop;

            const domainKey = this.document.system?.key?.trim();
            if (!domainKey) {
                ui.notifications.warn(`${this.document.name} has no domain key — save the domain first.`);
                return;
            }
            const domainName = this.document.name;

            const levelInput = await foundry.applications.api.DialogV2.prompt({
                window: { title: "Spell Level for Domain" },
                content: `<form><div class="form-group"><label>At what spell level does the ${domainName} domain grant ${droppedItem.name}?</label><input type="number" name="level" value="1" min="1" max="9" autofocus /></div></form>`,
                ok: { callback: (e, btn, dlg) => parseInt(btn.form.elements.level.value, 10) || 1 },
                rejectClose: false
            });
            if (levelInput == null) return;

            const current = [...(droppedItem.system.levelsByDomain || [])];
            if (current.some(e => (e.domainKey || "").trim().toLowerCase() === domainKey.toLowerCase())) {
                ui.notifications.info(`${domainName} is already in ${droppedItem.name}'s domain list.`);
                return;
            }
            current.push({ domainKey, domainName, level: Math.max(1, Math.min(9, levelInput)) });
            current.sort((a, b) => (a.domainName || "").localeCompare(b.domainName || "") || a.level - b.level);
            await droppedItem.update({ "system.levelsByDomain": current });
            ui.notifications.info(`${droppedItem.name} added to ${domainName} domain at level ${levelInput}.`);
            return;
        }

        // Handle feat/feature drops on class sheets (class features)
        if ((droppedItem.type === "feat" || droppedItem.type === "feature") && this.document.type === "class") {
            const featKey = droppedItem.system?.key;
            if (!featKey) {
                ui.notifications.warn(`${droppedItem.name} has no feat key set — save the feat first to auto-generate one.`);
                return;
            }

            // Prompt for grant level
            const levelInput = await foundry.applications.api.DialogV2.prompt({
                window: { title: "Assign Class Feature" },
                content: `<form><div class="form-group"><label>At what level does ${this.document.name} gain ${droppedItem.name}?</label><input type="number" name="level" value="1" min="1" autofocus /></div></form>`,
                ok: {
                    callback: (event, button, dialog) => parseInt(button.form.elements.level.value) || 1
                },
                rejectClose: false
            });
            if (!levelInput) return;

            const current = [...(this.document.system.features || [])];
            // Check for duplicate (same feat at same level)
            if (current.some(e => e.featKey === featKey && e.level === levelInput)) {
                ui.notifications.info(`${droppedItem.name} is already granted at level ${levelInput} for ${this.document.name}.`);
                return;
            }
            current.push({ level: levelInput, featItemId: droppedItem.id, featName: droppedItem.name, featKey });
            current.sort((a, b) => a.level - b.level || a.featName.localeCompare(b.featName));
            await this.document.update({ "system.features": current });
            return;
        }

        // Handle skill drops (existing logic)
        if (droppedItem.type !== "skill") return;

        const skillKey = droppedItem.system?.key;
        if (!skillKey) {
            ui.notifications.warn(`${droppedItem.name} has no skill key set — set one on the skill's Details tab first.`);
            return;
        }

        if (this.document.type === "class") {
            const current = [...(this.document.system.classSkills || [])];
            if (current.some(e => e.key === skillKey)) {
                ui.notifications.info(`${droppedItem.name} is already a class skill for ${this.document.name}.`);
                return;
            }
            current.push({ key: skillKey });
            current.sort((a, b) => {
                const na = ThirdEraItemSheet.getSkillDisplayName(a.key) || a.key;
                const nb = ThirdEraItemSheet.getSkillDisplayName(b.key) || b.key;
                return na.localeCompare(nb);
            });
            await this.document.update({ "system.classSkills": current });
        } else if (this.document.type === "race") {
            const current = [...(this.document.system.excludedSkills || [])];
            if (current.some(e => e.key === skillKey)) {
                ui.notifications.info(`${droppedItem.name} is already excluded by ${this.document.name}.`);
                return;
            }
            current.push({ key: skillKey });
            current.sort((a, b) => {
                const na = ThirdEraItemSheet.getSkillDisplayName(a.key) || a.key;
                const nb = ThirdEraItemSheet.getSkillDisplayName(b.key) || b.key;
                return na.localeCompare(nb);
            });
            await this.document.update({ "system.excludedSkills": current });
        }
    }

    constructor(options = {}) {
        super(options);
    }

    /** @override */
    _processFormData(event, form, formData) {
        const data = super._processFormData(event, form, formData);

        // Identify the anchor row and field from the event target (the element that just changed)
        // We use event.target because document.activeElement can be lost during the submit process.
        const anchor = event.target;
        let focusRowIdentity = null;
        let targetField = null;

        if (anchor?.name?.startsWith("system.scalingTable.")) {
            const parts = anchor.name.split(".");
            const oldIndex = parseInt(parts[2]);
            const field = parts[3];

            // Associative focus: if Level changed, we target Value to follow standard Tab-forward flow.
            targetField = (field === "minLevel") ? "value" : field;

            // Get the row object identity from the data (already expanded by super)
            if (data.system?.scalingTable) {
                const table = Array.isArray(data.system.scalingTable) ? data.system.scalingTable : Object.values(data.system.scalingTable);
                focusRowIdentity = table[oldIndex];
            }
        }

        // Sort scaling table by level if present in the data
        if (data.system?.scalingTable) {
            let table = Array.isArray(data.system.scalingTable)
                ? data.system.scalingTable
                : Object.values(data.system.scalingTable);

            table = table.filter(i => i && typeof i === 'object');
            table.sort((a, b) => (Number(a.minLevel) || 0) - (Number(b.minLevel) || 0));

            // If we are tracking a row, find its new index after sorting and update focus goal
            if (focusRowIdentity) {
                const newIndex = table.indexOf(focusRowIdentity);
                if (newIndex !== -1) {
                    this._focusedInputName = `system.scalingTable.${newIndex}.${targetField}`;
                }
            }

            data.system.scalingTable = table;
        }

        // Class: build autoGrantedFeats from the live form so the current select values are never lost.
        // (expandObject would give an object { "0": {...} }; we always want an array built from the form DOM.)
        // If the change came from an auto-granted feat select, the form may have been re-rendered with stale
        // document data before we read it; patch fromForm with event.target.value for that field so we don't lose the selection.
        if (this.document?.type === "class" && form && form.nodeName === "FORM") {
            const fromForm = ThirdEraItemSheet.getAutoGrantedFeatsFromForm(this, form);
            const docList = ThirdEraItemSheet.normalizeAutoGrantedFeatsToArray(this.document?.system?.autoGrantedFeats);
            // Never send fewer conditional slots than the document has: a competing submit (e.g. from Add feat to list click) may have run with a form that had fewer dropdowns and overwritten; padding preserves slots so the next submit doesn't reduce to one.
            for (let i = 0; i < fromForm.length && i < docList.length; i++) {
                const docUuids = docList[i]?.featUuids ?? [];
                const fromUuids = fromForm[i]?.featUuids ?? [];
                if (docUuids.length > fromUuids.length) {
                    const padded = [...fromUuids];
                    for (let k = fromUuids.length; k < docUuids.length; k++) {
                        padded.push(docUuids[k] != null ? String(docUuids[k]).trim() : "");
                    }
                    fromForm[i] = { ...fromForm[i], featUuids: padded };
                }
            }
            const anchor = event?.target;
            const name = anchor?.name ?? "";
            const autoGrantedMatch = name.match(/^system\.autoGrantedFeats\.(\d+)\.(featUuid|featUuids\.(\d+))$/);
            let toSet = fromForm;
            let usedDocumentOnlyBranch = false;
            if (autoGrantedMatch && (anchor?.tagName === "SELECT" || anchor?.nodeName === "SELECT")) {
                const i = parseInt(autoGrantedMatch[1], 10);
                const field = autoGrantedMatch[2];
                const value = (anchor.value != null ? String(anchor.value) : "").trim();
                const conditionalFieldMatch = field === "featUuids." + (autoGrantedMatch[3] ?? "");
                if (conditionalFieldMatch) {
                    const j = parseInt(autoGrantedMatch[3], 10);
                    if (!Number.isNaN(j) && j >= 0 && docList[i]) {
                        const docEntry = docList[i];
                        const docUuids = [...(docEntry?.featUuids ?? [])];
                        while (docUuids.length <= j) docUuids.push("");
                        docUuids[j] = value;
                        toSet = docList.map((e, idx) => ({
                            level: e?.level ?? 1,
                            featUuid: (e?.featUuid ?? "").trim(),
                            featUuids: idx === i ? docUuids : [...(e?.featUuids ?? [])]
                        }));
                        usedDocumentOnlyBranch = true;
                    }
                } else if (i >= 0 && i < fromForm.length) {
                    if (field === "featUuid") {
                        fromForm[i] = { ...fromForm[i], featUuid: value };
                    } else if (field.startsWith("featUuids.")) {
                        const j = parseInt(autoGrantedMatch[3], 10);
                        if (!Number.isNaN(j) && j >= 0) {
                            const docEntry = docList[i];
                            const docUuids = docEntry?.featUuids ?? [];
                            const fromUuids = fromForm[i]?.featUuids ?? [];
                            const base = docUuids.length > fromUuids.length
                                ? docUuids.map((u) => (u != null ? String(u).trim() : ""))
                                : [...(fromUuids ?? [])];
                            while (base.length <= j) base.push("");
                            base[j] = value;
                            fromForm[i] = { ...fromForm[i], featUuids: base };
                        }
                    }
                }
            }
            if (toSet.length > 0) {
                const wouldReduce = docList.some((docEntry, idx) => {
                    const docLen = (docEntry?.featUuids ?? []).length;
                    const fromLen = (toSet[idx]?.featUuids ?? []).length;
                    return docLen > fromLen;
                });
                if (wouldReduce) {
                    toSet = docList.map((e) => ({ level: e?.level ?? 1, featUuid: (e?.featUuid ?? "").trim(), featUuids: [...(e?.featUuids ?? [])] }));
                }
                data.system = data.system || {};
                data.system.autoGrantedFeats = toSet;
            }
        }

        // Mechanical effects: rebuild system.changes from the live form so submitOnChange (e.g. Description / ProseMirror)
        // cannot wipe rows when default expansion omits nested system.changes.* fields (race/feat/condition/item gear).
        const typesWithMechanicalChanges = ["condition", "feat", "race", "armor", "weapon", "equipment"];
        if (typesWithMechanicalChanges.includes(this.document?.type) && form && form.nodeName === "FORM") {
            const fromForm = getSystemChangesFromForm(form);
            if (fromForm !== undefined) {
                data.system = data.system || {};
                data.system.changes = fromForm;
            }
        }

        return data;
    }

    /**
     * When this sheet's document is a world feat (no parent), sync its data to every actor that has this feat and refresh their sheets.
     * Call after the world document is updated (form submit or add/remove mechanical effect row).
     */
    async _syncWorldFeatToActorCopies() {
        if (this.document?.type !== "feat" || !this.document?.uuid) return;
        const actor = this.document?.actor ?? this.document?.parent ?? this.document?.collection?.parent;
        if (actor) return;
        const docUuid = this.document.uuid;
        const docName = (this.document.name ?? "").trim();
        const actorList = game.actors?.contents ?? Array.from(game.actors?.values?.() ?? []);
        const hasFeatNamed = (a, name) => {
            const items = a.items?.contents ?? Array.from(a.items?.values?.() ?? []);
            return items.some((it) => it.type === "feat" && (it.name ?? "").trim() === name);
        };
        const getMatchingFeatItems = (a) => {
            const items = a.items?.contents ?? Array.from(a.items?.values?.() ?? []);
            return items.filter((it) => it.sourceId === docUuid || (docName && it.type === "feat" && (it.name ?? "").trim() === docName));
        };
        let actorsToRefresh = actorList.filter((a) => a.items?.some?.((it) => it.sourceId === docUuid));
        if (actorsToRefresh.length === 0 && docName) {
            actorsToRefresh = actorList.filter((a) => hasFeatNamed(a, docName));
        }
        if (actorsToRefresh.length === 0 && docName) {
            const instances = foundry.applications?.instances;
            if (instances) {
                for (const app of instances.values()) {
                    const doc = app.document;
                    if (doc?.documentName === "Actor" && hasFeatNamed(doc, docName)) {
                        actorsToRefresh.push(doc);
                    }
                }
            }
        }
        const fullDoc = this.document.toObject();
        delete fullDoc._id;
        const changes = this.document.system.changes ?? [];
        for (const a of actorsToRefresh) {
            const itemsToUpdate = getMatchingFeatItems(a);
            for (const item of itemsToUpdate) {
                const payload = { ...fullDoc };
                payload["==system"] = this.document.system.toObject();
                delete payload.system;
                await item.update(payload);
                await item.update({ "system.changes": changes });
            }
            if (typeof a.prepareData === "function") await a.prepareData();
            if (a.sheet?.rendered) await a.sheet.render();
        }
    }

    /**
     * When this sheet's document is a world race (no parent), sync to actors that have this race embedded.
     */
    async _syncWorldRaceToActorCopies() {
        if (this.document?.type !== "race" || !this.document?.uuid) return;
        const actor = this.document?.actor ?? this.document?.parent ?? this.document?.collection?.parent;
        if (actor) return;
        const docUuid = this.document.uuid;
        const docName = (this.document.name ?? "").trim();
        const actorList = game.actors?.contents ?? Array.from(game.actors?.values?.() ?? []);
        const hasRaceNamed = (a, name) => {
            const items = a.items?.contents ?? Array.from(a.items?.values?.() ?? []);
            return items.some((it) => it.type === "race" && (it.name ?? "").trim() === name);
        };
        const getMatchingRaceItems = (a) => {
            const items = a.items?.contents ?? Array.from(a.items?.values?.() ?? []);
            return items.filter((it) => it.type === "race" && (it.sourceId === docUuid || (docName && (it.name ?? "").trim() === docName)));
        };
        let actorsToRefresh = actorList.filter((a) => a.items?.some?.((it) => it.type === "race" && it.sourceId === docUuid));
        if (actorsToRefresh.length === 0 && docName) {
            actorsToRefresh = actorList.filter((a) => hasRaceNamed(a, docName));
        }
        if (actorsToRefresh.length === 0 && docName) {
            const instances = foundry.applications?.instances;
            if (instances) {
                for (const app of instances.values()) {
                    const doc = app.document;
                    if (doc?.documentName === "Actor" && hasRaceNamed(doc, docName)) {
                        actorsToRefresh.push(doc);
                    }
                }
            }
        }
        const fullDoc = this.document.toObject();
        delete fullDoc._id;
        const changes = this.document.system.changes ?? [];
        for (const a of actorsToRefresh) {
            const itemsToUpdate = getMatchingRaceItems(a);
            for (const item of itemsToUpdate) {
                const payload = { ...fullDoc };
                payload["==system"] = this.document.system.toObject();
                delete payload.system;
                await item.update(payload);
                await item.update({ "system.changes": changes });
            }
            if (typeof a.prepareData === "function") await a.prepareData();
            if (a.sheet?.rendered) await a.sheet.render();
        }
    }

    /**
     * When this sheet's document is a world armor/weapon/equipment (no parent), sync its system data
     * to every actor that has this item (by sourceId or name+type) and refresh their sheets.
     */
    async _syncWorldItemToActorCopies() {
        const doc = this.document;
        const types = ["armor", "weapon", "equipment"];
        if (!doc || !types.includes(doc.type) || !doc.uuid) return;
        const owner = doc.actor ?? doc.parent ?? doc.collection?.parent;
        if (owner) return;
        const docUuid = doc.uuid;
        const docName = (doc.name ?? "").trim();
        const seenIds = new Set();
        const actorList = [];
        const add = (a) => { if (a?.id && !seenIds.has(a.id)) { seenIds.add(a.id); actorList.push(a); } };
        const rawList = game.actors?.contents ?? Array.from(game.actors?.values?.() ?? []);
        for (const a of rawList) {
            const resolved = game.actors?.get?.(a?.id ?? a) ?? a;
            if (resolved) add(resolved);
        }
        if (typeof game.scenes !== "undefined") {
            for (const scene of game.scenes) {
                const tokens = scene.tokens ?? scene.getEmbeddedCollection?.("tokens") ?? [];
                const tokenList = Array.isArray(tokens) ? tokens : (typeof tokens.contents !== "undefined" ? tokens.contents : Array.from(tokens));
                for (const t of tokenList) {
                    const act = t.actor ?? (t.actorId && game.actors && game.actors.get(t.actorId));
                    if (act) add(act);
                }
            }
        }
        // Prefer actor document from an open Actor sheet (items populated); game.actors reference can have empty items in this context.
        const instances = foundry.applications?.instances;
        const actorListToUse = !instances ? actorList : actorList.map((a) => {
            for (const app of instances.values()) {
                const d = app.document;
                if (d?.documentName === "Actor" && d.id === a.id) return d;
            }
            return a;
        });
        const getItemsArray = (a) => {
            if (!a?.items) return [];
            const c = a.items;
            if (Array.isArray(c)) return c;
            try {
                if (typeof c.contents !== "undefined" && Array.isArray(c.contents)) return c.contents;
                if (typeof c.values === "function") return Array.from(c.values());
                if (typeof c[Symbol.iterator] === "function") {
                    const arr = Array.from(c);
                    if (arr.length > 0 && Array.isArray(arr[0]) && arr[0].length === 2) return arr.map((pair) => pair[1]);
                    return arr;
                }
                if (typeof c.filter === "function") return c.filter(() => true);
                if (typeof c.get === "function" && typeof c.keys === "function") {
                    const out = [];
                    for (const id of c.keys()) out.push(c.get(id));
                    return out.filter(Boolean);
                }
                const out = [];
                for (const x of c) out.push(x);
                return out;
            } catch (e) {
                return [];
            }
        };
        const itemType = doc.type;
        const docNameNorm = (str) => (str ?? "").trim().toLowerCase().replace(/\s+/g, " ");
        const docNameNormed = docNameNorm(docName);
        const isArmorLike = (it) => it.type === "armor" || it._source?.type === "armor" || (it.system && "armor" in it.system);
        const isEquipmentLike = (it) => it.type === "equipment" || it._source?.type === "equipment";
        const isWeaponLike = (it) => it.type === "weapon" || it._source?.type === "weapon";
        const sameType = (it) => {
            if (itemType === "armor") return isArmorLike(it);
            if (itemType === "equipment") return isEquipmentLike(it);
            if (itemType === "weapon") return isWeaponLike(it);
            return it.type === itemType || it._source?.type === itemType;
        };
        const getMatchingItems = (a) => {
            const items = getItemsArray(a);
            const byId = items.filter((it) => sameType(it) && (it.id === doc.id || it._id === doc.id));
            if (byId.length > 0) return byId;
            const nameMatches = (it) => docNameNorm(it.name ?? it._source?.name) === docNameNormed;
            const bySourceOrName = items.filter((it) => sameType(it) && (it.sourceId === docUuid || nameMatches(it)));
            if (bySourceOrName.length > 0) return bySourceOrName;
            const isEquipped = (it) => (isArmorLike(it) || isEquipmentLike(it)) ? (it.system?.equipped === "true") : (it.system?.equipped === "primary" || it.system?.equipped === "offhand");
            const equippedOfType = items.filter((it) => sameType(it) && isEquipped(it));
            if (equippedOfType.length === 1) return equippedOfType;
            if (doc.type === "armor" && equippedOfType.length > 0) {
                const byName = equippedOfType.filter((it) => nameMatches(it));
                if (byName.length > 0) return byName;
                return equippedOfType.slice(0, 1);
            }
            return [];
        };
        let actorsToRefresh = actorListToUse.filter((a) => getMatchingItems(a).length > 0);
        if (actorsToRefresh.length === 0 && typeof foundry?.utils?.fromUuid === "function") {
            for (const a of actorListToUse) {
                if (!a?.uuid) continue;
                try {
                    const ref = await foundry.utils.fromUuid(a.uuid);
                    if (ref?.documentName === "Actor" && getMatchingItems(ref).length > 0) actorsToRefresh.push(ref);
                } catch (_) {}
            }
        }
        const systemData = doc.system?.toObject?.() ?? doc.system ?? {};
        for (const a of actorsToRefresh) {
            const itemsToUpdate = getMatchingItems(a);
            for (const item of itemsToUpdate) {
                const payload = { ...systemData };
                if (item.system?.equipped !== undefined && item.system?.equipped !== null) payload.equipped = item.system.equipped;
                if (item.system?.containerId !== undefined && item.system?.containerId !== null) payload.containerId = item.system.containerId;
                await item.update({ system: payload });
            }
            if (typeof a.prepareData === "function") await a.prepareData();
            if (a.sheet?.rendered) await a.sheet.render();
        }
    }

    /** @override */
    async _processSubmitData(event, form, submitData, options = {}) {
        await super._processSubmitData(event, form, submitData, options);
        const doc = this.document;
        let actor = doc?.actor ?? doc?.parent ?? doc?.collection?.parent;
        // Feat: sync world feat to actor copies or refresh owning actor
        if (doc?.type === "feat") {
            if (!actor && doc.uuid) {
                await this._syncWorldFeatToActorCopies();
                return;
            }
            if (actor && typeof actor.prepareData === "function") {
                await actor.prepareData();
                if (actor.sheet?.rendered) await actor.sheet.render();
            }
            return;
        }
        if (doc?.type === "race") {
            if (!actor && doc.uuid) {
                await this._syncWorldRaceToActorCopies();
                return;
            }
            if (actor && typeof actor.prepareData === "function") {
                await actor.prepareData();
                if (actor.sheet?.rendered) await actor.sheet.render();
            }
            return;
        }
        // Armor/weapon/equipment: sync world item to actor copies or refresh owning actor
        if (doc && ["armor", "weapon", "equipment"].includes(doc.type)) {
            if (!actor && doc.uuid) {
                await this._syncWorldItemToActorCopies();
                return;
            }
            if (actor && typeof actor.prepareData === "function") {
                await actor.prepareData();
                if (actor.sheet?.rendered) await actor.sheet.render();
            }
        }
        // After a macrotask, force the subschool select to show the document value (wins over any stale re-render)
        if (this.rendered && this.document?.type === "spell") {
            const doc = this.document;
            const value = doc.system?.schoolSubschool ?? "";
            setTimeout(() => {
                if (!this.rendered || this.document !== doc) return;
                const sel = this.element?.querySelector('select[name="system.schoolSubschool"]');
                if (sel) sel.value = value;
            }, 0);
        }
    }

    /* -------------------------------------------- */
    /*  Event Handlers                              */
    /* -------------------------------------------- */

    /**
     * Handle rolling an attack for a weapon
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static onRollAttack(event, target) {
        if (this.item.type === 'weapon') {
            this.item.rollAttack();
        }
    }

    /**
     * Handle rolling damage for a weapon
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static onRollDamage(event, target) {
        if (this.item.type === 'weapon') {
            this.item.rollDamage();
        }
    }

    /**
     * Handle tab changes
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static onChangeTab(event, target) {
        const tab = target.dataset.tab;
        const group = target.dataset.group;

        // Update the tab state
        this.tabGroups[group] = tab;

        // Activate the clicked tab
        const nav = target.closest('.tabs');
        nav.querySelectorAll('.item').forEach(t => t.classList.remove('active'));
        target.classList.add('active');

        // Show the corresponding tab content
        const body = this.element.querySelector('.sheet-body');
        body.querySelectorAll(`.tab[data-group="${group}"]`).forEach(t => t.classList.remove('active'));
        body.querySelector(`.tab[data-group="${group}"][data-tab="${tab}"]`)?.classList.add('active');
    }

    /**
     * Handle deleting the item from the header
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static async onItemDeleteHeader(event, target) {
        const confirm = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Delete Item" },
            content: `<h4>Are you sure you want to delete ${this.item.name}?</h4>`,
            rejectClose: false,
            modal: true
        });
        if (confirm) {
            await this.item.delete();
            this.close();
        }
    }

    /**
     * Handle removing a class skill entry
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static async onRemoveClassSkill(event, target) {
        const skillKey = target.dataset.skillKey;
        if (!skillKey) return;
        const current = (this.item.system.classSkills || []).filter(e => e.key !== skillKey);
        await this.item.update({ "system.classSkills": current });
    }

    /**
     * Handle removing an excluded skill entry
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static async onRemoveExcludedSkill(event, target) {
        const skillKey = target.dataset.skillKey;
        if (!skillKey) return;
        const current = (this.item.system.excludedSkills || []).filter(e => e.key !== skillKey);
        await this.item.update({ "system.excludedSkills": current });
    }

    /**
     * Handle removing a class feature entry
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static async onRemoveFeature(event, target) {
        const index = parseInt(target.dataset.featureIndex);
        if (isNaN(index)) return;
        const current = [...(this.item.system.features || [])];
        current.splice(index, 1);
        await this.item.update({ "system.features": current });
    }

    /**
     * Ensure autoGrantedFeats is an array (convert object with numeric keys from expandObject).
     * @param {unknown} value
     * @returns {Array<{level?: number, featUuid?: string, featUuids?: string[]}>}
     */
    static normalizeAutoGrantedFeatsToArray(value) {
        if (Array.isArray(value)) return value;
        if (value && typeof value === "object" && !Array.isArray(value)) {
            const keys = Object.keys(value).filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
            return keys.map((k) => value[k]);
        }
        return [];
    }

    /**
     * Build autoGrantedFeats array from the form so in-flight selections are preserved (e.g. before submit has updated the document).
     * @param {ThirdEraItemSheet} sheet
     * @param {HTMLFormElement|null} [formFromEvent] If provided (e.g. event.target.closest("form") from the button click), use this form so we read from the correct DOM.
     * @returns {Array<{level: number, featUuid: string, featUuids: string[]}>}
     */
    static getAutoGrantedFeatsFromForm(sheet, formFromEvent) {
        const docList = ThirdEraItemSheet.normalizeAutoGrantedFeatsToArray(sheet.document?.system?.autoGrantedFeats);
        const form = formFromEvent && formFromEvent.nodeName === "FORM"
            ? formFromEvent
            : (sheet.form != null ? sheet.form : (sheet.element && (sheet.element.tagName === "FORM" ? sheet.element : sheet.element.querySelector && sheet.element.querySelector("form"))));
        if (!form || !docList.length) return [...docList];
        const current = [];
        for (let i = 0; i < docList.length; i++) {
            const docEntry = docList[i];
            const levelInput = form.querySelector(`input[name="system.autoGrantedFeats.${i}.level"]`);
            const featUuidSelect = form.querySelector(`select[name="system.autoGrantedFeats.${i}.featUuid"]`);
            const level = levelInput ? (Number(levelInput.value) || (docEntry.level != null ? docEntry.level : 1)) : (docEntry.level != null ? docEntry.level : 1);
            if (featUuidSelect) {
                const featUuid = (featUuidSelect.value != null ? featUuidSelect.value : (docEntry.featUuid != null ? docEntry.featUuid : "")).trim();
                current.push({ level, featUuid, featUuids: [] });
            } else {
                const docUuids = docEntry.featUuids ?? [];
                // Build featUuids from form; for any index the form doesn't have a select for, use document so we never drop a slot when form was re-rendered with fewer selects.
                const featUuids = [];
                const maxJ = Math.max(docUuids.length, 16);
                for (let j = 0; j < maxJ; j++) {
                    const sel = form.querySelector(`select[name="system.autoGrantedFeats.${i}.featUuids.${j}"]`);
                    if (sel) {
                        let v = (sel.value != null ? sel.value : "").trim();
                        if (!v && docUuids[j] != null && String(docUuids[j]).trim()) v = String(docUuids[j]).trim();
                        featUuids.push(v);
                    } else if (j < docUuids.length) {
                        featUuids.push(docUuids[j] != null ? String(docUuids[j]).trim() : "");
                    } else {
                        break;
                    }
                }
                current.push({ level, featUuid: "", featUuids: featUuids.length ? featUuids : (docEntry.featUuids != null ? docEntry.featUuids : []) });
            }
        }
        return current;
    }

    /**
     * Add an empty auto-granted feat row (level 1, no feat). Used on class sheet.
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     * @this {ThirdEraItemSheet}
     */
    static async onAddAutoGrantedFeat(event, target) {
        if (this.document.type !== "class") return;
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const form = this.form ?? (this.element?.tagName === "FORM" ? this.element : this.element?.querySelector?.("form"));
        const current = ThirdEraItemSheet.getAutoGrantedFeatsFromForm(this, form);
        current.push({ level: 1, featUuid: "", featUuids: [] });
        await this.document.update({ "system.autoGrantedFeats": current });
    }

    /**
     * Remove an auto-granted feat row by index. Used on class sheet.
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     * @this {ThirdEraItemSheet}
     */
    static async onRemoveAutoGrantedFeat(event, target) {
        const index = parseInt(target.dataset.autoGrantedIndex, 10);
        if (isNaN(index) || index < 0) return;
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const form = this.form ?? (this.element?.tagName === "FORM" ? this.element : this.element?.querySelector?.("form"));
        const current = ThirdEraItemSheet.getAutoGrantedFeatsFromForm(this, form);
        current.splice(index, 1);
        await this.document.update({ "system.autoGrantedFeats": current });
    }

    /**
     * Switch an auto-granted feat row from unconditional (empty) to conditional: set featUuid to "", add one empty slot to featUuids.
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     * @this {ThirdEraItemSheet}
     */
    static async onSetAutoGrantedToConditional(event, target) {
        if (this.document.type !== "class") return;
        const entryIndex = parseInt(target.dataset.entryIndex, 10);
        if (isNaN(entryIndex) || entryIndex < 0) return;
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const form = this.form ?? (this.element?.tagName === "FORM" ? this.element : this.element?.querySelector?.("form"));
        const current = ThirdEraItemSheet.getAutoGrantedFeatsFromForm(this, form);
        const entry = current[entryIndex];
        if (!entry) return;
        const updated = current.map((e, i) =>
            i === entryIndex
                ? { ...e, featUuid: "", featUuids: [...(e.featUuids || []), ""] }
                : e
        );
        await this.document.update({ "system.autoGrantedFeats": updated });
    }

    /**
     * Switch an auto-granted feat entry from conditional back to unconditional (only when fewer than 2 rows). Uses first slot value as the single feat, or empty.
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     * @this {ThirdEraItemSheet}
     */
    static async onSetAutoGrantedToUnconditional(event, target) {
        if (this.document.type !== "class") return;
        const entryIndex = parseInt(target.dataset.entryIndex, 10);
        if (isNaN(entryIndex) || entryIndex < 0) return;
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const form = this.form ?? (this.element?.tagName === "FORM" ? this.element : this.element?.querySelector?.("form"));
        const current = ThirdEraItemSheet.getAutoGrantedFeatsFromForm(this, form);
        const entry = current[entryIndex];
        if (!entry || !Array.isArray(entry.featUuids) || entry.featUuids.length >= 2) return;
        const featUuid = (entry.featUuids[0] != null ? String(entry.featUuids[0]).trim() : "");
        const updated = current.map((e, i) =>
            i === entryIndex ? { ...e, featUuid, featUuids: [] } : e
        );
        await this.document.update({ "system.autoGrantedFeats": updated });
    }

    /**
     * Add an empty UUID slot to a conditional auto-granted feat entry.
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     * @this {ThirdEraItemSheet}
     */
    static async onAddConditionalFeatUuid(event, target) {
        if (this.document.type !== "class") return;
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const entryIndex = parseInt(target.dataset.entryIndex, 10);
        if (isNaN(entryIndex) || entryIndex < 0) return;
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const form = this.form ?? (this.element?.tagName === "FORM" ? this.element : this.element?.querySelector?.("form"));
        const current = ThirdEraItemSheet.getAutoGrantedFeatsFromForm(this, form);
        const entry = current[entryIndex];
        if (!entry) return;
        const featUuids = [...(entry.featUuids || []), ""];
        const updated = current.map((e, i) =>
            i === entryIndex ? { ...e, featUuid: "", featUuids } : e
        );
        await this.document.update({ "system.autoGrantedFeats": updated });
    }

    /**
     * Remove one UUID from a conditional auto-granted feat entry by index.
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     * @this {ThirdEraItemSheet}
     */
    static async onRemoveConditionalFeatUuid(event, target) {
        if (this.document.type !== "class") return;
        const entryIndex = parseInt(target.dataset.entryIndex, 10);
        const uuidIndex = parseInt(target.dataset.uuidIndex, 10);
        if (isNaN(entryIndex) || entryIndex < 0 || isNaN(uuidIndex) || uuidIndex < 0) return;
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const form = this.form ?? (this.element?.tagName === "FORM" ? this.element : this.element?.querySelector?.("form"));
        const current = ThirdEraItemSheet.getAutoGrantedFeatsFromForm(this, form);
        const entry = current[entryIndex];
        if (!entry || !Array.isArray(entry.featUuids)) return;
        const featUuids = entry.featUuids.filter((_, i) => i !== uuidIndex);
        const updated = current.map((e, i) =>
            i === entryIndex ? { ...e, featUuids } : e
        );
        await this.document.update({ "system.autoGrantedFeats": updated });
    }

    /**
     * Handle removing a domain from a class
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static async onRemoveDomain(event, target) {
        // Preserve scroll position
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const domainKey = target.dataset.domainKey;
        if (!domainKey) return;
        const spellcasting = this.item.system.spellcasting;
        if (!spellcasting || !spellcasting.domains) return;
        const current = spellcasting.domains.filter(e => e.domainKey !== domainKey);
        await this.item.update({ "system.spellcasting.domains": current });
    }

    /**
     * Open the condition description prose-mirror in edit mode (external Edit button; built-in toggle is hidden).
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static onOpenConditionDescription(event, target) {
        const pm = this.element?.querySelector?.(".condition-editor-box prose-mirror[name='system.description']");
        if (pm && typeof pm.open !== "undefined") pm.open = true;
    }

    /**
     * Add a blank mechanical effect row. Unified handler for condition, feat, race, armor, weapon, equipment.
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static async onAddMechanicalEffectRow(event, target) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const doc = this.document;
        const typesWithChanges = ["condition", "feat", "race", "armor", "weapon", "equipment"];
        if (!doc || !typesWithChanges.includes(doc.type)) return;
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const current = [...(doc.system.changes || [])];
        current.push({ key: "", value: 0, label: "" });
        await doc.update({ "system.changes": current }, { render: false });
        if (doc.type === "feat") await this._syncWorldFeatToActorCopies();
        else if (doc.type === "race" && !doc.actor && doc.uuid) await this._syncWorldRaceToActorCopies();
        else if (doc.type !== "condition") {
            if (doc.actor) {
                const actor = doc.actor;
                if (typeof actor.prepareData === "function") await actor.prepareData();
                if (actor.sheet?.rendered) await actor.sheet.render();
            } else if (["armor", "weapon", "equipment"].includes(doc.type) && doc.uuid) {
                await this._syncWorldItemToActorCopies();
            }
        }
        await this.render(true);
    }

    /**
     * Remove a mechanical effect row. Unified handler for condition, feat, race, armor, weapon, equipment.
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element (must have data-index)
     * @this {ThirdEraItemSheet}
     */
    static async onRemoveMechanicalEffectRow(event, target) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const doc = this.document;
        const typesWithChanges = ["condition", "feat", "race", "armor", "weapon", "equipment"];
        if (!doc || !typesWithChanges.includes(doc.type)) return;
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const index = parseInt(target.dataset.index, 10);
        if (Number.isNaN(index)) return;
        const current = [...(doc.system.changes || [])];
        current.splice(index, 1);
        await doc.update({ "system.changes": current }, { render: false });
        if (doc.type === "feat") await this._syncWorldFeatToActorCopies();
        else if (doc.type === "race" && !doc.actor && doc.uuid) await this._syncWorldRaceToActorCopies();
        else if (doc.type !== "condition") {
            if (doc.actor) {
                // Use the actor that owns this item so prepareData sees the updated doc in its items
                const actor = doc.actor;
                if (typeof actor.prepareData === "function") await actor.prepareData();
                if (actor.sheet?.rendered) await actor.sheet.render();
            } else if (["armor", "weapon", "equipment"].includes(doc.type) && doc.uuid) {
                await this._syncWorldItemToActorCopies();
            }
        }
        await this.render(true);
    }

    /**
     * Open skill picker for mechanical effect row; on select, set key to skill.<key> and re-render (Phase 6).
     * @param {PointerEvent} event
     * @param {HTMLElement} target   Button with data-change-index
     * @this {ThirdEraItemSheet}
     */
    static async onChooseSkillForModifier(event, target) {
        event?.preventDefault?.();
        const idx = parseInt(target?.dataset?.changeIndex ?? target?.closest?.("[data-change-index]")?.dataset?.changeIndex, 10);
        if (Number.isNaN(idx)) return;
        const doc = this.document;
        const changes = [...(doc.system.changes || [])];
        if (idx < 0 || idx >= changes.length) return;
        const dialog = new SkillPickerDialog({
            id: "thirdera-skill-picker",
            resolve: async (skillKey) => {
                if (!skillKey) return;
                const tab = this.element?.querySelector?.(".sheet-body .tab.active");
                if (tab) this._preservedScrollTop = tab.scrollTop;
                const updates = [...(doc.system.changes || [])];
                if (updates[idx]) {
                    updates[idx] = { ...updates[idx], key: `skill.${skillKey}` };
                    await doc.update({ "system.changes": updates }, { render: false });
                    if (doc.type === "feat") await this._syncWorldFeatToActorCopies();
                    else if (doc.type === "race" && !doc.actor && doc.uuid) await this._syncWorldRaceToActorCopies();
                    else if (doc.type !== "condition") {
                        if (doc.actor) {
                            const actor = doc.actor;
                            if (typeof actor.prepareData === "function") await actor.prepareData();
                            if (actor.sheet?.rendered) await actor.sheet.render();
                        } else if (["armor", "weapon", "equipment"].includes(doc.type) && doc.uuid) {
                            await this._syncWorldItemToActorCopies();
                        }
                    }
                    await this.render(true);
                }
            }
        });
        dialog.render(true);
    }

    /**
     * Open a prose-mirror in this sheet by field name (used by editor-box partial and any header Edit button).
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element (must have data-field="system.description" etc.)
     * @this {ThirdEraItemSheet}
     */
    static onOpenEditorBox(event, target) {
        const field = target.dataset?.field;
        if (!field) return;
        const pm = this.element?.querySelector?.(`prose-mirror[name="${field}"]`);
        if (pm && typeof pm.open !== "undefined") pm.open = true;
    }

    /**
     * Handle adding a scaling table row to a feat
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static async onAddScalingRow(event, target) {
        // Manual scroll preservation
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const current = [...(this.item.system.scalingTable || [])];
        // Default next level: one higher than the last entry, or 1 if empty
        const nextLevel = current.length > 0 ? current[current.length - 1].minLevel + 1 : 1;
        current.push({ minLevel: nextLevel, value: "" });
        await this.item.update({ "system.scalingTable": current });
    }

    /**
     * Handle removing a scaling table row from a feat
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static async onRemoveScalingRow(event, target) {
        // Manual scroll preservation
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const index = parseInt(target.dataset.scalingIndex);
        if (isNaN(index)) return;
        const current = [...(this.item.system.scalingTable || [])];
        current.splice(index, 1);
        await this.item.update({ "system.scalingTable": current });
    }

    /**
     * Handle removing a level-by-class entry from a spell
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static async onRemoveLevelByClass(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const index = parseInt(target.dataset.levelByClassIndex);
        if (isNaN(index)) return;
        const current = [...(this.item.system.levelsByClass || [])];
        current.splice(index, 1);
        await this.item.update({ "system.levelsByClass": current });
    }

    /**
     * Handle removing a level-by-domain entry from a spell
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static async onRemoveLevelByDomain(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const index = parseInt(target.dataset.levelByDomainIndex);
        if (isNaN(index)) return;
        const current = [...(this.item.system.levelsByDomain || [])];
        current.splice(index, 1);
        await this.item.update({ "system.levelsByDomain": current });
    }

    /**
     * Find a school item by its system key. Searches world items first, then thirdera_schools compendium.
     * @param {string} schoolKey   The school's system key (e.g. "evocation", "conjuration")
     * @returns {Promise<Item|null>} The school Item document, or null if not found
     */
    static async findSchoolByKey(schoolKey) {
        if (!schoolKey || typeof schoolKey !== "string") return null;
        const key = schoolKey.trim().toLowerCase();
        if (!key) return null;

        // Search world items first
        const worldSchool = game.items?.find(
            (i) => i.type === "school" && (i.system?.key?.trim().toLowerCase() === key || i.name?.toLowerCase().replace(/\s+/g, "") === key)
        );
        if (worldSchool) return worldSchool;

        // Search thirdera_schools compendium
        const pack = game.packs?.get("thirdera.thirdera_schools");
        if (!pack) return null;
        const docs = await pack.getDocuments();
        return docs.find(
            (d) => d.type === "school" && (d.system?.key?.trim().toLowerCase() === key || d.name?.toLowerCase().replace(/\s+/g, "") === key)
        ) ?? null;
    }

    /**
     * Clear the spell's school assignment
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static async onClearSchool(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        await this.item.update({
            "system.schoolKey": "",
            "system.schoolName": "",
            "system.schoolSubschool": "",
            "system.schoolDescriptors": []
        });
    }

    /**
     * Add a descriptor to the spell's schoolDescriptors.
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static async onAddSchoolDescriptor(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const select = this.element.querySelector(".school-descriptor-add-select");
        const value = select?.value?.trim();
        if (!value) return;
        const current = [...(this.item.system.schoolDescriptors ?? [])];
        if (current.includes(value)) return;
        current.push(value);
        current.sort();
        await this.item.update({ "system.schoolDescriptors": current });
        if (select) select.value = "";
    }

    /**
     * Remove a descriptor from the spell's schoolDescriptors.
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static async onRemoveSchoolDescriptor(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const index = parseInt(target.dataset.descriptorIndex);
        if (isNaN(index)) return;
        const current = [...(this.item.system.schoolDescriptors ?? [])];
        current.splice(index, 1);
        await this.item.update({ "system.schoolDescriptors": current });
    }

    static async onRemoveOppositionSchool(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const index = parseInt(target.dataset.oppositionIndex);
        if (isNaN(index)) return;
        const current = [...(this.item.system.oppositionSchools || [])];
        current.splice(index, 1);
        await this.item.update({ "system.oppositionSchools": current });
    }

    static async onAddSubschool(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const current = [...(this.item.system.subschools || [])];
        current.push("");
        await this.item.update({ "system.subschools": current });
    }

    static async onRemoveSubschool(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const index = parseInt(target.dataset.subschoolIndex);
        if (isNaN(index)) return;
        const current = [...(this.item.system.subschools || [])];
        current.splice(index, 1);
        await this.item.update({ "system.subschools": current });
    }

    static async onAddDescriptorTag(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const current = [...(this.item.system.descriptorTags || [])];
        current.push("");
        await this.item.update({ "system.descriptorTags": current });
    }

    static async onRemoveDescriptorTag(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const index = parseInt(target.dataset.descriptorIndex);
        if (isNaN(index)) return;
        const current = [...(this.item.system.descriptorTags || [])];
        current.splice(index, 1);
        await this.item.update({ "system.descriptorTags": current });
    }

    /**
     * Open file picker to change item image. Requires target to be an IMG with data-edit.
     * @param {PointerEvent} _event
     * @param {HTMLImageElement} target
     */
    static async onEditImage(_event, target) {
        if (target.nodeName !== "IMG") return;
        const attr = target.dataset.edit;
        if (!attr) return;
        const current = foundry.utils.getProperty(this.document._source, attr);
        const defaultArtwork = this.document.constructor.getDefaultArtwork?.(this.document._source) ?? {};
        const defaultImage = foundry.utils.getProperty(defaultArtwork, attr);
        const FilePicker = foundry.applications?.apps?.FilePicker ?? globalThis.FilePicker;
        if (!FilePicker?.implementation) return;
        const fp = new FilePicker.implementation({
            current,
            type: "image",
            redirectToRoot: defaultImage ? [defaultImage] : [],
            callback: path => {
                target.src = path;
                if (this.options.form?.submitOnChange) {
                    this.form?.dispatchEvent(new Event("submit", { cancelable: true }));
                }
            },
            position: {
                top: this.position.top + 40,
                left: this.position.left + 10
            }
        });
        await fp.browse();
    }

    /** Add a prerequisite feat from dropdown selection (feat sheet). */
    static async onAddPrerequisiteFeat(_event, target) {
        if (this.document?.type !== "feat") return;
        const form = target.closest("form");
        const select = form?.querySelector(".prerequisite-feat-select");
        const uuid = select?.value?.trim();
        if (!uuid) return;
        const uuids = [...(this.document.system.prerequisiteFeatUuids ?? [])];
        if (uuids.includes(uuid)) return;
        uuids.push(uuid);
        await this.document.update({ "system.prerequisiteFeatUuids": uuids });
        if (select) select.value = "";
    }

    /** Remove a prerequisite feat by UUID (feat sheet). */
    static async onRemovePrerequisiteFeat(_event, target) {
        if (this.document?.type !== "feat") return;
        const uuid = target.closest("[data-uuid]")?.dataset?.uuid;
        if (!uuid) return;
        const uuids = (this.document.system.prerequisiteFeatUuids ?? []).filter((u) => u !== uuid);
        await this.document.update({ "system.prerequisiteFeatUuids": uuids });
    }

    /** Remove a mechanical creature gate row by index (armor / equipment / weapon). */
    static async onRemoveMechanicalCreatureGate(_event, target) {
        const t = this.document?.type;
        if (t !== "armor" && t !== "equipment" && t !== "weapon") return;
        const rawIdx = target?.dataset?.index ?? target?.closest?.("[data-index]")?.dataset?.index;
        const idx = parseInt(rawIdx, 10);
        if (Number.isNaN(idx) || idx < 0) return;
        const uuids = foundry.utils.duplicate(this.document.system?.mechanicalCreatureGateUuids ?? []);
        if (idx >= uuids.length) return;
        uuids.splice(idx, 1);
        const tabEl = this.element?.querySelector?.(".sheet-body .tab.active");
        if (tabEl) this._preservedScrollTop = tabEl.scrollTop;
        await this.document.update({ "system.mechanicalCreatureGateUuids": uuids });
    }

    static async onRemoveSpellCreatureTypeTarget(_event, target) {
        if (this.document?.type !== "spell") return;
        const rawIdx = target?.dataset?.index ?? target?.closest?.("[data-index]")?.dataset?.index;
        const idx = parseInt(rawIdx, 10);
        if (Number.isNaN(idx) || idx < 0) return;
        const uuids = foundry.utils.duplicate(this.document.system?.targetCreatureTypeUuids ?? []);
        if (idx >= uuids.length) return;
        uuids.splice(idx, 1);
        const tabEl = this.element?.querySelector?.(".sheet-body .tab.active");
        if (tabEl) this._preservedScrollTop = tabEl.scrollTop;
        await this.document.update({ "system.targetCreatureTypeUuids": uuids });
    }

    /** Add a creature type or subtype UUID from the spell sheet dropdown. */
    static async onAddSpellCreatureTypeTargetFromSelect(_event, target) {
        if (this.document?.type !== "spell" || !this.isEditable) return;
        const form = target.closest("form");
        const select = form?.querySelector(".spell-creature-type-target-select");
        const uuid = select?.value?.trim();
        if (!uuid) return;
        const uuids = foundry.utils.duplicate(this.document.system?.targetCreatureTypeUuids ?? []);
        if (uuids.includes(uuid)) return;
        uuids.push(uuid);
        const tabEl = this.element?.querySelector?.(".sheet-body .tab.active");
        if (tabEl) this._preservedScrollTop = tabEl.scrollTop;
        await this.document.update({ "system.targetCreatureTypeUuids": uuids });
        if (select) select.value = "";
    }

    /** Item types that edit `system.cgsGrants.senses` on the item sheet (Phase 5b). */
    static #itemTypesWithCgsSensesUi = new Set(["race", "feat", "feature", "armor", "weapon", "equipment"]);

    /**
     * Build a plain `{ grants, senses }` for `system.cgsGrants` (duplicate, not references).
     * @param {Item} doc
     * @param {{ grants?: unknown[], senses?: unknown[] }} [overrides]  If omitted, pulls current doc slices for that key.
     * @returns {{ grants: unknown[], senses: unknown[] }}
     */
    static #plainCgsPayload(doc, overrides = {}) {
        return {
            grants: foundry.utils.duplicate(overrides.grants ?? doc.system?.cgsGrants?.grants ?? []),
            senses: foundry.utils.duplicate(overrides.senses ?? doc.system?.cgsGrants?.senses ?? [])
        };
    }

    /**
     * Default row for a new CGS sense (first configured sense type, empty range).
     */
    static #defaultNewCgsSenseRow() {
        const st = globalThis.CONFIG?.THIRDERA?.senseTypes;
        if (st && typeof st === "object") {
            const keys = Object.keys(st);
            if (keys.length) return { type: keys[0], range: "" };
        }
        return { type: "", range: "" };
    }

    /**
     * Persist `system.cgsGrants` via a targeted `document.update` (plain duplicate of grants + senses).
     * Uses `diff: false` so the client does not replace the payload with a dry-run diff only (Foundry default
     * `diff: true` was followed by server round-trip that left `_source.system.cgsGrants.senses` empty).
     * Uses plain `system.cgsGrants` (not `==cgsGrants`): Item TypeDataModel.migrateData used to inject an empty
     * sibling `cgsGrants` when only `==cgsGrants` was present, which overwrote the replacement in merge order.
     * Compendium: resolves `game.packs.get(pack).get(id)` so the update runs on the cached pack instance; if that
     * differs from `sheet.document`, syncs the sheet copy with `updateSource({ system })` from the returned document
     * then `prepareData()` so nested TypeDataModel (`system`) is re-initialized — not only `_source` merge.
     * Runs `CONFIG.Item.dataModels[type].migrateDataSafe` on the `system` slice before update so nested CGS migrates
     * without sending top-level `type` (avoids Foundry treating `type` as a schema diff that clears `system`).
     * @param {ThirdEraItemSheet} sheet
     * @param {{ grants: unknown[], senses: unknown[] }} cgsPayload
     */
    static async #applyCgsGrantsThroughSheetSubmit(sheet, cgsPayload) {
        const sheetDoc = sheet.document;
        const plain = foundry.utils.duplicate(cgsPayload);
        let liveDoc = sheetDoc;
        if (sheetDoc.pack) {
            const pack = game.packs.get(sheetDoc.pack);
            const fromPack = pack?.get(sheetDoc.id, { strict: false });
            if (fromPack) liveDoc = fromPack;
        }
        const systemPart = { cgsGrants: plain };
        const dm = globalThis.CONFIG?.Item?.dataModels?.[sheetDoc.type];
        if (dm && typeof dm.migrateDataSafe === "function") {
            dm.migrateDataSafe(systemPart);
        }

        const returned = await liveDoc.update({ system: systemPart }, { render: false, diff: false });

        if (returned && staleSheetItemDocNeedsSystemResync(sheetDoc, returned)) {
            sheetDoc.updateSource(
                buildSystemUpdateSourceChangesFromReturnedItem(returned, {
                    clone: (o) => foundry.utils.deepClone(o)
                })
            );
            if (typeof sheetDoc.prepareData === "function") {
                await sheetDoc.prepareData();
            }
        }
    }

    /**
     * Add a sense row under `system.cgsGrants.senses`.
     */
    static async onAddCgsSense(event, target) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        if (!ThirdEraItemSheet.#itemTypesWithCgsSensesUi.has(this.document?.type)) {
            return;
        }
        if (!this.isEditable) {
            ui.notifications?.warn?.(game.i18n.localize("THIRDERA.ItemSheet.SenseEditNotAllowed"));
            return;
        }
        const doc = this.document;
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const senses = foundry.utils.duplicate(doc.system?.cgsGrants?.senses ?? []);
        const newRow = ThirdEraItemSheet.#defaultNewCgsSenseRow();
        senses.push(newRow);
        const cgsPayload = ThirdEraItemSheet.#plainCgsPayload(doc, { senses });
        try {
            await ThirdEraItemSheet.#applyCgsGrantsThroughSheetSubmit(this, cgsPayload);
            await ThirdEraItemSheet.#afterCgsSensesMutation(this);
            await this.render(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            ui.notifications?.error?.(msg);
        }
    }

    /** Remove a sense row by `data-sense-index` on the row or control. */
    static async onRemoveCgsSense(event, target) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        if (!ThirdEraItemSheet.#itemTypesWithCgsSensesUi.has(this.document?.type)) return;
        if (!this.isEditable) {
            ui.notifications?.warn?.(game.i18n.localize("THIRDERA.ItemSheet.SenseEditNotAllowed"));
            return;
        }
        const doc = this.document;
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const row = target?.closest?.("[data-sense-index]");
        const idx = parseInt(row?.dataset?.senseIndex, 10);
        if (Number.isNaN(idx)) return;
        const senses = foundry.utils.duplicate(doc.system?.cgsGrants?.senses ?? []);
        if (idx < 0 || idx >= senses.length) return;
        senses.splice(idx, 1);
        const cgsPayload = ThirdEraItemSheet.#plainCgsPayload(doc, { senses });
        try {
            await ThirdEraItemSheet.#applyCgsGrantsThroughSheetSubmit(this, cgsPayload);
            await ThirdEraItemSheet.#afterCgsSensesMutation(this);
            await this.render(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            ui.notifications?.error?.(msg);
        }
    }

    /** Add a `spellGrant` row to `system.cgsGrants.grants` (same item types as CGS senses UI). */
    static async onAddCgsSpellGrant(event, _target) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        if (!ThirdEraItemSheet.#itemTypesWithCgsSensesUi.has(this.document?.type)) return;
        if (!this.isEditable) {
            ui.notifications?.warn?.(game.i18n.localize("THIRDERA.ItemSheet.SenseEditNotAllowed"));
            return;
        }
        const doc = this.document;
        const tab = event?.target?.closest?.(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const grants = foundry.utils.duplicate(doc.system?.cgsGrants?.grants ?? []);
        grants.push({ category: "spellGrant", spellUuid: "" });
        const senses = foundry.utils.duplicate(doc.system?.cgsGrants?.senses ?? []);
        const cgsPayload = ThirdEraItemSheet.#plainCgsPayload(doc, { grants, senses });
        try {
            await ThirdEraItemSheet.#applyCgsGrantsThroughSheetSubmit(this, cgsPayload);
            await ThirdEraItemSheet.#afterCgsSensesMutation(this);
            await this.render(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            ui.notifications?.error?.(msg);
        }
    }

    /** Remove one `spellGrant` row by `data-cgs-spell-grant-index` (full grants-array index). */
    static async onRemoveCgsSpellGrant(event, target) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        if (!ThirdEraItemSheet.#itemTypesWithCgsSensesUi.has(this.document?.type)) return;
        if (!this.isEditable) {
            ui.notifications?.warn?.(game.i18n.localize("THIRDERA.ItemSheet.SenseEditNotAllowed"));
            return;
        }
        const doc = this.document;
        const tab = target?.closest?.(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const row = target?.closest?.("[data-cgs-spell-grant-index]");
        const idx = parseInt(row?.dataset?.cgsSpellGrantIndex ?? target?.dataset?.cgsSpellGrantIndex, 10);
        if (Number.isNaN(idx)) return;
        const grants = foundry.utils.duplicate(doc.system?.cgsGrants?.grants ?? []);
        const g = grants[idx];
        if (!g || g.category !== "spellGrant") return;
        grants.splice(idx, 1);
        const senses = foundry.utils.duplicate(doc.system?.cgsGrants?.senses ?? []);
        const cgsPayload = ThirdEraItemSheet.#plainCgsPayload(doc, { grants, senses });
        try {
            await ThirdEraItemSheet.#applyCgsGrantsThroughSheetSubmit(this, cgsPayload);
            await ThirdEraItemSheet.#afterCgsSensesMutation(this);
            await this.render(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            ui.notifications?.error?.(msg);
        }
    }

    /**
     * Persist a field on one spellGrant row (inputs have no `name`; avoids submitOnChange clobbering `grants`).
     * @param {ThirdEraItemSheet} sheet
     * @param {HTMLElement} el
     */
    static async onCgsSpellGrantFieldChange(sheet, el) {
        if (!ThirdEraItemSheet.#itemTypesWithCgsSensesUi.has(sheet.document?.type)) return;
        if (!sheet.isEditable) {
            ui.notifications?.warn?.(game.i18n.localize("THIRDERA.ItemSheet.SenseEditNotAllowed"));
            return;
        }
        const field = el.dataset?.spellGrantField;
        const rowEl = el.closest("[data-cgs-spell-grant-index]");
        const idx = parseInt(rowEl?.dataset?.cgsSpellGrantIndex, 10);
        if (!field || Number.isNaN(idx)) return;
        const doc = sheet.document;
        const grants = foundry.utils.duplicate(doc.system?.cgsGrants?.grants ?? []);
        const g = grants[idx];
        if (!g || g.category !== "spellGrant") return;

        if (el.type === "checkbox" && field === "atWill") {
            if (el.checked) {
                g.atWill = true;
                delete g.usesPerDay;
            } else {
                delete g.atWill;
            }
        } else if (field === "usesPerDay" || field === "casterLevel") {
            const raw = String(el.value ?? "").trim();
            if (raw === "" || raw === "-") {
                delete g[field];
            } else {
                const n = Number(raw);
                if (Number.isFinite(n)) g[field] = field === "usesPerDay" ? Math.max(0, Math.trunc(n)) : n;
                else delete g[field];
            }
        } else if (field === "classItemId" || field === "label") {
            const s = String(el.value ?? "").trim();
            if (s) g[field] = s;
            else delete g[field];
        }

        const tab = rowEl?.closest?.(".tab");
        if (tab) sheet._preservedScrollTop = tab.scrollTop;
        const senses = foundry.utils.duplicate(doc.system?.cgsGrants?.senses ?? []);
        const cgsPayload = ThirdEraItemSheet.#plainCgsPayload(doc, { grants, senses });
        try {
            await ThirdEraItemSheet.#applyCgsGrantsThroughSheetSubmit(sheet, cgsPayload);
            await ThirdEraItemSheet.#afterCgsSensesMutation(sheet);
            await sheet.render(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            ui.notifications?.error?.(msg);
        }
    }

    /**
     * After mutating `system.cgsGrants.senses`, match mechanical-effect sync (feat/race/world gear).
     * @param {ThirdEraItemSheet} sheet
     */
    static async #afterCgsSensesMutation(sheet) {
        const doc = sheet.document;
        if (doc.type === "feat") await sheet._syncWorldFeatToActorCopies();
        else if (doc.type === "race" && !doc.actor && doc.uuid) await sheet._syncWorldRaceToActorCopies();
        else if (doc.type !== "condition") {
            if (doc.actor) {
                const actor = doc.actor;
                if (typeof actor.prepareData === "function") await actor.prepareData();
                if (actor.sheet?.rendered) await actor.sheet.render();
            } else if (["armor", "weapon", "equipment"].includes(doc.type) && doc.uuid) {
                await sheet._syncWorldItemToActorCopies();
            }
        }
    }

    /** Add a typed defense grant row (immunity, energyResistance, damageReduction) to `system.cgsGrants.grants`. */
    static async onAddCgsTypedDefense(event, target) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        if (!ThirdEraItemSheet.#itemTypesWithCgsSensesUi.has(this.document?.type)) return;
        if (!this.isEditable) {
            ui.notifications?.warn?.(game.i18n.localize("THIRDERA.ItemSheet.SenseEditNotAllowed"));
            return;
        }
        const category = target?.dataset?.cgsDefenseCategory;
        if (!category || !["immunity", "energyResistance", "damageReduction"].includes(category)) return;
        const doc = this.document;
        const tab = event?.target?.closest?.(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const grants = foundry.utils.duplicate(doc.system?.cgsGrants?.grants ?? []);
        if (category === "immunity") {
            grants.push({ category: "immunity", tag: "" });
        } else if (category === "energyResistance") {
            grants.push({ category: "energyResistance", energyType: "", amount: 0 });
        } else if (category === "damageReduction") {
            grants.push({ category: "damageReduction", value: 0, bypass: "" });
        }
        const senses = foundry.utils.duplicate(doc.system?.cgsGrants?.senses ?? []);
        const cgsPayload = ThirdEraItemSheet.#plainCgsPayload(doc, { grants, senses });
        try {
            await ThirdEraItemSheet.#applyCgsGrantsThroughSheetSubmit(this, cgsPayload);
            await ThirdEraItemSheet.#afterCgsSensesMutation(this);
            await this.render(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            ui.notifications?.error?.(msg);
        }
    }

    /** Remove one typed defense grant row by `data-cgs-defense-index` (full grants-array index). */
    static async onRemoveCgsTypedDefense(event, target) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        if (!ThirdEraItemSheet.#itemTypesWithCgsSensesUi.has(this.document?.type)) return;
        if (!this.isEditable) {
            ui.notifications?.warn?.(game.i18n.localize("THIRDERA.ItemSheet.SenseEditNotAllowed"));
            return;
        }
        const category = target?.dataset?.cgsDefenseCategory;
        if (!category || !["immunity", "energyResistance", "damageReduction"].includes(category)) return;
        const doc = this.document;
        const tab = target?.closest?.(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const row = target?.closest?.("[data-cgs-defense-index]");
        const idx = parseInt(row?.dataset?.cgsDefenseIndex ?? target?.dataset?.cgsDefenseIndex, 10);
        if (Number.isNaN(idx)) return;
        const grants = foundry.utils.duplicate(doc.system?.cgsGrants?.grants ?? []);
        const g = grants[idx];
        if (!g || g.category !== category) return;
        grants.splice(idx, 1);
        const senses = foundry.utils.duplicate(doc.system?.cgsGrants?.senses ?? []);
        const cgsPayload = ThirdEraItemSheet.#plainCgsPayload(doc, { grants, senses });
        try {
            await ThirdEraItemSheet.#applyCgsGrantsThroughSheetSubmit(this, cgsPayload);
            await ThirdEraItemSheet.#afterCgsSensesMutation(this);
            await this.render(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            ui.notifications?.error?.(msg);
        }
    }

    /**
     * Persist a field on one typed defense grant row (inputs have no `name`; avoids submitOnChange clobbering `grants`).
     * @param {ThirdEraItemSheet} sheet
     * @param {HTMLElement} el
     */
    static async onCgsTypedDefenseFieldChange(sheet, el) {
        if (!ThirdEraItemSheet.#itemTypesWithCgsSensesUi.has(sheet.document?.type)) return;
        if (!sheet.isEditable) {
            ui.notifications?.warn?.(game.i18n.localize("THIRDERA.ItemSheet.SenseEditNotAllowed"));
            return;
        }
        const field = el.dataset?.defenseField;
        const category = el.dataset?.cgsDefenseCategory;
        const rowEl = el.closest("[data-cgs-defense-index]");
        const idx = parseInt(rowEl?.dataset?.cgsDefenseIndex ?? el.dataset?.cgsDefenseIndex, 10);
        if (!field || !category || Number.isNaN(idx)) return;
        const doc = sheet.document;
        const grants = foundry.utils.duplicate(doc.system?.cgsGrants?.grants ?? []);
        const g = grants[idx];
        if (!g || g.category !== category) return;

        if (field === "tag" || field === "energyType" || field === "bypass") {
            g[field] = String(el.value ?? "").trim();
        } else if (field === "amount" || field === "value") {
            const raw = String(el.value ?? "").trim();
            const n = Number(raw);
            g[field] = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
        }

        const tab = rowEl?.closest?.(".tab");
        if (tab) sheet._preservedScrollTop = tab.scrollTop;
        const senses = foundry.utils.duplicate(doc.system?.cgsGrants?.senses ?? []);
        const cgsPayload = ThirdEraItemSheet.#plainCgsPayload(doc, { grants, senses });
        try {
            await ThirdEraItemSheet.#applyCgsGrantsThroughSheetSubmit(sheet, cgsPayload);
            await ThirdEraItemSheet.#afterCgsSensesMutation(sheet);
            await sheet.render(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            ui.notifications?.error?.(msg);
        }
    }

    /** Add a creature type or subtype overlay row to `system.cgsGrants.grants`. */
    static async onAddCgsTypeOverlay(event, target) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        if (!ThirdEraItemSheet.#itemTypesWithCgsSensesUi.has(this.document?.type)) return;
        if (!this.isEditable) {
            ui.notifications?.warn?.(game.i18n.localize("THIRDERA.ItemSheet.SenseEditNotAllowed"));
            return;
        }
        const category = target?.dataset?.cgsOverlayCategory;
        if (!category || !["creatureTypeOverlay", "subtypeOverlay"].includes(category)) return;
        const doc = this.document;
        const tab = event?.target?.closest?.(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const grants = foundry.utils.duplicate(doc.system?.cgsGrants?.grants ?? []);
        if (category === "creatureTypeOverlay") {
            grants.push({ category: "creatureTypeOverlay", typeUuid: "" });
        } else {
            grants.push({ category: "subtypeOverlay", subtypeUuid: "" });
        }
        const senses = foundry.utils.duplicate(doc.system?.cgsGrants?.senses ?? []);
        const cgsPayload = ThirdEraItemSheet.#plainCgsPayload(doc, { grants, senses });
        try {
            await ThirdEraItemSheet.#applyCgsGrantsThroughSheetSubmit(this, cgsPayload);
            await ThirdEraItemSheet.#afterCgsSensesMutation(this);
            await this.render(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            ui.notifications?.error?.(msg);
        }
    }

    /** Remove one overlay grant row by index and category. */
    static async onRemoveCgsTypeOverlay(event, target) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        if (!ThirdEraItemSheet.#itemTypesWithCgsSensesUi.has(this.document?.type)) return;
        if (!this.isEditable) {
            ui.notifications?.warn?.(game.i18n.localize("THIRDERA.ItemSheet.SenseEditNotAllowed"));
            return;
        }
        const category = target?.dataset?.cgsOverlayCategory;
        if (!category || !["creatureTypeOverlay", "subtypeOverlay"].includes(category)) return;
        const doc = this.document;
        const tab = target?.closest?.(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const row = target?.closest?.("[data-cgs-type-overlay-index], [data-cgs-subtype-overlay-index]");
        const idxRaw =
            category === "creatureTypeOverlay"
                ? row?.dataset?.cgsTypeOverlayIndex ?? target?.dataset?.cgsTypeOverlayIndex
                : row?.dataset?.cgsSubtypeOverlayIndex ?? target?.dataset?.cgsSubtypeOverlayIndex;
        const idx = parseInt(idxRaw, 10);
        if (Number.isNaN(idx)) return;
        const grants = foundry.utils.duplicate(doc.system?.cgsGrants?.grants ?? []);
        const g = grants[idx];
        if (!g || g.category !== category) return;
        grants.splice(idx, 1);
        const senses = foundry.utils.duplicate(doc.system?.cgsGrants?.senses ?? []);
        const cgsPayload = ThirdEraItemSheet.#plainCgsPayload(doc, { grants, senses });
        try {
            await ThirdEraItemSheet.#applyCgsGrantsThroughSheetSubmit(this, cgsPayload);
            await ThirdEraItemSheet.#afterCgsSensesMutation(this);
            await this.render(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            ui.notifications?.error?.(msg);
        }
    }

    /**
     * Persist overlay UUID select (grants array index).
     * @param {ThirdEraItemSheet} sheet
     * @param {HTMLElement} el
     */
    static async onCgsTypeOverlayFieldChange(sheet, el) {
        if (!ThirdEraItemSheet.#itemTypesWithCgsSensesUi.has(sheet.document?.type)) return;
        if (!sheet.isEditable) {
            ui.notifications?.warn?.(game.i18n.localize("THIRDERA.ItemSheet.SenseEditNotAllowed"));
            return;
        }
        const field = el.dataset?.overlayField;
        const category = el.dataset?.cgsOverlayCategory;
        const rowEl = el.closest("[data-cgs-type-overlay-index], [data-cgs-subtype-overlay-index]");
        const idxRaw =
            category === "creatureTypeOverlay"
                ? rowEl?.dataset?.cgsTypeOverlayIndex ?? el.dataset?.cgsTypeOverlayIndex
                : rowEl?.dataset?.cgsSubtypeOverlayIndex ?? el.dataset?.cgsSubtypeOverlayIndex;
        const idx = parseInt(idxRaw, 10);
        if (!field || !category || Number.isNaN(idx)) return;
        const doc = sheet.document;
        const grants = foundry.utils.duplicate(doc.system?.cgsGrants?.grants ?? []);
        const g = grants[idx];
        if (!g || g.category !== category) return;
        const v = String(el.value ?? "").trim();
        if (field === "typeUuid") {
            g.typeUuid = v;
        } else if (field === "subtypeUuid") {
            g.subtypeUuid = v;
        } else {
            return;
        }
        const tab = rowEl?.closest?.(".tab");
        if (tab) sheet._preservedScrollTop = tab.scrollTop;
        const senses = foundry.utils.duplicate(doc.system?.cgsGrants?.senses ?? []);
        const cgsPayload = ThirdEraItemSheet.#plainCgsPayload(doc, { grants, senses });
        try {
            await ThirdEraItemSheet.#applyCgsGrantsThroughSheetSubmit(sheet, cgsPayload);
            await ThirdEraItemSheet.#afterCgsSensesMutation(sheet);
            await sheet.render(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            ui.notifications?.error?.(msg);
        }
    }
}
