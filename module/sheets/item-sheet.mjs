/**
 * Item sheet for Third Era items using ApplicationV2
 * @extends {foundry.applications.sheets.ItemSheetV2}
 */
import { getSpellsForDomain } from "../logic/domain-spells.mjs";

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
            rollAttack: ThirdEraItemSheet.#onRollAttack,
            rollDamage: ThirdEraItemSheet.#onRollDamage,
            changeTab: ThirdEraItemSheet.#onChangeTab,
            deleteItem: ThirdEraItemSheet.#onItemDeleteHeader,
            removeClassSkill: ThirdEraItemSheet.#onRemoveClassSkill,
            removeExcludedSkill: ThirdEraItemSheet.#onRemoveExcludedSkill,
            removeFeature: ThirdEraItemSheet.#onRemoveFeature,
            removeDomain: ThirdEraItemSheet.#onRemoveDomain,
            addScalingRow: ThirdEraItemSheet.#onAddScalingRow,
            removeScalingRow: ThirdEraItemSheet.#onRemoveScalingRow,
            removeLevelByClass: ThirdEraItemSheet.#onRemoveLevelByClass,
            removeLevelByDomain: ThirdEraItemSheet.#onRemoveLevelByDomain,
            clearSchool: ThirdEraItemSheet.#onClearSchool,
            addSchoolDescriptor: ThirdEraItemSheet.#onAddSchoolDescriptor,
            removeSchoolDescriptor: ThirdEraItemSheet.#onRemoveSchoolDescriptor,
            removeOppositionSchool: ThirdEraItemSheet.#onRemoveOppositionSchool,
            addSubschool: ThirdEraItemSheet.#onAddSubschool,
            removeSubschool: ThirdEraItemSheet.#onRemoveSubschool,
            addDescriptorTag: ThirdEraItemSheet.#onAddDescriptorTag,
            removeDescriptorTag: ThirdEraItemSheet.#onRemoveDescriptorTag
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
    }

    /** @override */
    _onChangeForm(formConfig, event) {
        return super._onChangeForm(formConfig, event);
    }

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        // Get item document and system data
        const item = this.document;
        const systemData = item.system;

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
            const school = await ThirdEraItemSheet.#findSchoolByKey(systemData.schoolKey);
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

        return {
            ...context,
            item,
            system: systemData,
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
            grantedSpells
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
            new DragDrop.implementation({
                permissions: { drop: () => this.isEditable },
                callbacks: { drop: this._onDrop.bind(this) }
            }).bind(this.element);
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
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/3e68fb46-28cf-4993-8150-24eb15233806',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'item-sheet.mjs:_onDrop:entry',message:'_onDrop called',data:{documentType:this.document?.type,hasDataTransfer:!!(event?.dataTransfer)},timestamp:Date.now(),hypothesisId:'H1-H3'})}).catch(()=>{});
        // #endregion
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
        let droppedItem = null;
        if (data.type === "Item") {
            droppedItem = await Item.implementation.fromDropData(data);
        } else if (data.uuid) {
            const doc = await foundry.utils.fromUuid(data.uuid);
            if (doc?.documentName === "Item") droppedItem = doc;
        }
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/3e68fb46-28cf-4993-8150-24eb15233806',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'item-sheet.mjs:_onDrop:afterResolve',message:'drop data and resolved item',data:{dataType:data?.type,dataUuid:!!data?.uuid,dataKeys:data?Object.keys(data):[],droppedItemSet:!!droppedItem,droppedItemType:droppedItem?.type,documentType:this.document?.type},timestamp:Date.now(),hypothesisId:'H2-H5'})}).catch(()=>{});
        // #endregion
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
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/3e68fb46-28cf-4993-8150-24eb15233806',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'item-sheet.mjs:_onDrop:beforeDomainClassCheck',message:'branch check',data:{droppedType:droppedItem?.type,docType:this.document?.type,willEnterDomainClass:droppedItem?.type==='domain'&&this.document?.type==='class'},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
        // #endregion
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
            // #region agent log
            fetch('http://127.0.0.1:7244/ingest/3e68fb46-28cf-4993-8150-24eb15233806',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'item-sheet.mjs:_onDrop:domainClassUpdateDone',message:'domain added to class',data:{classId:this.document?.id,domainKey},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
            // #endregion
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
            current.push({ key: skillKey, name: droppedItem.name });
            current.sort((a, b) => a.name.localeCompare(b.name));
            await this.document.update({ "system.classSkills": current });
        } else if (this.document.type === "race") {
            const current = [...(this.document.system.excludedSkills || [])];
            if (current.some(e => e.key === skillKey)) {
                ui.notifications.info(`${droppedItem.name} is already excluded by ${this.document.name}.`);
                return;
            }
            current.push({ key: skillKey, name: droppedItem.name });
            current.sort((a, b) => a.name.localeCompare(b.name));
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
    static #onRollAttack(event, target) {
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
    static #onRollDamage(event, target) {
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
    static #onChangeTab(event, target) {
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
    static async #onItemDeleteHeader(event, target) {
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
    static async #onRemoveClassSkill(event, target) {
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
    static async #onRemoveExcludedSkill(event, target) {
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
    static async #onRemoveFeature(event, target) {
        const index = parseInt(target.dataset.featureIndex);
        if (isNaN(index)) return;
        const current = [...(this.item.system.features || [])];
        current.splice(index, 1);
        await this.item.update({ "system.features": current });
    }

    /**
     * Handle removing a domain from a class
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static async #onRemoveDomain(event, target) {
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
     * Handle adding a scaling table row to a feat
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraItemSheet}
     */
    static async #onAddScalingRow(event, target) {
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
    static async #onRemoveScalingRow(event, target) {
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
    static async #onRemoveLevelByClass(event, target) {
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
    static async #onRemoveLevelByDomain(event, target) {
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
    static async #findSchoolByKey(schoolKey) {
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
    static async #onClearSchool(event, target) {
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
    static async #onAddSchoolDescriptor(event, target) {
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
    static async #onRemoveSchoolDescriptor(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const index = parseInt(target.dataset.descriptorIndex);
        if (isNaN(index)) return;
        const current = [...(this.item.system.schoolDescriptors ?? [])];
        current.splice(index, 1);
        await this.item.update({ "system.schoolDescriptors": current });
    }

    static async #onRemoveOppositionSchool(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const index = parseInt(target.dataset.oppositionIndex);
        if (isNaN(index)) return;
        const current = [...(this.item.system.oppositionSchools || [])];
        current.splice(index, 1);
        await this.item.update({ "system.oppositionSchools": current });
    }

    static async #onAddSubschool(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const current = [...(this.item.system.subschools || [])];
        current.push("");
        await this.item.update({ "system.subschools": current });
    }

    static async #onRemoveSubschool(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const index = parseInt(target.dataset.subschoolIndex);
        if (isNaN(index)) return;
        const current = [...(this.item.system.subschools || [])];
        current.splice(index, 1);
        await this.item.update({ "system.subschools": current });
    }

    static async #onAddDescriptorTag(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const current = [...(this.item.system.descriptorTags || [])];
        current.push("");
        await this.item.update({ "system.descriptorTags": current });
    }

    static async #onRemoveDescriptorTag(event, target) {
        const tab = target.closest(".tab");
        if (tab) this._preservedScrollTop = tab.scrollTop;

        const index = parseInt(target.dataset.descriptorIndex);
        if (isNaN(index)) return;
        const current = [...(this.item.system.descriptorTags || [])];
        current.splice(index, 1);
        await this.item.update({ "system.descriptorTags": current });
    }
}
