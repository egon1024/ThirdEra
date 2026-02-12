/**
 * Item sheet for Third Era items using ApplicationV2
 * @extends {foundry.applications.sheets.ItemSheetV2}
 */
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
            addScalingRow: ThirdEraItemSheet.#onAddScalingRow,
            removeScalingRow: ThirdEraItemSheet.#onRemoveScalingRow
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
        return parts;
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
            saveProgressions: CONFIG.THIRDERA?.saveProgressions || {}
        };

        // Enrich HTML description and other fields
        const enriched = {
            description: await foundry.applications.ux.TextEditor.enrichHTML(systemData.description, { async: true, relativeTo: item }),
            materialDescription: await foundry.applications.ux.TextEditor.enrichHTML(systemData.components?.materialDescription || "<ul><li></li></ul>", { async: true, relativeTo: item }),
            benefit: systemData.benefit ? await foundry.applications.ux.TextEditor.enrichHTML(systemData.benefit, { async: true, relativeTo: item }) : "",
            special: systemData.special ? await foundry.applications.ux.TextEditor.enrichHTML(systemData.special, { async: true, relativeTo: item }) : ""
        };

        return {
            ...context,
            item,
            system: systemData,
            config,
            enriched,
            tabs: this.tabGroups,
            editable: this.isEditable,
            isOwned: !!item.parent
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
            const tab = this.element.querySelector(".sheet-body .tab.active");
            if (tab) {
                tab.scrollTop = this._preservedScrollTop;
                this._preservedScrollTop = undefined;
                requestAnimationFrame(() => {
                    if (this._preservedScrollTop !== undefined) return;
                    if (tab.scrollTop === 0 && this._preservedScrollTop > 0) {
                        tab.scrollTop = this._preservedScrollTop;
                    }
                });
            }
        }

        // Restore focus after re-render (preserves tab navigation with submitOnChange)
        if (this._focusedInputName) {
            const input = this.element.querySelector(`[name="${this._focusedInputName}"]`);
            if (input) {
                input.focus();
            }
            this._focusedInputName = null;
        }

        // Manual listener for ProseMirror changes
        const editors = this.element.querySelectorAll("prose-mirror");
        editors.forEach(editor => {
            editor.addEventListener("change", (event) => {
                this.submit();
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

        // Enable drag-and-drop for class and race item sheets (skill and feat assignment)
        if (this.document.type === "class" || this.document.type === "race") {
            new DragDrop.implementation({
                permissions: { drop: () => this.isEditable },
                callbacks: { drop: this._onDrop.bind(this) }
            }).bind(this.element);
        }
    }

    /**
     * Handle drop events on class/race item sheets.
     * @param {DragEvent} event
     */
    async _onDrop(event) {
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
        if (data.type !== "Item") return;
        const droppedItem = await Item.implementation.fromDropData(data);
        if (!droppedItem) return;

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
}
