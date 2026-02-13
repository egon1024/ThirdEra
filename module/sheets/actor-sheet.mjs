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
            removeClassLevel: ThirdEraActorSheet.#onRemoveClassLevel,
            addHpAdjustment: ThirdEraActorSheet.#onAddHpAdjustment,
            removeHpAdjustment: ThirdEraActorSheet.#onRemoveHpAdjustment,
            removeGrantedSkill: ThirdEraActorSheet.#onRemoveGrantedSkill,
            rollHitDie: ThirdEraActorSheet.#onRollHitDie
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

        // Attach change listeners for level history HP inputs (not form-bound)
        this.element.querySelectorAll("input[data-level-hp-index]").forEach(input => {
            input.addEventListener("change", async (event) => {
                const index = parseInt(event.target.dataset.levelHpIndex);
                const value = Math.max(0, parseInt(event.target.value) || 0);
                const history = foundry.utils.deepClone(this.actor.system.levelHistory);
                if (history[index]) {
                    history[index].hpRolled = value;
                    await this.actor.update({ "system.levelHistory": history });
                }
            });
        });

        // Attach change listeners for skill rank inputs (embedded items, not form-bound)
        this.element.querySelectorAll("input[data-skill-item-id]").forEach(input => {
            input.addEventListener("change", async (event) => {
                const itemId = event.target.dataset.skillItemId;
                const skill = this.actor.items.get(itemId);
                if (!skill) return;
                const maxRanks = parseFloat(event.target.dataset.skillMaxRanks) || 999;
                let value = parseFloat(event.target.value) || 0;
                value = Math.max(0, Math.min(value, maxRanks));
                // Round to nearest 0.5
                value = Math.round(value * 2) / 2;
                await skill.update({ "system.ranks": value });
            });
        });

        // Attach dragstart listeners for hotbar macro support
        this.element.querySelectorAll("[data-drag-type]").forEach(el => {
            el.addEventListener("dragstart", (event) => {
                const dragType = el.dataset.dragType;
                const itemId = el.closest("[data-item-id]")?.dataset.itemId;
                const item = this.actor.items.get(itemId);
                if (!item) return;
                const dragData = {
                    type: "ThirdEraRoll",
                    rollType: dragType,
                    actorId: this.actor.id,
                    itemId: itemId,
                    itemName: item.name,
                    sceneId: canvas.scene?.id ?? null,
                    tokenId: this.token?.id ?? null
                };
                event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
            });
        });

        // Attach change listener for header HP input (not form-bound, avoids duplicate name)
        const headerHpInput = this.element.querySelector("input[data-header-hp]");
        if (headerHpInput) {
            headerHpInput.addEventListener("change", async (event) => {
                const value = Math.max(0, parseInt(event.target.value) || 0);
                await this.actor.update({ "system.attributes.hp.value": value });
            });
        }

        // Context menu on race name
        new ContextMenu(this.element, ".race-name[data-action='openRace']", [
            {
                name: "Remove Race",
                icon: '<i class="fas fa-trash"></i>',
                callback: async () => {
                    const race = this.actor.items.find(i => i.type === "race");
                    if (race) await race.delete();
                }
            }
        ], { jQuery: false });

        // Attach change listeners for HP adjustment inputs (not form-bound)
        this.element.querySelectorAll("input[data-hp-adj-index]").forEach(input => {
            input.addEventListener("change", async (event) => {
                const index = parseInt(event.target.dataset.hpAdjIndex);
                const field = event.target.dataset.hpAdjField; // "value" or "label"
                const adjustments = foundry.utils.deepClone(this.actor.system.attributes.hp.adjustments);
                if (adjustments[index]) {
                    adjustments[index][field] = field === "value" ? (parseInt(event.target.value) || 0) : event.target.value;
                    await this.actor.update({ "system.attributes.hp.adjustments": adjustments });
                }
            });
        });
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
        if (!this.tabGroups.abilities) this.tabGroups.abilities = "scores";
        const tabs = this.tabGroups;

        // Compute Dex cap display info (dex.mod is already capped in prepareDerivedData)
        const dexScore = systemData.abilities.dex.effective ?? systemData.abilities.dex.value;
        const uncappedDexMod = Math.floor((dexScore - 10) / 2);

        // Determine why it's capped (armor, load, or both)
        let capReason = "armor";
        const loadMaxDex = systemData.loadEffects?.maxDex;
        if (loadMaxDex !== null && loadMaxDex !== undefined) {
            // Find the most restrictive armor max dex
            let armorMaxDex = null;
            for (const item of actor.items) {
                if (item.type === "armor" && item.system.equipped === "true" && item.system.armor.type !== "shield") {
                    const m = item.system.armor.maxDex;
                    if (m !== null) armorMaxDex = (armorMaxDex === null) ? m : Math.min(armorMaxDex, m);
                }
            }

            if (armorMaxDex === null || loadMaxDex < armorMaxDex) {
                capReason = "load";
            } else if (loadMaxDex === armorMaxDex) {
                capReason = "both";
            }
        }

        const dexCap = {
            isCapped: systemData.abilities.dex.mod < uncappedDexMod,
            isOverloaded: systemData.loadEffects?.load === "overload",
            uncappedMod: uncappedDexMod,
            maxDex: systemData.abilities.dex.armorMaxDex,
            reason: capReason
        };

        // Compute speed reduction display info
        const speedInfo = systemData.attributes.speed.info || { reduced: false, baseSpeed: systemData.attributes.speed.value, reason: null };

        // Compute per-class level counts from derived data and augment class items
        const classLevelCounts = systemData.details.classLevels || {};
        for (const cls of items.classes) {
            cls.derivedLevels = classLevelCounts[cls.id] || 0;
            // Attach granted features for this class (for Classes tab display)
            cls.grantedFeatures = (systemData.grantedFeaturesByClass?.get(cls.id) || [])
                .map(f => ({
                    featName: f.featName,
                    grantLevel: f.grantLevel,
                    scalingValue: f.scalingValue
                }));
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

        // Prepare level history display data for Classes tab
        const hpBreakdown = systemData.attributes.hp.hpBreakdown || [];
        const levelHistory = (systemData.levelHistory || []).map((entry, i) => {
            const cls = actor.items.get(entry.classItemId);
            const bp = hpBreakdown[i];
            return {
                index: i,
                characterLevel: i + 1,
                className: cls?.name ?? "Unknown",
                hitDie: cls?.system.hitDie ?? "?",
                hpRolled: entry.hpRolled,
                conMod: bp?.conMod ?? 0,
                subtotal: bp?.subtotal ?? 0
            };
        });

        // Enrich HTML biography
        const enriched = {
            biography: await foundry.applications.ux.TextEditor.enrichHTML(systemData.biography, { async: true, relativeTo: actor })
        };

        // Compute HP status for header colorization
        // Compute HP status for header colorization
        const hpCurrent = systemData.attributes.hp.value;
        const hpMax = systemData.attributes.hp.max;
        const hpStatus = hpCurrent >= hpMax ? "hp-full" : (hpCurrent >= hpMax * 0.5 ? "hp-warning" : "hp-danger");

        // Split granted features by type
        const grantedFeatures = systemData.grantedFeatures || [];
        const grantedFeats = grantedFeatures.filter(f => f.type === 'feat');
        const grantedClassFeatures = grantedFeatures.filter(f => f.type !== 'feat');

        // Compute encumbrance display info
        const inv = systemData.inventory || { totalWeight: 0, capacity: { light: 0, medium: 0, heavy: 1, metadata: { baseMaxLoad: 0, sizeMod: 1 } }, load: "light" };
        const heavyCap = inv.capacity.heavy || 1;
        const encumbrancePercent = Math.min((inv.totalWeight / heavyCap) * 100, 100);
        const encumbranceMarkers = {
            light: (inv.capacity.light / heavyCap) * 100,
            medium: (inv.capacity.medium / heavyCap) * 100
        };

        // Format breakdown display
        const meta = inv.capacity.metadata || { baseMaxLoad: 0, sizeMod: 1 };
        const str = systemData.abilities.str.effective;
        const sizeLabel = systemData.details.size || "Medium";
        const breakdown = {
            light: {
                label: "THIRDERA.Inventory.Light",
                value: inv.capacity.light,
                calculation: `1/3 of ${inv.capacity.heavy} lbs.`
            },
            medium: {
                label: "THIRDERA.Inventory.Medium",
                value: inv.capacity.medium,
                calculation: `2/3 of ${inv.capacity.heavy} lbs.`
            },
            heavy: {
                label: "THIRDERA.Inventory.Heavy",
                value: inv.capacity.heavy,
                calculation: `Base ${meta.baseMaxLoad} lbs. (Str ${str}) × ${meta.sizeMod} (${sizeLabel})`
            }
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
            dexCap,
            speedInfo,
            inventory: inv,
            encumbrancePercent,
            encumbranceMarkers,
            encumbranceBreakdown: breakdown,
            hpStatus,
            classSummary,
            totalLevel,
            equippedWeapons,
            equippedArmor,
            levelHistory,
            skillPointBudget: systemData.skillPointBudget || { available: 0, spent: 0, remaining: 0 },
            grantedSkills: systemData.grantedSkills || [],
            grantedFeatures,
            grantedFeats,
            grantedClassFeatures,
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
        const classFeatures = [];
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
            else if (item.type === 'feature') classFeatures.push(itemData);
            else if (item.type === 'skill') skills.push(itemData);
            else if (item.type === 'race' && !race) race = itemData;
            else if (item.type === 'class') classes.push(itemData);
        }

        skills.sort((a, b) => a.name.localeCompare(b.name));
        classFeatures.sort((a, b) => a.name.localeCompare(b.name));
        feats.sort((a, b) => a.name.localeCompare(b.name));

        return { weapons, armor, equipment, spells, feats, classFeatures, skills, race, classes };
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

        // If a skill is dropped onto the granted-skills zone, add to grantedSkills instead of embedding
        if (item.type === "skill") {
            const dropTarget = event.target.closest("[data-drop-zone='granted-skills']");
            if (dropTarget) {
                const skillKey = item.system?.key;
                if (!skillKey) {
                    ui.notifications.warn(`${item.name} has no skill key set — set one on the skill's Details tab first.`);
                    return false;
                }
                const current = [...(this.actor.system.grantedSkills || [])];
                if (current.some(e => e.key === skillKey)) {
                    ui.notifications.info(`${item.name} is already a GM-granted skill for ${this.actor.name}.`);
                    return false;
                }
                current.push({ key: skillKey, name: item.name });
                current.sort((a, b) => a.name.localeCompare(b.name));
                await this.actor.update({ "system.grantedSkills": current });
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

        // When a new class is dropped, add first level to levelHistory and auto-populate skills
        if (item.type === "class" && result) {
            const created = Array.isArray(result) ? result[0] : result;
            if (created?.id) {
                const history = [...(this.actor.system.levelHistory || [])];
                history.push({ classItemId: created.id, hpRolled: 0 });
                await this.actor.update({ "system.levelHistory": history });

                // Auto-populate class skills that the actor doesn't already have
                const classSkills = created.system?.classSkills || [];
                const existingSkillKeys = new Set();
                for (const actorItem of this.actor.items) {
                    if (actorItem.type === "skill" && actorItem.system.key) {
                        existingSkillKeys.add(actorItem.system.key);
                    }
                }
                const toCreate = [];
                for (const entry of classSkills) {
                    if (existingSkillKeys.has(entry.key)) continue;
                    const sourceSkill = game.items.find(i => i.type === "skill" && i.system.key === entry.key);
                    if (sourceSkill) {
                        toCreate.push(sourceSkill.toObject());
                    }
                }
                if (toCreate.length) {
                    await this.actor.createEmbeddedDocuments("Item", toCreate);
                }
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
        const confirm = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Delete Actor" },
            content: `<h4>Are you sure you want to delete ${this.actor.name}?</h4>`,
            rejectClose: false,
            modal: true
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

        // Equipment items: simple toggle, no slot/size logic
        if (item.type === "equipment") {
            return await item.update({ "system.equipped": equipping ? "true" : "false" });
        }

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

        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: `Remove ${cls.name} Level` },
            content: `<p>Remove one level of ${cls.name} from ${this.actor.name}? (${classLevels} → ${classLevels - 1})</p>`,
            rejectClose: false,
            modal: true
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
     * Handle adding an HP adjustment entry
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onAddHpAdjustment(event, target) {
        const adjustments = [...(this.actor.system.attributes.hp.adjustments || [])];
        adjustments.push({ value: 0, label: "Misc" });
        await this.actor.update({ "system.attributes.hp.adjustments": adjustments });
    }

    /**
     * Handle removing an HP adjustment entry
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onRemoveHpAdjustment(event, target) {
        const index = parseInt(target.dataset.adjIndex);
        const adjustments = [...(this.actor.system.attributes.hp.adjustments || [])];
        if (index >= 0 && index < adjustments.length) {
            adjustments.splice(index, 1);
            await this.actor.update({ "system.attributes.hp.adjustments": adjustments });
        }
    }

    /**
     * Handle rolling a hit die for a level history entry (only when hpRolled is 0)
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onRollHitDie(event, target) {
        const hitDie = target.dataset.hitDie;
        const index = parseInt(target.dataset.levelIndex);
        if (!hitDie || isNaN(index)) return;

        const history = foundry.utils.deepClone(this.actor.system.levelHistory);
        if (!history[index] || history[index].hpRolled !== 0) return;

        const roll = await new Roll(`1${hitDie}`).evaluate();
        await roll.toMessage({
            speaker: ChatMessage.implementation.getSpeaker({ actor: this.actor }),
            flavor: `${this.actor.name} rolls HP for level ${index + 1}`
        });

        history[index].hpRolled = roll.total;
        await this.actor.update({ "system.levelHistory": history });
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

        // Show the corresponding tab/subtab content
        const body = this.element.querySelector('.sheet-body');
        body.querySelectorAll(`.tab[data-group="${group}"], .subtab[data-group="${group}"]`).forEach(t => t.classList.remove('active'));
        (body.querySelector(`.tab[data-group="${group}"][data-tab="${tab}"]`) ||
            body.querySelector(`.subtab[data-group="${group}"][data-tab="${tab}"]`))?.classList.add('active');
    }

    /**
     * Handle removing a GM-granted skill
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onRemoveGrantedSkill(event, target) {
        const skillKey = target.dataset.skillKey;
        if (!skillKey) return;
        const current = (this.actor.system.grantedSkills || []).filter(e => e.key !== skillKey);
        await this.actor.update({ "system.grantedSkills": current });
    }
}
