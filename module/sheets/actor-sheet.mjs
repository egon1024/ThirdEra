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
            configureOwnership: ThirdEraActorSheet.#onConfigureOwnership,
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
            rollHitDie: ThirdEraActorSheet.#onRollHitDie,
            removeFromContainer: ThirdEraActorSheet.#onRemoveFromContainer
        },
        window: {
            controls: [
                {
                    icon: "fa-solid fa-lock",
                    label: "OWNERSHIP.Configure",
                    action: "configureOwnership",
                    ownership: "OWNER"
                },
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
        new foundry.applications.ux.ContextMenu.implementation(this.element, ".race-name[data-action='openRace']", [
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

        // Handle container toggle clicks
        this.element.querySelectorAll(".container-toggle").forEach(toggle => {
            toggle.addEventListener("click", async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const containerId = event.currentTarget.dataset.containerId;
                const contents = this.element.querySelector(`.container-contents[data-container-id="${containerId}"]`);
                const toggleIcon = event.currentTarget;
                
                // Get current expanded containers
                const expandedContainers = this.actor.getFlag("thirdera", "expandedContainers") || [];
                const isExpanded = expandedContainers.includes(containerId);
                
                if (isExpanded) {
                    // Collapse
                    contents.style.display = "none";
                    toggleIcon.classList.remove("fa-chevron-down");
                    toggleIcon.classList.add("fa-chevron-right");
                    // Remove from expanded list
                    const updated = expandedContainers.filter(id => id !== containerId);
                    await this.actor.setFlag("thirdera", "expandedContainers", updated);
                } else {
                    // Expand
                    contents.style.display = "block";
                    toggleIcon.classList.remove("fa-chevron-right");
                    toggleIcon.classList.add("fa-chevron-down");
                    // Add to expanded list
                    if (!expandedContainers.includes(containerId)) {
                        expandedContainers.push(containerId);
                        await this.actor.setFlag("thirdera", "expandedContainers", expandedContainers);
                    }
                }
            });
        });
        
        // Restore container expand/collapse state
        const expandedContainers = this.actor.getFlag("thirdera", "expandedContainers") || [];
        expandedContainers.forEach(containerId => {
            const contents = this.element.querySelector(`.container-contents[data-container-id="${containerId}"]`);
            const toggleIcon = this.element.querySelector(`.container-toggle[data-container-id="${containerId}"]`);
            if (contents && toggleIcon) {
                contents.style.display = "block";
                toggleIcon.classList.remove("fa-chevron-right");
                toggleIcon.classList.add("fa-chevron-down");
            }
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

        // Separate containers and items in containers
        const containers = [];
        const itemsByContainer = new Map(); // containerId -> array of items
        const itemsNotInContainers = {
            weapons: [],
            armor: [],
            equipment: []
        };

        for (const item of items) {
            const itemData = item;
            
            // Check if item is a container
            if (item.type === 'equipment' && item.system?.isContainer) {
                containers.push(itemData);
                // Only initialize if it doesn't exist - don't overwrite if items were already added
                if (!itemsByContainer.has(item.id)) {
                    itemsByContainer.set(item.id, []);
                }
                continue;
            }
            
            // Check if item is in a container (check for both empty string and truthy values)
            // Access system data directly - item.system should be the TypeDataModel instance
            const containerId = item.system?.containerId;
            
            // Check if item is in a container
            if (containerId && typeof containerId === 'string' && containerId.trim() !== "") {
                if (!itemsByContainer.has(containerId)) {
                    itemsByContainer.set(containerId, []);
                }
                const contentsArray = itemsByContainer.get(containerId);
                if (!Array.isArray(contentsArray)) {
                    itemsByContainer.set(containerId, [itemData]);
                } else {
                    contentsArray.push(itemData);
                }
                continue;
            }
            
            // Item is not in a container - add to appropriate list
            if (item.type === 'weapon') {
                weapons.push(itemData);
                itemsNotInContainers.weapons.push(itemData);
            } else if (item.type === 'armor') {
                armor.push(itemData);
                itemsNotInContainers.armor.push(itemData);
            } else if (item.type === 'equipment') {
                equipment.push(itemData);
                itemsNotInContainers.equipment.push(itemData);
            } else if (item.type === 'spell') spells.push(itemData);
            else if (item.type === 'feat') feats.push(itemData);
            else if (item.type === 'feature') classFeatures.push(itemData);
            else if (item.type === 'skill') skills.push(itemData);
            else if (item.type === 'race' && !race) race = itemData;
            else if (item.type === 'class') classes.push(itemData);
        }

        // Calculate container contents weight and capacity info
        for (const container of containers) {
            const contents = itemsByContainer.get(container.id) || [];
            
            let contentsWeight = 0;
            for (const item of contents) {
                const weight = item.system.weight || 0;
                const quantity = item.system.quantity || 1;
                contentsWeight += weight * quantity;
            }
            container.contentsWeight = contentsWeight;
            container.contents = contents;
            container.capacityPercent = container.system.containerCapacity > 0 
                ? Math.min((contentsWeight / container.system.containerCapacity) * 100, 100)
                : 0;
            
            // Calculate effective weight (what counts toward encumbrance)
            const containerWeight = (container.system.weight || 0) * (container.system.quantity || 1);
            const weightMode = container.system.weightMode || "full";
            
            let effectiveWeight = containerWeight; // Container's own weight always counts
            if (weightMode === "full") {
                effectiveWeight += contentsWeight; // Full weight: add all contents
            } else if (weightMode === "fixed") {
                // Fixed weight: contents don't add weight (only container weight counts)
                effectiveWeight = containerWeight;
            } else if (weightMode === "reduced") {
                // Reduced weight: for now treat as full (future: apply reduction factor)
                effectiveWeight += contentsWeight;
            }
            
            container.effectiveWeight = effectiveWeight;
            container.containerWeight = containerWeight;
        }

        skills.sort((a, b) => a.name.localeCompare(b.name));
        classFeatures.sort((a, b) => a.name.localeCompare(b.name));
        feats.sort((a, b) => a.name.localeCompare(b.name));

        return { 
            weapons, 
            armor, 
            equipment, 
            spells, 
            feats, 
            classFeatures, 
            skills, 
            race, 
            classes,
            containers,
            itemsNotInContainers
        };
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

        // Get the actual item document if we have an ID (for items already in the actor)
        let actualItem = item;
        if (item.id && this.actor.items.has(item.id)) {
            actualItem = this.actor.items.get(item.id);
        }
        
        // Check if the item being dropped is currently in a container
        const currentContainerId = actualItem?.system?.containerId;
        
        // Handle dropping items into containers
        // Check both the container item itself and the container contents area
        const containerTarget = event.target.closest("[data-container-id]");
        if (containerTarget) {
            const containerId = containerTarget.dataset.containerId;
            // Make sure we're not trying to drop the container on itself
            if (item.id && item.id === containerId && this.actor.items.has(item.id)) {
                // This is the container being dropped on itself, skip
            } else {
                return await this._handleContainerDrop(item, containerId, event);
            }
        } else if (currentContainerId) {
            // Item is in a container but being dropped outside of any container
            // Remove it from the container (drop it into main inventory)
            await actualItem.update({ "system.containerId": "" });
            
            // Re-render to show the updated item organization
            await this.actor.prepareData();
            await this.render();
            
            // Restore container expand/collapse state
            const expandedContainers = this.actor.getFlag("thirdera", "expandedContainers") || [];
            requestAnimationFrame(() => {
                expandedContainers.forEach(cid => {
                    const contents = this.element.querySelector(`.container-contents[data-container-id="${cid}"]`);
                    const toggle = this.element.querySelector(`.container-toggle[data-container-id="${cid}"]`);
                    if (contents && toggle) {
                        contents.style.display = "block";
                        toggle.classList.remove("fa-chevron-right");
                        toggle.classList.add("fa-chevron-down");
                    }
                });
            });
            
            ui.notifications.info(`${actualItem.name} has been removed from container.`);
            return false;
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

    /**
     * Handle sorting/dropping embedded items within the same actor
     * Override to handle container drops
     * @override
     */
    async _onSortItem(event, item) {
        // Get the actual item document if we have an ID
        let actualItem = item;
        if (item.id && this.actor.items.has(item.id)) {
            actualItem = this.actor.items.get(item.id);
        }
        
        // Check if the item being dropped is currently in a container
        const currentContainerId = actualItem?.system?.containerId;
        
        // Check if dropping onto a container (either the container item or its contents area)
        let containerTarget = event.target.closest("[data-container-id]");
        
        // Also check if dropping on the container item itself (the header row)
        if (!containerTarget) {
            const containerItem = event.target.closest(".container-item[data-container-id]");
            if (containerItem) {
                containerTarget = containerItem;
            }
        }
        
        if (containerTarget) {
            const containerId = containerTarget.dataset.containerId;
            // Don't handle if it's the container itself being sorted
            if (item.id !== containerId) {
                const result = await this._handleContainerDrop(item, containerId, event);
                if (result === false) {
                    // Handled by container drop, don't continue with sort
                    return;
                }
            }
        } else if (currentContainerId) {
            // Item is in a container but being dropped outside of any container
            // Remove it from the container (drop it into main inventory)
            await actualItem.update({ "system.containerId": "" });
            
            // Re-render to show the updated item organization
            await this.actor.prepareData();
            await this.render();
            
            // Restore container expand/collapse state
            const expandedContainers = this.actor.getFlag("thirdera", "expandedContainers") || [];
            requestAnimationFrame(() => {
                expandedContainers.forEach(cid => {
                    const contents = this.element.querySelector(`.container-contents[data-container-id="${cid}"]`);
                    const toggle = this.element.querySelector(`.container-toggle[data-container-id="${cid}"]`);
                    if (contents && toggle) {
                        contents.style.display = "block";
                        toggle.classList.remove("fa-chevron-right");
                        toggle.classList.add("fa-chevron-down");
                    }
                });
            });
            
            ui.notifications.info(`${actualItem.name} has been removed from container.`);
            return;
        }
        
        // Continue with normal sort behavior
        return super._onSortItem(event, item);
    }

    /**
     * Handle dropping an item into a container
     * @param {Item|Object} item        The item being dropped (may be existing or new)
     * @param {string} containerId      The ID of the container
     * @param {DragEvent} event         The drop event
     * @returns {Promise<boolean>}      False if handled, true/Item if should continue with normal drop
     */
    async _handleContainerDrop(item, containerId, event) {
        const container = this.actor.items.get(containerId);
        if (!container || container.type !== "equipment" || !container.system.isContainer) {
            return true; // Not a valid container, continue with normal drop
        }

        // Get the actual item - it might be an embedded item or a world item
        let actualItem = item;
        if (item.id && this.actor.items.has(item.id)) {
            actualItem = this.actor.items.get(item.id);
        } else if (typeof item === 'string' || (item.uuid && !item.id)) {
            // It's a UUID or world item - we'll handle it below
            actualItem = item;
        }
        

        // Prevent dropping container into itself
        if (actualItem.id === containerId) {
            ui.notifications.warn("Cannot place a container inside itself.");
            return false;
        }

        // Check for circular references - prevent putting container into its own contents
        const isExistingItem = actualItem?.id && this.actor.items.has(actualItem.id);
        
        // Only weapons, armor, and equipment can go into containers
        if (isExistingItem && !['weapon', 'armor', 'equipment'].includes(actualItem.type)) {
            ui.notifications.warn(`Only weapons, armor, and equipment can be stored in containers. ${actualItem.name} is a ${actualItem.type}.`);
            return false;
        }
        if (isExistingItem) {
            const existingItem = this.actor.items.get(item.id);
            // Check if the item being dropped is a container that contains the target container
            if (existingItem.type === "equipment" && existingItem.system.isContainer) {
                const wouldCreateCycle = this._wouldCreateContainerCycle(existingItem.id, containerId);
                if (wouldCreateCycle) {
                    ui.notifications.warn("Cannot place container here — this would create a circular reference.");
                    return false;
                }
            }
        }

        // Calculate current container contents weight
        const contentsWeight = this._getContainerContentsWeight(containerId);
        const itemWeight = (actualItem.system?.weight || 0) * (actualItem.system?.quantity || 1);
        const newTotalWeight = contentsWeight + itemWeight;

        // Check capacity
        if (newTotalWeight > container.system.containerCapacity && container.system.containerCapacity > 0) {
            ui.notifications.warn(`Cannot add ${actualItem.name} to ${container.name} — would exceed capacity (${container.system.containerCapacity} lbs).`);
            return false;
        }

        // If item is equipped, unequip it with warning
        let wasEquipped = false;
        let equipValue = null;
        if (isExistingItem) {
            if (actualItem.type === "weapon" && actualItem.system.equipped !== "none") {
                wasEquipped = true;
                equipValue = actualItem.system.equipped;
            } else if ((actualItem.type === "armor" || actualItem.type === "equipment") && actualItem.system.equipped === "true") {
                wasEquipped = true;
                equipValue = actualItem.system.equipped;
            }
        }

        // Handle new item from sidebar vs existing item
        if (isExistingItem) {
            // Existing item - update containerId and unequip if needed
            const updates = { "system.containerId": containerId };
            if (wasEquipped) {
                if (actualItem.type === "weapon") {
                    updates["system.equipped"] = "none";
                } else {
                    updates["system.equipped"] = "false";
                }
            }
            
            try {
                await actualItem.update(updates);
                
                // Wait a moment for the update to propagate
                await new Promise(resolve => setTimeout(resolve, 50));
                
                // Verify the update by checking the item's system data
                const verifyItem = this.actor.items.get(actualItem.id);
                if (!verifyItem || verifyItem.system.containerId !== containerId) {
                    ui.notifications.error(`Failed to move ${actualItem.name} into ${container.name}.`);
                    return false;
                }
            } catch (error) {
                ui.notifications.error(`Failed to move ${actualItem.name} into ${container.name}: ${error.message}`);
                return false;
            }
            
            // Force a full data refresh - this should update the items collection
            await this.actor.prepareData();
            
            // Re-render the actor sheet to show the updated item organization
            await this.render();
            
            // Restore container expand/collapse state after render
            const expandedContainers = this.actor.getFlag("thirdera", "expandedContainers") || [];
            requestAnimationFrame(() => {
                expandedContainers.forEach(cid => {
                    const contents = this.element.querySelector(`.container-contents[data-container-id="${cid}"]`);
                    const toggle = this.element.querySelector(`.container-toggle[data-container-id="${cid}"]`);
                    if (contents && toggle) {
                        contents.style.display = "block";
                        toggle.classList.remove("fa-chevron-right");
                        toggle.classList.add("fa-chevron-down");
                    }
                });
                
                // If the container wasn't expanded, expand it to show the newly added item
                if (!expandedContainers.includes(containerId)) {
                    const containerContents = this.element.querySelector(`.container-contents[data-container-id="${containerId}"]`);
                    const containerToggle = this.element.querySelector(`.container-toggle[data-container-id="${containerId}"]`);
                    if (containerContents && containerToggle) {
                        containerContents.style.display = "block";
                        containerToggle.classList.remove("fa-chevron-right");
                        containerToggle.classList.add("fa-chevron-down");
                        // Save the expanded state
                        expandedContainers.push(containerId);
                        this.actor.setFlag("thirdera", "expandedContainers", expandedContainers);
                    }
                }
            });
            
            if (wasEquipped) {
                ui.notifications.warn(`${actualItem.name} has been unequipped and placed in ${container.name}.`);
            } else {
                ui.notifications.info(`${actualItem.name} has been placed in ${container.name}.`);
            }
        } else {
            // New item from sidebar - create with containerId set
            const itemData = actualItem.toObject ? actualItem.toObject() : actualItem;
            itemData.system = itemData.system || {};
            itemData.system.containerId = containerId;
            if (wasEquipped && equipValue) {
                // Shouldn't happen for new items, but handle it
                if (itemData.type === "weapon") {
                    itemData.system.equipped = "none";
                } else {
                    itemData.system.equipped = "false";
                }
            }
            const createdItems = await this.actor.createEmbeddedDocuments("Item", [itemData]);
            
            // Ensure the new items are processed
            await this.actor.prepareData();
            
            // Re-render the actor sheet to show the new item in the container
            await this.render();
            
            // Restore container expand/collapse state after render
            const expandedContainers = this.actor.getFlag("thirdera", "expandedContainers") || [];
            requestAnimationFrame(() => {
                expandedContainers.forEach(cid => {
                    const contents = this.element.querySelector(`.container-contents[data-container-id="${cid}"]`);
                    const toggle = this.element.querySelector(`.container-toggle[data-container-id="${cid}"]`);
                    if (contents && toggle) {
                        contents.style.display = "block";
                        toggle.classList.remove("fa-chevron-right");
                        toggle.classList.add("fa-chevron-down");
                    }
                });
                
                // If the container wasn't expanded, expand it to show the newly added item
                if (!expandedContainers.includes(containerId)) {
                    const containerContents = this.element.querySelector(`.container-contents[data-container-id="${containerId}"]`);
                    const containerToggle = this.element.querySelector(`.container-toggle[data-container-id="${containerId}"]`);
                    if (containerContents && containerToggle) {
                        containerContents.style.display = "block";
                        containerToggle.classList.remove("fa-chevron-right");
                        containerToggle.classList.add("fa-chevron-down");
                        // Save the expanded state
                        expandedContainers.push(containerId);
                        this.actor.setFlag("thirdera", "expandedContainers", expandedContainers);
                    }
                }
            });
            
            ui.notifications.info(`${actualItem.name} has been created in ${container.name}.`);
        }

        return false; // Handled, don't continue with normal drop
    }

    /**
     * Check if placing itemId into containerId would create a circular reference
     * @param {string} itemId          The item being moved (a container)
     * @param {string} containerId     The target container
     * @returns {boolean}               True if cycle would be created
     */
    _wouldCreateContainerCycle(itemId, containerId) {
        // Check if containerId is inside itemId (or any of itemId's contents)
        const checkContainer = (checkId, targetId) => {
            if (checkId === targetId) return true;
            const container = this.actor.items.get(checkId);
            if (!container || container.type !== "equipment" || !container.system.isContainer) return false;
            
            // Check all items in this container
            for (const item of this.actor.items) {
                if (item.system.containerId === checkId) {
                    if (item.id === targetId) return true;
                    if (item.type === "equipment" && item.system.isContainer) {
                        if (checkContainer(item.id, targetId)) return true;
                    }
                }
            }
            return false;
        };

        return checkContainer(itemId, containerId);
    }

    /**
     * Calculate the total weight of all items in a container
     * @param {string} containerId      The container's item ID
     * @returns {number}                Total weight in lbs
     */
    _getContainerContentsWeight(containerId) {
        let total = 0;
        for (const item of this.actor.items) {
            if (item.system.containerId === containerId) {
                const weight = item.system.weight || 0;
                const quantity = item.system.quantity || 1;
                total += weight * quantity;
            }
        }
        return total;
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
     * Handle configuring ownership/permissions for the actor
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onConfigureOwnership(event, target) {
        event.preventDefault();
        console.log("Third Era | Configure ownership clicked", {document: this.document, apps: foundry.applications?.apps});
        try {
            // Try multiple ways to access DocumentOwnershipConfig
            let DocumentOwnershipConfig = foundry.applications?.apps?.DocumentOwnershipConfig;
            if (!DocumentOwnershipConfig && foundry.applications?.apps) {
                // Try accessing via the apps object directly
                const apps = foundry.applications.apps;
                DocumentOwnershipConfig = apps.DocumentOwnershipConfig;
            }
            
            if (!DocumentOwnershipConfig) {
                console.error("Third Era | DocumentOwnershipConfig not found. Available apps:", Object.keys(foundry.applications?.apps || {}));
                ui.notifications.error("Unable to open ownership configuration. Please check the console for details.");
                return;
            }
            
            console.log("Third Era | Opening ownership config for:", this.document.name);
            const app = new DocumentOwnershipConfig({
                document: this.document
            });
            return await app.render({force: true});
        } catch (error) {
            console.error("Third Era | Error opening ownership configuration:", error);
            ui.notifications.error(`Failed to open ownership configuration: ${error.message}`);
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

        // Cannot equip items that are in a container
        if (item.system.containerId) {
            ui.notifications.warn(`Cannot equip ${item.name} — it is stored in a container. Remove it from the container first.`);
            return;
        }

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

        // Cannot equip items that are in a container
        if (item.system.containerId) {
            ui.notifications.warn(`Cannot equip ${item.name} — it is stored in a container. Remove it from the container first.`);
            return;
        }

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
     * Handle removing an item from a container
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onRemoveFromContainer(event, target) {
        const itemId = target.closest("[data-item-id]")?.dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (!item || !item.system.containerId) return;

        // Remember which container was expanded
        const containerId = item.system.containerId;
        const expandedContainers = this.actor.getFlag("thirdera", "expandedContainers") || [];
        const wasExpanded = expandedContainers.includes(containerId);

        await item.update({ "system.containerId": "" });
        
        // Re-render to show the updated item organization
        await this.actor.prepareData();
        await this.render();
        
        // Restore the container's expanded state if it was expanded
        if (wasExpanded) {
            requestAnimationFrame(() => {
                const contents = this.element.querySelector(`.container-contents[data-container-id="${containerId}"]`);
                const toggleIcon = this.element.querySelector(`.container-toggle[data-container-id="${containerId}"]`);
                if (contents && toggleIcon) {
                    contents.style.display = "block";
                    toggleIcon.classList.remove("fa-chevron-right");
                    toggleIcon.classList.add("fa-chevron-down");
                }
            });
        }
        
        ui.notifications.info(`${item.name} has been removed from container.`);
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
