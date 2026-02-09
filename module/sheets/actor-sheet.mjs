/**
 * Actor sheet for Third Era characters and NPCs using ApplicationV2
 * @extends {foundry.applications.sheets.ActorSheetV2}
 */
export class ThirdEraActorSheet extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.sheets.ActorSheetV2
) {

    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ["thirdera", "sheet", "actor"],
        position: { width: 720, height: 680 },
        form: { submitOnChange: true },
        actions: {
            abilityCheck: ThirdEraActorSheet.#onAbilityCheck,
            saveRoll: ThirdEraActorSheet.#onSaveRoll,
            skillCheck: ThirdEraActorSheet.#onSkillCheck,
            weaponAttack: ThirdEraActorSheet.#onWeaponAttack,
            weaponDamage: ThirdEraActorSheet.#onWeaponDamage,
            createItem: ThirdEraActorSheet.#onItemCreate,
            editItem: ThirdEraActorSheet.#onItemEdit,
            deleteItem: ThirdEraActorSheet.#onItemDelete,
            toggleEquip: ThirdEraActorSheet.#onToggleEquip,
            changeTab: ThirdEraActorSheet.#onChangeTab,
            deleteActor: ThirdEraActorSheet.#onActorDeleteHeader
        },
        window: {
            controls: [
                {
                    icon: "fa-solid fa-trash",
                    label: "Delete",
                    action: "deleteActor",
                }
            ]
        }
    };

    /** @override */
    /** @override */
    static PARTS = {
        sheet: {
            template: "systems/thirdera/templates/actor/character-sheet.hbs",
            scrollable: [".sheet-body"],
            root: true
        }
    };

    /** @override */
    _configureRenderParts(options) {
        const parts = super._configureRenderParts(options);
        // Dynamically set the template based on actor type
        if (this.document.type === 'npc') {
            parts.sheet.template = "systems/thirdera/templates/actor/npc-sheet.hbs";
        } else {
            parts.sheet.template = "systems/thirdera/templates/actor/character-sheet.hbs";
        }
        return parts;
    }

    /** @override */
    async _preRender(context, options) {
        await super._preRender(context, options);
        const focused = this.element?.querySelector(":focus");
        this._focusedInputName = focused?.name || null;
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);
        if (this._focusedInputName) {
            const input = this.element.querySelector(`[name="${this._focusedInputName}"]`);
            if (input) {
                input.focus();
            }
            this._focusedInputName = null;
        }
    }

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        // Get actor document and system data
        const actor = this.document;
        const systemData = actor.system;

        // Prepare items
        const items = this._prepareItems(actor.items);

        // Add CONFIG data
        const config = {
            abilityScores: CONFIG.THIRDERA?.AbilityScores || {},
            saves: CONFIG.THIRDERA?.Saves || {},
            armorTypes: CONFIG.THIRDERA?.armorTypes || {},
            sizes: CONFIG.THIRDERA?.sizes || {}
        };

        // Ensure tabs state exists
        const tabs = this.tabGroups || { primary: "description" };

        // Compute Dex cap display info (dex.mod is already capped in prepareDerivedData)
        const uncappedDexMod = Math.floor((systemData.abilities.dex.value - 10) / 2);
        const dexCap = {
            isCapped: systemData.abilities.dex.mod < uncappedDexMod,
            uncappedMod: uncappedDexMod
        };

        // Compute speed reduction display info
        // speed.value is already the effective (possibly reduced) speed from prepareDerivedData
        // Recover the base speed from the source data to detect reduction
        const baseSpeed = actor._source.system.attributes.speed.value;
        const speedInfo = {
            isReduced: systemData.attributes.speed.value < baseSpeed,
            baseSpeed
        };

        // Enrich HTML biography
        const enriched = {
            biography: await TextEditor.enrichHTML(systemData.biography, { async: true, relativeTo: actor })
        };

        return {
            ...context,
            actor,
            system: systemData,
            items: actor.items,
            ...items,
            ...config,
            config,
            tabs,
            enriched,
            dexCap,
            speedInfo,
            editable: this.isEditable
        };
    }

    /**
     * Organize and classify Items for the character sheet
     * @param {Collection} items  The actor's items
     * @returns {Object}          Organized items by type
     */
    _prepareItems(items) {
        const weapons = [];
        const armor = [];
        const equipment = [];
        const spells = [];
        const feats = [];
        const skills = [];

        for (const item of items) {
            const itemData = item;
            if (item.type === 'weapon') weapons.push(itemData);
            else if (item.type === 'armor') armor.push(itemData);
            else if (item.type === 'equipment') equipment.push(itemData);
            else if (item.type === 'spell') spells.push(itemData);
            else if (item.type === 'feat') feats.push(itemData);
            else if (item.type === 'skill') skills.push(itemData);
        }

        return { weapons, armor, equipment, spells, feats, skills };
    }

    /* -------------------------------------------- */
    /*  Event Handlers                              */
    /* -------------------------------------------- */

    /**
     * Handle ability check rolls
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static #onAbilityCheck(event, target) {
        const ability = target.dataset.ability;
        this.actor.rollAbilityCheck(ability);
    }

    /**
     * Handle saving throw rolls
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static #onSaveRoll(event, target) {
        const save = target.dataset.save;
        this.actor.rollSavingThrow(save);
    }

    /**
     * Handle skill check rolls
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static #onSkillCheck(event, target) {
        const itemId = target.closest("[data-item-id]")?.dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) {
            this.actor.rollSkillCheck(item.name);
        }
    }

    /**
     * Handle weapon attack rolls
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static #onWeaponAttack(event, target) {
        const itemId = target.closest("[data-item-id]")?.dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) {
            item.rollAttack();
        }
    }

    /**
     * Handle weapon damage rolls
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static #onWeaponDamage(event, target) {
        const itemId = target.closest("[data-item-id]")?.dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) {
            item.rollDamage();
        }
    }

    /**
     * Handle creating a new item
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onItemCreate(event, target) {
        const type = target.dataset.type;
        const name = `New ${type.capitalize()}`;
        const itemData = {
            name: name,
            type: type,
            system: {}
        };
        return await Item.implementation.create(itemData, { parent: this.actor });
    }

    /**
     * Handle editing an item
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static #onItemEdit(event, target) {
        const itemId = target.closest("[data-item-id]")?.dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) {
            item.sheet.render({ force: true });
        }
    }

    /**
     * Handle deleting an item
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onItemDelete(event, target) {
        const itemId = target.closest("[data-item-id]")?.dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) {
            return await item.delete();
        }
    }

    /**
     * Handle deleting the actor from the header
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onActorDeleteHeader(event, target) {
        const confirm = await Dialog.confirm({
            title: "Delete Actor",
            content: `<h4>Are you sure you want to delete ${this.actor.name}?</h4>`
        });
        if (confirm) {
            await this.actor.delete();
            this.close();
        }
    }


    /**
     * Handle toggling an item's equipped state
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onToggleEquip(event, target) {
        const itemId = target.closest("[data-item-id]")?.dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (!item) return;

        const equipping = item.system.equipped !== "true";
        if (!equipping) {
            // Unequipping — just toggle off
            return await item.update({ "system.equipped": "false" });
        }

        // Check size compatibility
        const actorSize = this.actor.system.details.size;
        const armorSize = item.system.size;
        if (armorSize !== actorSize) {
            ui.notifications.warn(`Cannot equip ${item.name} — it is ${armorSize} but ${this.actor.name} is ${actorSize}.`);
            return;
        }

        // Equipping — unequip any other item in the same slot (body armor or shield)
        const isShield = item.system.armor?.type === "shield";
        const updates = [];
        for (const other of this.actor.items) {
            if (other.id === item.id) continue;
            if (other.type !== "armor") continue;
            if (other.system.equipped !== "true") continue;
            const otherIsShield = other.system.armor?.type === "shield";
            // Only conflict if both are shields or both are body armor
            if (isShield === otherIsShield) {
                updates.push({ _id: other.id, "system.equipped": "false" });
            }
        }
        if (updates.length) {
            const unequippedNames = updates.map(u => this.actor.items.get(u._id)?.name).filter(Boolean);
            await this.actor.updateEmbeddedDocuments("Item", updates);
            ui.notifications.info(`Unequipped ${unequippedNames.join(", ")} to equip ${item.name}.`);
        }
        await item.update({ "system.equipped": "true" });
    }

    /**
     * Handle tab changes
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
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
}
