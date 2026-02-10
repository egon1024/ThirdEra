import { getWieldingInfo } from "../data/_damage-helpers.mjs";

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
            equipWeaponHand: ThirdEraActorSheet.#onEquipWeaponHand,
            changeTab: ThirdEraActorSheet.#onChangeTab,
            deleteActor: ThirdEraActorSheet.#onActorDeleteHeader,
            openRace: ThirdEraActorSheet.#onOpenRace,
            removeRace: ThirdEraActorSheet.#onRemoveRace,
            openClass: ThirdEraActorSheet.#onOpenClass,
            removeClass: ThirdEraActorSheet.#onRemoveClass,
            addClassLevel: ThirdEraActorSheet.#onAddClassLevel,
            removeClassLevel: ThirdEraActorSheet.#onRemoveClassLevel
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
            sizes: CONFIG.THIRDERA?.sizes || {},
            weaponHandedness: CONFIG.THIRDERA?.weaponHandedness || {},
            weaponHand: CONFIG.THIRDERA?.weaponHand || {},
            hitDice: CONFIG.THIRDERA?.hitDice || {},
            babProgressions: CONFIG.THIRDERA?.babProgressions || {},
            saveProgressions: CONFIG.THIRDERA?.saveProgressions || {}
        };

        // Ensure tabs state exists
        const tabs = this.tabGroups || { primary: "description" };

        // Compute Dex cap display info (dex.mod is already capped in prepareDerivedData)
        // Use effective score (base + racial) for characters; fall back to value for NPCs
        const dexScore = systemData.abilities.dex.effective ?? systemData.abilities.dex.value;
        const uncappedDexMod = Math.floor((dexScore - 10) / 2);
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

        // Compute per-class level counts from derived data and augment class items
        const classLevelCounts = systemData.details.classLevels || {};
        for (const cls of items.classes) {
            cls.derivedLevels = classLevelCounts[cls.id] || 0;
        }

        // Filter equipped items for Combat tab
        const equippedWeapons = items.weapons.filter(w =>
            w.system.equipped === "primary" || w.system.equipped === "offhand"
        );
        const equippedArmor = items.armor.filter(a => a.system.equipped === "true");

        // Compute class summary for header display
        const classSummary = items.classes
            .filter(c => c.derivedLevels > 0)
            .map(c => `${c.name} ${c.derivedLevels}`)
            .join(" / ");
        const totalLevel = systemData.details.totalLevel ?? systemData.details.level;

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
            classSummary,
            totalLevel,
            equippedWeapons,
            equippedArmor,
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
        const classes = [];
        let race = null;

        for (const item of items) {
            const itemData = item;
            if (item.type === 'weapon') weapons.push(itemData);
            else if (item.type === 'armor') armor.push(itemData);
            else if (item.type === 'equipment') equipment.push(itemData);
            else if (item.type === 'spell') spells.push(itemData);
            else if (item.type === 'feat') feats.push(itemData);
            else if (item.type === 'skill') skills.push(itemData);
            else if (item.type === 'race' && !race) race = itemData;
            else if (item.type === 'class') classes.push(itemData);
        }

        return { weapons, armor, equipment, spells, feats, skills, race, classes };
    }

    /**
     * Handle dropping an item onto the actor sheet.
     * Enforces single-race: if a race is dropped, delete any existing race first.
     * @override
     */
    async _onDropItem(event, item) {
        if (item.type === "race") {
            const existing = this.actor.items.find(i => i.type === "race");
            if (existing) {
                await existing.delete();
            }
        }

        // If this class already exists on the actor, add a level instead of duplicating
        if (item.type === "class") {
            const itemName = item.name;
            const existing = this.actor.items.find(i => i.type === "class" && i.name === itemName);
            if (existing) {
                const history = [...(this.actor.system.levelHistory || [])];
                history.push({ classItemId: existing.id, hpRolled: 0 });
                await this.actor.update({ "system.levelHistory": history });
                return false;
            }
        }

        const result = await super._onDropItem(event, item);

        // When a race is dropped, set the actor's size and speed to match
        if (item.type === "race" && result) {
            const raceData = item.system || item.toObject?.().system;
            if (raceData) {
                await this.actor.update({
                    "system.details.size": raceData.size,
                    "system.attributes.speed.value": raceData.speed
                });
            }
        }

        // When a new class is dropped, add first level to levelHistory
        if (item.type === "class" && result) {
            const created = Array.isArray(result) ? result[0] : result;
            if (created?.id) {
                const history = [...(this.actor.system.levelHistory || [])];
                history.push({ classItemId: created.id, hpRolled: 0 });
                await this.actor.update({ "system.levelHistory": history });
            }
        }

        return result;
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

        // If equipping a shield, unequip any off-hand weapon (shield occupies off-hand)
        if (isShield) {
            for (const other of this.actor.items) {
                if (other.type !== "weapon") continue;
                let otherEquipped = other.system.equipped;
                if (otherEquipped === "true") otherEquipped = "primary";
                else if (otherEquipped === "false") otherEquipped = "none";
                if (otherEquipped === "offhand") {
                    updates.push({ _id: other.id, "system.equipped": "none" });
                }
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
     * Handle equipping a weapon to a specific hand (primary / off-hand)
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onEquipWeaponHand(event, target) {
        const itemId = target.closest("[data-item-id]")?.dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (!item) return;

        const hand = target.dataset.hand; // "primary" or "offhand"

        // Normalize current equipped value for legacy data
        let currentEquipped = item.system.equipped;
        if (currentEquipped === "true") currentEquipped = "primary";
        else if (currentEquipped === "false") currentEquipped = "none";

        // Toggle off if already in this hand
        if (currentEquipped === hand) {
            return await item.update({ "system.equipped": "none" });
        }

        // Check size compatibility — can this weapon be wielded at all?
        const wielding = getWieldingInfo(
            item.system.properties.size,
            item.system.properties.handedness,
            this.actor.system.details.size
        );
        if (!wielding.canWield) {
            ui.notifications.warn(`${item.name} cannot be wielded by ${this.actor.name} — size mismatch.`);
            return;
        }

        // Block off-hand assignment if weapon is effectively two-handed
        if (hand === "offhand" && wielding.effectiveHandedness === "twoHanded") {
            ui.notifications.warn(`${item.name} requires two hands and cannot be used in the off-hand.`);
            return;
        }

        // Block off-hand if current primary weapon is effectively two-handed
        if (hand === "offhand") {
            for (const other of this.actor.items) {
                if (other.id === item.id || other.type !== "weapon") continue;
                let otherEquipped = other.system.equipped;
                if (otherEquipped === "true") otherEquipped = "primary";
                else if (otherEquipped === "false") otherEquipped = "none";
                if (otherEquipped !== "primary") continue;
                const otherWielding = getWieldingInfo(
                    other.system.properties.size,
                    other.system.properties.handedness,
                    this.actor.system.details.size
                );
                if (otherWielding.effectiveHandedness === "twoHanded") {
                    ui.notifications.warn(`Cannot equip off-hand — ${other.name} is wielded two-handed.`);
                    return;
                }
            }
        }

        // Unequip any other weapon in the same hand slot
        const updates = [];
        for (const other of this.actor.items) {
            if (other.id === item.id || other.type !== "weapon") continue;
            let otherEquipped = other.system.equipped;
            if (otherEquipped === "true") otherEquipped = "primary";
            else if (otherEquipped === "false") otherEquipped = "none";
            if (otherEquipped === hand) {
                updates.push({ _id: other.id, "system.equipped": "none" });
            }
        }

        // If equipping to off-hand, unequip any equipped shield (shield occupies off-hand)
        if (hand === "offhand") {
            for (const other of this.actor.items) {
                if (other.type !== "armor") continue;
                if (other.system.equipped !== "true") continue;
                if (other.system.armor?.type === "shield") {
                    updates.push({ _id: other.id, "system.equipped": "false" });
                }
            }
        }

        // If equipping a two-handed weapon to primary, also unequip any off-hand weapon
        if (hand === "primary" && wielding.effectiveHandedness === "twoHanded") {
            for (const other of this.actor.items) {
                if (other.id === item.id || other.type !== "weapon") continue;
                let otherEquipped = other.system.equipped;
                if (otherEquipped === "true") otherEquipped = "primary";
                else if (otherEquipped === "false") otherEquipped = "none";
                if (otherEquipped === "offhand") {
                    updates.push({ _id: other.id, "system.equipped": "none" });
                }
            }
        }

        if (updates.length) {
            await this.actor.updateEmbeddedDocuments("Item", updates);
        }
        await item.update({ "system.equipped": hand });
    }

    /**
     * Handle opening the embedded race item sheet
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static #onOpenRace(event, target) {
        const race = this.actor.items.find(i => i.type === "race");
        if (race) {
            race.sheet.render({ force: true });
        }
    }

    /**
     * Handle removing the embedded race item
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onRemoveRace(event, target) {
        const race = this.actor.items.find(i => i.type === "race");
        if (race) {
            await race.delete();
        }
    }

    /**
     * Handle opening an embedded class item sheet
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static #onOpenClass(event, target) {
        const itemId = target.closest("[data-item-id]")?.dataset.itemId;
        const cls = this.actor.items.get(itemId);
        if (cls) {
            cls.sheet.render({ force: true });
        }
    }

    /**
     * Handle removing an embedded class item
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onRemoveClass(event, target) {
        const itemId = target.closest("[data-item-id]")?.dataset.itemId;
        const cls = this.actor.items.get(itemId);
        if (cls) {
            // Remove levelHistory entries for this class
            const history = (this.actor.system.levelHistory || []).filter(e => e.classItemId !== itemId);
            await this.actor.update({ "system.levelHistory": history });
            await cls.delete();
        }
    }

    /**
     * Handle adding a level to an existing class
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onAddClassLevel(event, target) {
        const itemId = target.closest("[data-item-id]")?.dataset.itemId;
        const cls = this.actor.items.get(itemId);
        if (cls) {
            const history = [...(this.actor.system.levelHistory || [])];
            history.push({ classItemId: cls.id, hpRolled: 0 });
            await this.actor.update({ "system.levelHistory": history });
        }
    }

    /**
     * Handle removing the most recent level of a class (with confirmation)
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onRemoveClassLevel(event, target) {
        const itemId = target.closest("[data-item-id]")?.dataset.itemId;
        const cls = this.actor.items.get(itemId);
        if (!cls) return;

        const classLevels = (this.actor.system.details.classLevels || {})[itemId] || 0;
        if (classLevels <= 0) return;

        const confirmed = await Dialog.confirm({
            title: `Remove ${cls.name} Level`,
            content: `<p>Remove one level of ${cls.name} from ${this.actor.name}? (${classLevels} → ${classLevels - 1})</p>`
        });
        if (!confirmed) return;

        // Remove the last levelHistory entry for this class
        const history = [...(this.actor.system.levelHistory || [])];
        const lastIndex = history.findLastIndex(e => e.classItemId === itemId);
        if (lastIndex >= 0) {
            history.splice(lastIndex, 1);
            await this.actor.update({ "system.levelHistory": history });
        }
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
