/**
 * Item sheet for Third Era items using ApplicationV2
 * @extends {foundry.applications.sheets.ItemSheetV2}
 */
import { addDomainSpellsToActor, getSpellsForDomain } from "../logic/domain-spells.mjs";

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
            addConditionChange: ThirdEraItemSheet.onAddConditionChange,
            removeConditionChange: ThirdEraItemSheet.onRemoveConditionChange,
            editImage: ThirdEraItemSheet.onEditImage,
            addPrerequisiteFeat: ThirdEraItemSheet.onAddPrerequisiteFeat,
            removePrerequisiteFeat: ThirdEraItemSheet.onRemovePrerequisiteFeat
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
            spellResistanceChoices: CONFIG.THIRDERA?.spellResistanceChoices || {}
        };

        // Enrich HTML description and other fields
        const enriched = {
            description: await foundry.applications.ux.TextEditor.enrichHTML(systemData.description, { async: true, relativeTo: item }),
            materialDescription: await foundry.applications.ux.TextEditor.enrichHTML(systemData.components?.materialDescription || "<ul><li></li></ul>", { async: true, relativeTo: item }),
            benefit: systemData.benefit ? await foundry.applications.ux.TextEditor.enrichHTML(systemData.benefit, { async: true, relativeTo: item }) : "",
            special: systemData.special ? await foundry.applications.ux.TextEditor.enrichHTML(systemData.special, { async: true, relativeTo: item }) : ""
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
        let systemForContext = systemData;
        if (item.type === "class") {
            const rawSystem = item._source?.system ?? item.toObject?.()?.system;
            const systemPlain = (rawSystem && typeof rawSystem === "object")
                ? foundry.utils.deepClone(rawSystem)
                : (typeof systemData?.toObject === "function" ? systemData.toObject() : systemData);
            const autoGrantedWithIndex = autoGrantedFeatsArray.map((e, i) => ({ ...e, _index: i }));
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
            ...(item.type === "condition" ? { conditionChangeKeys: ThirdEraItemSheet.getConditionChangeKeyOptions() } : {})
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

    /** Condition effect key options for the condition sheet dropdown (key -> localized label). */
    static getConditionChangeKeyOptions() {
        const t = (key) => game.i18n.localize(`THIRDERA.ConditionChangeKeys.${key}`);
        return {
            "": "—",
            ac: t("ac"),
            acLoseDex: t("acLoseDex"),
            speedMultiplier: t("speedMultiplier"),
            saveFort: t("saveFort"),
            saveRef: t("saveRef"),
            saveWill: t("saveWill"),
            attack: t("attack"),
            attackMelee: t("attackMelee"),
            attackRanged: t("attackRanged")
        };
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

        // Restore manual scroll position if set (prevents jumping when adding/removing rows)
        if (this._preservedScrollTop !== undefined) {
            const preservedScroll = this._preservedScrollTop;
            this._preservedScrollTop = undefined;
            const tab = this.element.querySelector(".sheet-body .tab.active");
            if (tab && preservedScroll > 0) {
                // Restore immediately
                tab.scrollTop = preservedScroll;
                // Also restore after frames to ensure it sticks (DOM updates may reset it)
                requestAnimationFrame(() => {
                    if (tab.scrollTop !== preservedScroll) {
                        tab.scrollTop = preservedScroll;
                    }
                    // Second attempt after a short delay
                    setTimeout(() => {
                        if (tab.scrollTop !== preservedScroll) {
                            tab.scrollTop = preservedScroll;
                        }
                    }, 10);
                });
            }
        }

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

        // Enable drag-and-drop for class, race, spell, school, and domain item sheets
        if (this.document.type === "class" || this.document.type === "race" || this.document.type === "spell" || this.document.type === "school" || this.document.type === "domain") {
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
        if (!droppedItem) return;

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

        return data;
    }

    /** @override */
    async _processSubmitData(event, form, submitData, options = {}) {
        await super._processSubmitData(event, form, submitData, options);
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
     * Add a blank mechanical effect row to a condition item.
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static async onAddConditionChange(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const current = [...(this.item.system.changes || [])];
        current.push({ key: "", value: 0 });
        await this.item.update({ "system.changes": current });
    }

    /**
     * Remove a mechanical effect row from a condition item.
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element (must have data-index)
     * @this {ThirdEraItemSheet}
     */
    static async onRemoveConditionChange(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;
        const index = parseInt(target.dataset.index, 10);
        if (Number.isNaN(index)) return;
        const current = [...(this.item.system.changes || [])];
        current.splice(index, 1);
        await this.item.update({ "system.changes": current });
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
}
