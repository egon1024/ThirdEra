import { getWieldingInfo } from "../data/_damage-helpers.mjs";
import { ClassData } from "../data/item-class.mjs";
import { SpellData } from "../data/item-spell.mjs";
import { addDomainSpellsToActor, getSpellsForDomain } from "../logic/domain-spells.mjs";
import { normalizeQuery, spellMatches, SPELL_SEARCH_HIDDEN_CLASS } from "../logic/spell-search.mjs";

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
            removeFromContainer: ThirdEraActorSheet.#onRemoveFromContainer,
            incrementPrepared: ThirdEraActorSheet.#onIncrementPrepared,
            decrementPrepared: ThirdEraActorSheet.#onDecrementPrepared,
            incrementCast: ThirdEraActorSheet.#onIncrementCast,
            decrementCast: ThirdEraActorSheet.#onDecrementCast,
            removeDomain: ThirdEraActorSheet.#onRemoveDomain,
            addPlaceholderSpell: ThirdEraActorSheet.#onAddPlaceholderSpell,
            addToShortlist: ThirdEraActorSheet.#onAddToShortlist,
            removeFromShortlist: ThirdEraActorSheet.#onRemoveFromShortlist,
            toggleShortlist: ThirdEraActorSheet.#onToggleShortlist
        },
        window: {
            resizable: true,
            minimizable: true,
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

        // Known spells tab: filter by search (shared logic with Spell List Browser)
        const knownPanel = this.element?.querySelector?.(".spells-known");
        const spellSearchInput = knownPanel?.querySelector?.('input[name="spellKnownSearch"]');
        if (spellSearchInput && knownPanel) {
            const noResultsEl = knownPanel.querySelector(".spell-search-no-results");
            spellSearchInput.addEventListener("input", () => {
                const query = normalizeQuery(spellSearchInput.value ?? "");
                const spellItems = knownPanel.querySelectorAll(".spell-item[data-spell-name]");
                let visibleCount = 0;
                for (const el of spellItems) {
                    const name = el.dataset.spellName ?? "";
                    const show = !query || spellMatches(name, query);
                    el.classList.toggle(SPELL_SEARCH_HIDDEN_CLASS, !show);
                    if (show) visibleCount++;
                }
                for (const group of knownPanel.querySelectorAll(".spell-level-group")) {
                    const anyVisible = group.querySelector(`.spell-item:not(.${SPELL_SEARCH_HIDDEN_CLASS})`);
                    group.classList.toggle(SPELL_SEARCH_HIDDEN_CLASS, !anyVisible);
                }
                for (const group of knownPanel.querySelectorAll(".domain-spells-group")) {
                    const anyVisible = group.querySelector(`.spell-item:not(.${SPELL_SEARCH_HIDDEN_CLASS})`);
                    group.classList.toggle(SPELL_SEARCH_HIDDEN_CLASS, !anyVisible);
                }
                for (const spellcastingClass of knownPanel.querySelectorAll(".spellcasting-class")) {
                    const levelOrDomainGroups = spellcastingClass.querySelectorAll(".spell-level-group, .domain-spells-group");
                    const anyGroupVisible = levelOrDomainGroups.length === 0 || [...levelOrDomainGroups].some((g) => !g.classList.contains(SPELL_SEARCH_HIDDEN_CLASS));
                    spellcastingClass.classList.toggle(SPELL_SEARCH_HIDDEN_CLASS, !anyGroupVisible);
                }
                if (noResultsEl) {
                    noResultsEl.classList.toggle(SPELL_SEARCH_HIDDEN_CLASS, !(query && visibleCount === 0));
                }
            });
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
        if (!this.tabGroups.abilities) this.tabGroups.abilities = "scores";
        if (!this.tabGroups.spells) this.tabGroups.spells = "known";
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

        // Organize spells by class and spell level
        const spellcastingByClass = systemData.spellcastingByClass || [];
        const spellsByClass = new Map();
        
        // Initialize spell organization for each spellcasting class
        // Use string keys (e.g. "0", "1") so Handlebars {{#each}} and {{lookup}} resolve consistently
        for (const sc of spellcastingByClass) {
            const spellsByLevel = {};
            const preparedByLevel = {};
            const domainSpellsByLevel = {};
            for (let level = 0; level <= 9; level++) {
                const k = String(level);
                spellsByLevel[k] = [];
                preparedByLevel[k] = 0;
                domainSpellsByLevel[k] = [];
            }
            spellsByClass.set(sc.classItemId, {
                ...sc,
                spellsByLevel,
                preparedByLevel,
                domainSpellsByLevel,
                totalPrepared: 0,
                totalCast: 0
            });
        }
        
        // Build a map of spell names to domain info for quick lookup
        // This helps identify which spells are domain spells
        const domainSpellMap = new Map(); // spellName (lowercase) -> {classItemId, domainName, domainKey, spellLevel}
        for (const sc of spellcastingByClass) {
            if (sc.domainSpellsByLevel) {
                for (let level = 1; level <= 9; level++) {
                    const domainSpells = sc.domainSpellsByLevel[level] || [];
                    for (const ds of domainSpells) {
                        const key = ds.spellName.toLowerCase().trim();
                        domainSpellMap.set(key, {
                            classItemId: sc.classItemId,
                            domainName: ds.domainName,
                            domainKey: ds.domainKey,
                            spellLevel: level
                        });
                    }
                }
            }
        }
        
        // Assign spells to their classes and levels
        // Domain spells are identified by matching spell names to domain spell lists
        for (const spell of items.spells) {
            const spellNameKey = spell.name.toLowerCase().trim();
            const fallbackSpellLevel = spell.system.level ?? 0;

            // Check if this is a domain spell (use per-class level for matching)
            const domainInfo = domainSpellMap.get(spellNameKey);
            let assigned = false;
            if (domainInfo) {
                const sc = spellcastingByClass.find(s => s.classItemId === domainInfo.classItemId);
                const spellLevelForClass = sc ? SpellData.getLevelForClass(spell.system, sc.spellListKey) : fallbackSpellLevel;
                if (spellLevelForClass === domainInfo.spellLevel) {
                    const classSpells = spellsByClass.get(domainInfo.classItemId);
                    const levelKey = String(domainInfo.spellLevel);
                    const slotsAtLevel = sc?.spellsPerDay?.[domainInfo.spellLevel] ?? sc?.spellsPerDay?.[levelKey] ?? 0;
                    if (classSpells && slotsAtLevel > 0) {
                        const spellWithDomain = { ...spell, domainName: domainInfo.domainName, domainKey: domainInfo.domainKey };
                        // Add to domain section (always-prepared slot)
                        classSpells.domainSpellsByLevel[levelKey].push(spellWithDomain);
                        // Also add to main list (spellsByLevel) so it appears under "1st Level" etc.; include domain info so template can show domain label
                        classSpells.spellsByLevel[levelKey].push(spellWithDomain);
                        const prepared = spell.system.prepared || 0;
                        classSpells.preparedByLevel[levelKey] += prepared;
                        classSpells.totalPrepared += prepared;
                        classSpells.totalCast += spell.system.cast || 0;
                        assigned = true;
                    }
                }
            }

            // If not yet assigned, regular spell - assign only to a spellcasting class that explicitly has this spell on its list (levelsByClass)
            if (!assigned) {
                for (const sc of spellcastingByClass) {
                    if (!SpellData.hasLevelForClass(spell.system, sc.spellListKey)) continue;
                    const spellLevel = SpellData.getLevelForClass(spell.system, sc.spellListKey);
                    const levelKey = String(spellLevel);
                    const slots = sc.spellsPerDay?.[spellLevel] ?? sc.spellsPerDay?.[levelKey] ?? 0;
                    if (slots > 0) {
                        const classSpells = spellsByClass.get(sc.classItemId);
                        if (classSpells) {
                            classSpells.spellsByLevel[levelKey].push(spell);
                            const prepared = spell.system.prepared || 0;
                            classSpells.preparedByLevel[levelKey] += prepared;
                            classSpells.totalPrepared += prepared;
                            classSpells.totalCast += spell.system.cast || 0;
                            assigned = true;
                            break;
                        }
                    }
                }
            }

            // Spells that don't match any class (no domain, not on any class list) are not shown in the Spells tab.
            // They remain on the actor but are omitted from Known/Ready so we don't show an "Unassigned" section.
        }
        
        // Populate domain spells from original definitions (even if spell items don't exist yet)
        // This ensures domain spell rows appear in the UI even when spells haven't been added to the actor.
        // Fallback: if derived data has no domain spell defs (e.g. prepared on server where game.packs isn't available),
        // resolve them client-side via getSpellsForDomain so the sheet still shows domain spells.
        for (const sc of spellcastingByClass) {
            const classSpells = spellsByClass.get(sc.classItemId);
            if (!classSpells) continue;
            for (let level = 1; level <= 9; level++) {
                const levelKey = String(level);
                let domainSpellDefs = sc.domainSpellsByLevel?.[level] || sc.domainSpellsByLevel?.[levelKey] || [];
                if (domainSpellDefs.length === 0 && sc.domains?.length > 0 && typeof getSpellsForDomain === "function") {
                    domainSpellDefs = [];
                    for (const dom of sc.domains) {
                        const domainKey = (dom.domainKey || "").trim();
                        if (!domainKey) continue;
                        const granted = getSpellsForDomain(domainKey);
                        for (const entry of granted) {
                            if (entry.level === level && entry.spellName) {
                                domainSpellDefs.push({
                                    spellName: entry.spellName,
                                    domainName: (dom.domainName || "").trim() || domainKey,
                                    domainKey
                                });
                            }
                        }
                    }
                }
                // For each domain spell definition, check if we already have a matching spell item
                    // If not, create a placeholder entry so the row appears in the UI
                    for (const domainSpellDef of domainSpellDefs) {
                        // Skip empty spell names
                        if (!domainSpellDef.spellName || domainSpellDef.spellName.trim() === "") {
                            continue;
                        }
                        // Check if we already have this spell item in domainSpellsByLevel
                        const spellNameKey = domainSpellDef.spellName.toLowerCase().trim();
                        const existingSpell = classSpells.domainSpellsByLevel[levelKey].find(
                            spell => spell.name && spell.name.toLowerCase().trim() === spellNameKey
                        );
                        // If no matching spell item exists, create a placeholder entry
                        if (!existingSpell) {
                            const placeholderEntry = {
                                name: domainSpellDef.spellName,
                                domainName: domainSpellDef.domainName,
                                domainKey: domainSpellDef.domainKey,
                                classItemId: sc.classItemId,
                                system: {
                                    level: level,
                                    prepared: 0,
                                    cast: 0
                                },
                                _isPlaceholder: true // Flag to indicate this is a placeholder, not a real spell item
                            };
                            classSpells.domainSpellsByLevel[levelKey].push(placeholderEntry);
                            // Also show in main list (1st Level, 2nd Level, etc.) so it appears as "available to prepare"
                            const alreadyInMain = classSpells.spellsByLevel[levelKey]?.some(
                                s => s.name && s.name.toLowerCase().trim() === spellNameKey
                            );
                            if (!alreadyInMain) {
                                classSpells.spellsByLevel[levelKey].push(placeholderEntry);
                            }
                        }
                    }
                }
        }

        // Spell tracking: castByLevel, remainingByLevel, spellsKnownCurrent, spellsKnownMax, spellsKnownOverLimit per class
        for (const [classItemId, classSpells] of spellsByClass) {
            if (!classSpells.hasSpellcasting) continue;
            const castByLevel = {};
            const remainingByLevel = {};
            const spellsKnownCurrent = {};
            const spellsKnownMax = {};
            const spellsKnownOverLimit = {};
            for (let level = 0; level <= 9; level++) {
                const levelKey = String(level);
                const spells = classSpells.spellsByLevel[levelKey] || classSpells.spellsByLevel[level] || [];
                const castSum = spells.reduce((sum, s) => sum + (s.system?.cast ?? 0), 0);
                castByLevel[levelKey] = castSum;
                const slots = classSpells.spellsPerDay?.[level] ?? classSpells.spellsPerDay?.[levelKey] ?? 0;
                remainingByLevel[levelKey] = Math.max(0, slots - castSum);
                spellsKnownCurrent[levelKey] = spells.length;
                if (classSpells.preparationType === "spontaneous") {
                    const classItem = actor.items.get(classItemId);
                    const table = classItem?.system?.spellcasting?.spellsKnownTable;
                    const max = table && Array.isArray(table) && table.length > 0
                        ? ClassData.getSpellsKnown(table, classSpells.casterLevel, level)
                        : 0;
                    spellsKnownMax[levelKey] = max > 0 ? max : null;
                } else {
                    spellsKnownMax[levelKey] = null;
                }
                spellsKnownOverLimit[levelKey] = spellsKnownMax[levelKey] != null
                    && spellsKnownCurrent[levelKey] > spellsKnownMax[levelKey];
            }
            classSpells.castByLevel = castByLevel;
            classSpells.remainingByLevel = remainingByLevel;
            classSpells.spellsKnownCurrent = spellsKnownCurrent;
            classSpells.spellsKnownMax = spellsKnownMax;
            classSpells.spellsKnownOverLimit = spellsKnownOverLimit;
        }

        // Sort all spell lists alphabetically by spell name
        const spellNameSort = (a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
        for (const classSpells of spellsByClass.values()) {
            if (!classSpells.hasSpellcasting) continue;
            for (const levelKey of Object.keys(classSpells.spellsByLevel || {})) {
                const arr = classSpells.spellsByLevel[levelKey];
                if (Array.isArray(arr)) arr.sort(spellNameSort);
            }
            for (const levelKey of Object.keys(classSpells.domainSpellsByLevel || {})) {
                const arr = classSpells.domainSpellsByLevel[levelKey];
                if (Array.isArray(arr)) arr.sort(spellNameSort);
            }
        }

        // For arcane casters only: build spellsByLevelBySchool (group by school within each level)
        for (const classSpells of spellsByClass.values()) {
            if (!classSpells.hasSpellcasting || (classSpells.casterType || "").toLowerCase() !== "arcane") continue;
            const byLevelBySchool = {};
            for (let level = 0; level <= 9; level++) {
                const levelKey = String(level);
                const spells = classSpells.spellsByLevel?.[levelKey] || [];
                const bySchool = new Map(); // schoolName -> spell[]
                for (const spell of spells) {
                    const schoolName = (spell.system?.schoolName || spell.system?.schoolKey || "").trim() || (game.i18n?.localize?.("THIRDERA.Spells.NoSchool") || "No school");
                    if (!bySchool.has(schoolName)) bySchool.set(schoolName, []);
                    bySchool.get(schoolName).push(spell);
                }
                const groups = [];
                for (const [schoolName, list] of bySchool) {
                    list.sort(spellNameSort);
                    groups.push({ schoolName, spells: list });
                }
                groups.sort((a, b) => (a.schoolName || "").localeCompare(b.schoolName || "", undefined, { sensitivity: "base" }));
                byLevelBySchool[levelKey] = groups;
            }
            classSpells.spellsByLevelBySchool = byLevelBySchool;
        }
        
        // Convert Map to array for template
        const organizedSpells = Array.from(spellsByClass.values());

        // Known panel: same data as organizedSpells (roster; no tracking in UI)
        const knownSpellsByClass = organizedSpells;
        const hasAnySpellcasting = organizedSpells.some((c) => c.hasSpellcasting);

        // Ready to cast: filter by shortlist (full-list prepared), prepared>0 (wizard), or same (spontaneous)
        const spellShortlistByClass = systemData.spellShortlistByClass || {};
        // Mark each spell in Known with inShortlist for full-list prepared casters (for toggle UI)
        for (const classData of knownSpellsByClass) {
            if (classData.spellListAccess !== "full" || classData.preparationType !== "prepared") continue;
            const shortlistIds = new Set(spellShortlistByClass[classData.classItemId] || []);
            for (const levelKey of Object.keys(classData.spellsByLevel || {})) {
                const spells = classData.spellsByLevel[levelKey] || [];
                for (const spell of spells) {
                    if (spell.id) spell.inShortlist = shortlistIds.has(spell.id);
                }
            }
            for (const levelKey of Object.keys(classData.domainSpellsByLevel || {})) {
                const spells = classData.domainSpellsByLevel[levelKey] || [];
                for (const spell of spells) {
                    if (spell.id) spell.inShortlist = shortlistIds.has(spell.id);
                }
            }
        }
        const readyToCastByClass = organizedSpells.map((classData) => {
            if (!classData.hasSpellcasting) return { ...classData, spellsByLevel: classData.spellsByLevel };
            const shortlistIds = new Set(spellShortlistByClass[classData.classItemId] || []);
            const isFullListPrepared = (classData.spellListAccess === "full" && classData.preparationType === "prepared");
            const isPreparedCaster = (classData.preparationType === "prepared");
            const spellsByLevel = {};
            for (let level = 0; level <= 9; level++) {
                const levelKey = String(level);
                const spells = classData.spellsByLevel[levelKey] || [];
                let ready;
                if (isFullListPrepared) {
                    ready = spells.filter((s) => !s._isPlaceholder && shortlistIds.has(s.id));
                } else if (isPreparedCaster) {
                    ready = spells.filter((s) => !s._isPlaceholder && (s.system?.prepared ?? 0) > 0);
                } else {
                    ready = spells.filter((s) => !s._isPlaceholder);
                }
                spellsByLevel[levelKey] = ready;
            }
            const result = { ...classData, spellsByLevel };
            if ((classData.casterType || "").toLowerCase() === "arcane") {
                const byLevelBySchool = {};
                for (let level = 0; level <= 9; level++) {
                    const levelKey = String(level);
                    const spells = spellsByLevel[levelKey] || [];
                    const bySchool = new Map();
                    for (const spell of spells) {
                        const schoolName = (spell.system?.schoolName || spell.system?.schoolKey || "").trim() || (game.i18n?.localize?.("THIRDERA.Spells.NoSchool") || "No school");
                        if (!bySchool.has(schoolName)) bySchool.set(schoolName, []);
                        bySchool.get(schoolName).push(spell);
                    }
                    const groups = [];
                    for (const [schoolName, list] of bySchool) {
                        list.sort(spellNameSort);
                        groups.push({ schoolName, spells: list });
                    }
                    groups.sort((a, b) => (a.schoolName || "").localeCompare(b.schoolName || "", undefined, { sensitivity: "base" }));
                    byLevelBySchool[levelKey] = groups;
                }
                result.spellsByLevelBySchool = byLevelBySchool;
            }
            return result;
        });

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

        // Enrich classes with domain info for the Classes tab (supportsDomains, domains from spellcastingByClass)
        const classesWithDomains = items.classes.map((cls) => {
            const sc = spellcastingByClass.find((s) => s.classItemId === cls.id);
            return {
                ...cls,
                id: cls.id,
                _id: cls._id ?? cls.id,
                supportsDomains: sc ? (sc.supportsDomains === true || sc.supportsDomains === "true") : false,
                domains: sc?.domains ?? []
            };
        });

        return {
            ...context,
            actor,
            system: systemData,
            items: actor.items,
            ...items,
            classes: classesWithDomains,
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
            spellcastingByClass,
            organizedSpells,
            knownSpellsByClass,
            readyToCastByClass,
            hasAnySpellcasting,
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
            
            // Determine capacity status for visual indicator
            if (container.system.containerCapacity > 0) {
                const capacityPercent = (contentsWeight / container.system.containerCapacity) * 100;
                if (capacityPercent >= 100) {
                    container.capacityStatus = "full";
                } else if (capacityPercent >= 80) {
                    container.capacityStatus = "warning";
                } else if (capacityPercent >= 50) {
                    container.capacityStatus = "moderate";
                } else {
                    container.capacityStatus = "ok";
                }
            } else {
                container.capacityStatus = "unlimited";
            }
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
        // Domain dropped on character: add to spellcasting class (character chooses domains)
        if (item.type === "domain") {
            const domainKey = item.system?.key?.trim();
            if (!domainKey) {
                ui.notifications.warn(`${item.name} has no domain key — save the domain item first.`);
                return false;
            }
            const spellcastingClasses = this.actor.items.filter(
                i => i.type === "class" && i.system?.spellcasting?.enabled
            );
            if (spellcastingClasses.length === 0) {
                ui.notifications.warn(`${this.actor.name} has no spellcasting class. Add a class (e.g. Cleric) with spellcasting enabled first.`);
                return false;
            }
            // If dropped on a domain drop zone, add to that specific class; otherwise first class that doesn't have it
            const dropZone = event.target?.closest?.("[data-drop-zone='domains']");
            const targetClassItemId = dropZone?.dataset?.classItemId;
            let targetClass = targetClassItemId
                ? spellcastingClasses.find(c => c.id === targetClassItemId)
                : null;
            if (!targetClass) {
                targetClass = spellcastingClasses.find(
                    c => !(c.system.spellcasting.domains || []).some(d => (d.domainKey || "").trim().toLowerCase() === domainKey.toLowerCase())
                ) || spellcastingClasses[0];
            }
            if ((targetClass.system.spellcasting.domains || []).some(d => (d.domainKey || "").trim().toLowerCase() === domainKey.toLowerCase())) {
                ui.notifications.info(`${item.name} is already assigned to ${targetClass.name}.`);
                return false;
            }
            const current = [...(targetClass.system.spellcasting.domains || [])];
            current.push({
                domainItemId: item.id || "",
                domainName: item.name || "",
                domainKey
            });
            current.sort((a, b) => (a.domainName || "").localeCompare(b.domainName || ""));
            await targetClass.update({ "system.spellcasting.domains": current });

            // Auto-add domain spells the character has achieved (levels they have domain slots for)
            const spellsAdded = await addDomainSpellsToActor(this.actor, targetClass, domainKey);

            // Refresh actor derived data and re-render so Domains section shows the new domain and spells
            await this.actor.prepareData();
            await this.render();
            const msg = spellsAdded > 0
                ? `${item.name} added to ${targetClass.name}; ${spellsAdded} domain spell(s) added to character.`
                : `${item.name} added to ${targetClass.name}.`;
            ui.notifications.info(msg);
            return false; // Handled; do not embed the domain item on the actor
        }

        if (item.type === "race") {
            const existing = this.actor.items.find(i => i.type === "race");
            if (existing) {
                await existing.delete();
            }
        }

        // If this class already exists on the actor, add a level instead of duplicating
        if (item.type === "class") {
            event.preventDefault?.();
            event.stopPropagation?.();
            const itemName = item.name;
            const existing = this.actor.items.find(i => i.type === "class" && i.name === itemName);
            if (existing) {
                const history = [...(this.actor.system.levelHistory || [])];
                
                // Check if this is the first level: levelHistory is empty OR all entries reference classes that no longer exist
                const existingClassIds = new Set(this.actor.items.filter(i => i.type === "class").map(c => c.id));
                const hasValidLevels = history.some(entry => existingClassIds.has(entry.classItemId));
                const isFirstLevel = history.length === 0 || !hasValidLevels;
                
                let hpRolled = 0;
                
                // If this is the first level and the setting is enabled, set HP to max
                if (isFirstLevel && game.settings.get("thirdera", "firstLevelFullHp")) {
                    const hitDie = existing.system.hitDie;
                    // Parse hit die (e.g., "d8" -> 8, "d10" -> 10)
                    const dieSize = parseInt(hitDie.substring(1));
                    if (!isNaN(dieSize)) {
                        hpRolled = dieSize; // Max value of the die
                    }
                }
                
                history.push({ classItemId: existing.id, hpRolled });
                await this.actor.update({ "system.levelHistory": history });

                // Only auto-add class spell list for full-list casters (e.g. cleric, druid). Never for learned casters (wizard, sorcerer, bard).
                const levelCountForClass = history.filter(e => e.classItemId === existing.id).length;
                const sc = existing.system?.spellcasting;
                const classScEnabled = sc?.enabled === true || sc?.enabled === "true";
                const isFullListCaster = sc?.spellListAccess === "full";
                if (levelCountForClass >= 1 && classScEnabled && isFullListCaster) {
                    const actorSpellCount = this.actor.items.filter(i => i.type === "spell").length;
                    if (actorSpellCount === 0) {
                        await this._addClassSpellListForFullListCaster(existing, levelCountForClass);
                    }
                }
                return false;
            }

            // New class: defer create to next tick so it runs outside the drop context. When create
            // runs inside the drop handler, Foundry expands compendium and adds all embedded spells
            // (61 for Wizard) regardless of payload; deferring prevents that.
            const actor = this.actor;
            const systemData = foundry.utils.duplicate(item.system ?? {});
            const classImg = item.img ?? "";
            setTimeout(async () => {
                // Use a temporary name so server does not match compendium "Wizard" and expand with spells
                const initialData = { name: `\u200B${itemName}`, type: "class", img: classImg, system: {} };
                const createdDocs = await actor.createEmbeddedDocuments("Item", [initialData]);
                const created = createdDocs?.[0] ?? null;
                if (!created?.id) return;
                await created.update({ name: itemName, system: systemData }, { diff: false });
                const createdClass = actor.items.get(created.id);
                const sc = createdClass?.system?.spellcasting;
                if (sc?.spellListAccess === "learned") {
                    const spellListKey = (sc.spellListKey || "").trim() || (itemName === "Wizard" || itemName === "Sorcerer" ? "sorcererWizard" : itemName.toLowerCase());
                    const toRemove = actor.items.filter(
                        (i) => i.type === "spell" && SpellData.hasLevelForClass(i.system, spellListKey)
                    ).map((i) => i.id);
                    if (toRemove.length) await actor.deleteEmbeddedDocuments("Item", toRemove);
                }
                const history = [...(actor.system.levelHistory || [])];
                const existingClassIds = new Set(actor.items.filter(i => i.type === "class").map(c => c.id));
                const hasValidLevels = history.some(entry => existingClassIds.has(entry.classItemId));
                const isFirstLevel = history.length === 0 || !hasValidLevels;
                let hpRolled = 0;
                if (isFirstLevel && game.settings.get("thirdera", "firstLevelFullHp") && createdClass) {
                    const dieSize = parseInt(createdClass.system.hitDie?.substring(1));
                    if (!isNaN(dieSize)) hpRolled = dieSize;
                }
                history.push({ classItemId: created.id, hpRolled });
                await actor.update({ "system.levelHistory": history });
                const classSkills = systemData?.classSkills || [];
                const existingSkillKeys = new Set(actor.items.filter(i => i.type === "skill" && i.system.key).map(s => s.system.key));
                const toCreate = [];
                for (const entry of classSkills) {
                    if (existingSkillKeys.has(entry.key)) continue;
                    const sourceSkill = game.items.find(i => i.type === "skill" && i.system.key === entry.key);
                    if (sourceSkill) toCreate.push(sourceSkill.toObject());
                }
                if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
                const isFullListCaster = sc?.spellListAccess === "full";
                if (createdClass && isFullListCaster) await this._addClassSpellListForFullListCaster(createdClass, 1);
                await this.render();
            }, 0);
            return false;
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

        // Check if this is a container being transferred from another actor (looting)
        const sourceActor = item.parent;
        const isFromAnotherActor = sourceActor && sourceActor.uuid !== this.actor.uuid;
        const isContainer = item.type === "equipment" && item.system?.isContainer;
        
        if (isFromAnotherActor && isContainer) {
            // Handle container transfer with contents
            return await this._transferContainerWithContents(item, sourceActor);
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
            const container = this.actor.items.get(currentContainerId);
            const containerName = container?.name || "container";
            
            // Check if a stackable item exists in main inventory
            const itemForStacking = actualItem.toObject();
            itemForStacking.system.containerId = ""; // Will be in main inventory
            const existingStack = this._findStackableItem(itemForStacking);
            
            if (existingStack) {
                // Stack with existing item in main inventory
                const currentQuantity = existingStack.system.quantity || 1;
                const movedQuantity = actualItem.system.quantity || 1;
                await existingStack.update({ "system.quantity": currentQuantity + movedQuantity });
                
                // Delete the item that was moved (it's been merged)
                await actualItem.delete();
                
                // Re-render to show updated quantities
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
                
                return false; // Handled
            }
            
            // No stackable item found, just remove from container
            // Check if item becomes equipped when removed (shouldn't happen, but check)
            const wasEquippedBefore = false; // Items in containers can't be equipped
            await actualItem.update({ "system.containerId": "" });
            
            // Re-render to show the updated item organization
            await this.actor.prepareData();
            await this.render();
            
            // Check if item is now equipped (shouldn't happen automatically)
            const itemAfter = this.actor.items.get(actualItem.id);
            const isEquippedAfter = itemAfter && (
                (itemAfter.type === "weapon" && itemAfter.system.equipped !== "none") ||
                ((itemAfter.type === "armor" || itemAfter.type === "equipment") && itemAfter.system.equipped === "true")
            );
            
            // Only show notification if equipped status changed
            if (isEquippedAfter && !wasEquippedBefore) {
                ui.notifications.warn(`${actualItem.name} has been removed from ${containerName} and is now equipped.`);
            }
            
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
            
            return false;
        }

        // Check for stackable items before creating new item
        // Only stack weapon, armor, and equipment items
        if (['weapon', 'armor', 'equipment'].includes(item.type)) {
            // Get item data for comparison
            const itemData = item.toObject ? item.toObject() : item;
            
            // Check if item is from another actor (looting) - if so, we want to stack it
            const isFromAnotherActor = item.parent && item.parent.uuid !== this.actor.uuid;
            
            // Find existing stackable item
            const existingItem = this._findStackableItem(itemData);
            if (existingItem) {
                // Increment quantity
                const currentQuantity = existingItem.system.quantity || 1;
                const droppedQuantity = itemData.system?.quantity || 1;
                await existingItem.update({ "system.quantity": currentQuantity + droppedQuantity });
                
                // If item was from another actor, delete it from source (already merged)
                if (isFromAnotherActor && item.id && item.parent) {
                    try {
                        await item.delete();
                    } catch (err) {
                        console.warn("Third Era | Failed to delete source item after stacking:", err);
                    }
                }
                
                return existingItem;
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

        return result;
    }

    /**
     * Remove given spell item IDs from every class's shortlist in spellShortlistByClass.
     * @param {Actor} actor - The character actor
     * @param {string[]} spellIds - Spell item IDs to remove from shortlists
     */
    static async _removeSpellIdsFromShortlist(actor, spellIds) {
        if (!spellIds?.length) return;
        const idSet = new Set(spellIds);
        const shortlist = { ...(actor.system.spellShortlistByClass || {}) };
        let changed = false;
        for (const [classId, list] of Object.entries(shortlist)) {
            if (!Array.isArray(list)) continue;
            const filtered = list.filter((id) => !idSet.has(id));
            if (filtered.length !== list.length) {
                shortlist[classId] = filtered;
                changed = true;
            }
        }
        if (changed) {
            await actor.update({ "system.spellShortlistByClass": shortlist });
        }
    }

    /**
     * Get spell list key for a class (for spell level lookup).
     * @param {Item} classItem - Class item with spellcasting
     * @returns {string}
     */
    static _getSpellListKey(classItem) {
        const sc = classItem?.system?.spellcasting;
        const key = (sc?.spellListKey || "").trim();
        if (key) return key;
        const name = (classItem?.name || "").toLowerCase();
        if (name === "wizard" || name === "sorcerer") return "sorcererWizard";
        return name;
    }

    /**
     * Build class level counts from levelHistory (same as data model).
     * @param {Object} levelHistory - actor.system.levelHistory
     * @returns {Object<string, number>} classItemId -> level count
     */
    static _getClassLevelCounts(levelHistory) {
        const counts = {};
        for (const entry of levelHistory || []) {
            counts[entry.classItemId] = (counts[entry.classItemId] || 0) + 1;
        }
        return counts;
    }

    /**
     * Build domain spell name set per level for a class (from getSpellsForDomain).
     * @param {Item} classItem - Class with spellcasting.domains
     * @returns {Map<number, Set<string>>} spell level (1-9) -> Set of spell name (lowercase)
     */
    static _getDomainSpellNamesByLevel(classItem) {
        const byLevel = new Map();
        for (let L = 1; L <= 9; L++) byLevel.set(L, new Set());
        const sc = classItem?.system?.spellcasting;
        if (!sc?.domains?.length) return byLevel;
        for (const dom of sc.domains) {
            const domainKey = (dom.domainKey || "").trim();
            if (!domainKey) continue;
            try {
                const granted = getSpellsForDomain(domainKey);
                for (const entry of granted) {
                    if (entry.spellName && entry.level >= 1 && entry.level <= 9) {
                        byLevel.get(entry.level).add(entry.spellName.toLowerCase().trim());
                    }
                }
            } catch (_) { /* ignore */ }
        }
        return byLevel;
    }

    /**
     * Spell IDs to remove when a full-list caster loses one level (level drop).
     * Only removes spells at levels that have 0 slots after the drop; excludes spells still granted by another class.
     * @param {Actor} actor - Character actor (before levelHistory update)
     * @param {Item} classItem - The class losing a level (must have spellListAccess "full")
     * @param {number} newClassLevel - Class level after the drop
     * @returns {string[]} Spell item IDs to remove
     */
    static _getSpellIdsToRemoveForFullListLevelDrop(actor, classItem, newClassLevel) {
        const sc = classItem?.system?.spellcasting;
        const table = sc?.spellsPerDayTable || [];
        const spellListKey = ThirdEraActorSheet._getSpellListKey(classItem);
        const classLevelCounts = ThirdEraActorSheet._getClassLevelCounts(actor.system.levelHistory);
        const otherClasses = actor.items.filter((i) => i.type === "class" && i.id !== classItem.id);
        const toRemove = new Set();

        // Regular spells: only consider spells that are on this class's list; remove at levels where this class has 0 slots after drop, and no other class has this spell on its list with slots
        for (const spell of actor.items.filter((i) => i.type === "spell")) {
            if (!SpellData.hasLevelForClass(spell.system, spellListKey)) continue;
            const spellLevel = SpellData.getLevelForClass(spell.system, spellListKey);
            if (ClassData.getSpellsPerDay(table, newClassLevel, spellLevel) > 0) continue;
            const otherHasSlots = otherClasses.some((other) => {
                const oSc = other.system?.spellcasting;
                if (!oSc?.enabled && oSc?.enabled !== "true") return false;
                const oTable = oSc.spellsPerDayTable || [];
                const oKey = ThirdEraActorSheet._getSpellListKey(other);
                if (!SpellData.hasLevelForClass(spell.system, oKey)) return false;
                const oLevel = classLevelCounts[other.id] || 0;
                if (oLevel <= 0) return false;
                const sl = SpellData.getLevelForClass(spell.system, oKey);
                return ClassData.getSpellsPerDay(oTable, oLevel, sl) > 0;
            });
            if (!otherHasSlots) toRemove.add(spell.id);
        }

        // Domain spells: at levels where this class has 0 domain slots after drop (domain slots follow spellsPerDay)
        const domainNamesByLevel = ThirdEraActorSheet._getDomainSpellNamesByLevel(classItem);
        for (let L = 1; L <= 9; L++) {
            if (ClassData.getSpellsPerDay(table, newClassLevel, L) > 0) continue;
            const namesAtL = domainNamesByLevel.get(L);
            if (!namesAtL?.size) continue;
            for (const spell of actor.items.filter((i) => i.type === "spell")) {
                if (namesAtL.has((spell.name || "").toLowerCase().trim())) toRemove.add(spell.id);
            }
        }

        return [...toRemove];
    }

    /**
     * Spell IDs to remove when a full-list caster class is removed entirely.
     * Removes spells only if no other class has slots for them; removes all domain spells for this class.
     * @param {Actor} actor - Character actor (before levelHistory/class delete)
     * @param {Item} classItem - The class being removed (must have spellListAccess "full")
     * @returns {string[]} Spell item IDs to remove
     */
    static _getSpellIdsToRemoveForFullListClassRemoval(actor, classItem) {
        const spellListKey = ThirdEraActorSheet._getSpellListKey(classItem);
        const classLevelCounts = ThirdEraActorSheet._getClassLevelCounts(actor.system.levelHistory);
        const otherClasses = actor.items.filter((i) => i.type === "class" && i.id !== classItem.id);
        const toRemove = new Set();

        // After removal this class has 0 levels -> 0 slots at every level; only consider spells that were on this class's list
        for (const spell of actor.items.filter((i) => i.type === "spell")) {
            if (!SpellData.hasLevelForClass(spell.system, spellListKey)) continue;
            const spellLevel = SpellData.getLevelForClass(spell.system, spellListKey);
            const otherHasSlots = otherClasses.some((other) => {
                const oSc = other.system?.spellcasting;
                if (!oSc?.enabled && oSc?.enabled !== "true") return false;
                const oTable = oSc.spellsPerDayTable || [];
                const oKey = ThirdEraActorSheet._getSpellListKey(other);
                if (!SpellData.hasLevelForClass(spell.system, oKey)) return false;
                const oLevel = classLevelCounts[other.id] || 0;
                if (oLevel <= 0) return false;
                const sl = SpellData.getLevelForClass(spell.system, oKey);
                return ClassData.getSpellsPerDay(oTable, oLevel, sl) > 0;
            });
            if (!otherHasSlots) toRemove.add(spell.id);
        }

        // All domain spells for this class (any level)
        const domainNamesByLevel = ThirdEraActorSheet._getDomainSpellNamesByLevel(classItem);
        for (let L = 1; L <= 9; L++) {
            const namesAtL = domainNamesByLevel.get(L);
            if (!namesAtL?.size) continue;
            for (const spell of actor.items.filter((i) => i.type === "spell")) {
                if (namesAtL.has((spell.name || "").toLowerCase().trim())) toRemove.add(spell.id);
            }
        }

        return [...toRemove];
    }

    /**
     * For a full-list spellcasting class (cleric, druid, etc.), add all class spells from the compendium
     * at levels the character has slots for. No-op if not enabled/full-list or pack unavailable.
     * Learned casters (wizard, sorcerer, bard) must add spells manually via spellbook or spell list browser.
     * @param {Item} classItem - The class item (must have spellcasting with spellListAccess "full")
     * @param {number} classLevel - Character's level in this class (used to determine which spell levels have slots)
     */
    async _addClassSpellListForFullListCaster(classItem, classLevel) {
        const sc = classItem?.system?.spellcasting;
        const enabled = sc?.enabled === true || sc?.enabled === "true";
        if (!sc || !enabled || sc.spellListAccess !== "full") return;
        const spellListKey = (sc.spellListKey || "").trim()
            || (classItem.name === "Wizard" || classItem.name === "Sorcerer" ? "sorcererWizard" : (classItem.name || "").toLowerCase());
        if (!spellListKey) return;
        const table = sc.spellsPerDayTable || [];
        const existingNames = new Set(
            this.actor.items.filter(i => i.type === "spell").map(s => s.name.toLowerCase().trim())
        );
        const pack = game.packs?.get("thirdera.thirdera_spells");
        if (!pack) return;
        try {
            const docs = await pack.getDocuments();
            const toCreate = [];
            for (const doc of docs) {
                if (doc.type !== "spell") continue;
                if (!SpellData.hasLevelForClass(doc.system, spellListKey)) continue;
                const spellLevel = SpellData.getLevelForClass(doc.system, spellListKey);
                if (spellLevel < 0 || spellLevel > 9) continue;
                if (ClassData.getSpellsPerDay(table, classLevel, spellLevel) <= 0) continue;
                if (existingNames.has((doc.name || "").toLowerCase().trim())) continue;
                const clone = doc.toObject();
                delete clone._id;
                toCreate.push(clone);
                existingNames.add((doc.name || "").toLowerCase().trim());
            }
            if (toCreate.length > 0) {
                await this.actor.createEmbeddedDocuments("Item", toCreate);
            }
        } catch (err) {
            console.warn("Third Era | Failed to auto-add class spells:", err);
        }
    }

    /**
     * For a spontaneous caster (sorcerer, bard, etc.), add spells from the class list up to the spells-known
     * limit per level so they appear in Known/Available. Picks spells from the compendium (alphabetically by name).
     * @param {Item} classItem - The class item (must have spellcasting, preparationType spontaneous, spellsKnownTable)
     * @param {number} classLevel - Character's level in this class
     */
    async _addSpellsKnownForSpontaneousCaster(classItem, classLevel) {
        const sc = classItem?.system?.spellcasting;
        const enabled = sc?.enabled === true || sc?.enabled === "true";
        const table = sc?.spellsKnownTable;
        const tableOk = Array.isArray(table) && table.length > 0;
        const prepType = sc?.preparationType;
        if (!sc || !enabled || sc.preparationType !== "spontaneous") return;
        if (!tableOk) return;
        const spellListKey = (sc.spellListKey || "").trim()
            || (classItem.name === "Wizard" || classItem.name === "Sorcerer" ? "sorcererWizard" : (classItem.name || "").toLowerCase());
        if (!spellListKey) return;
        const packForReal = game.packs?.get("thirdera.thirdera_spells");
        if (!packForReal) return;
        const existingNames = new Set(
            this.actor.items.filter(i => i.type === "spell").map(s => s.name.toLowerCase().trim())
        );
        try {
            const docs = await packForReal.getDocuments();
            const byLevel = new Map(); // spellLevel -> sorted array of spell docs for this list
            for (const doc of docs) {
                if (doc.type !== "spell") continue;
                if (!SpellData.hasLevelForClass(doc.system, spellListKey)) continue;
                const spellLevel = SpellData.getLevelForClass(doc.system, spellListKey);
                if (spellLevel < 0 || spellLevel > 9) continue;
                if (!byLevel.has(spellLevel)) byLevel.set(spellLevel, []);
                byLevel.get(spellLevel).push(doc);
            }
            const actorSpells = this.actor.items.filter(i => i.type === "spell");
            const levelStats = [];
            for (let level = 0; level <= 9; level++) {
                const need = ClassData.getSpellsKnown(table, classLevel, level);
                if (need <= 0) continue;
                const currentAtLevel = actorSpells.filter(
                    (s) => SpellData.hasLevelForClass(s.system, spellListKey) && SpellData.getLevelForClass(s.system, spellListKey) === level
                ).length;
                const toAdd = Math.max(0, need - currentAtLevel);
                levelStats.push({ level, need, currentAtLevel, toAdd });
                if (toAdd === 0) continue;
                const candidates = (byLevel.get(level) || []).slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                const toCreate = [];
                for (const doc of candidates) {
                    if (toCreate.length >= toAdd) break;
                    const nameKey = (doc.name || "").toLowerCase().trim();
                    if (existingNames.has(nameKey)) continue;
                    const clone = doc.toObject();
                    delete clone._id;
                    toCreate.push(clone);
                    existingNames.add(nameKey);
                }
                if (toCreate.length > 0) {
                    await this.actor.createEmbeddedDocuments("Item", toCreate);
                }
            }
        } catch (err) {
            console.warn("Third Era | Failed to auto-add spells known for spontaneous caster:", err);
        }
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
            const container = this.actor.items.get(currentContainerId);
            const containerName = container?.name || "container";
            
            // Check if item becomes equipped when removed (shouldn't happen, but check)
            const wasEquippedBefore = false; // Items in containers can't be equipped
            await actualItem.update({ "system.containerId": "" });
            
            // Re-render to show the updated item organization
            await this.actor.prepareData();
            await this.render();
            
            // Check if item is now equipped (shouldn't happen automatically)
            const itemAfter = this.actor.items.get(actualItem.id);
            const isEquippedAfter = itemAfter && (
                (itemAfter.type === "weapon" && itemAfter.system.equipped !== "none") ||
                ((itemAfter.type === "armor" || itemAfter.type === "equipment") && itemAfter.system.equipped === "true")
            );
            
            // Only show notification if equipped status changed
            if (isEquippedAfter && !wasEquippedBefore) {
                ui.notifications.warn(`${actualItem.name} has been removed from ${containerName} and is now equipped.`);
            }
            
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
            // Check if item has quantity > 1 - show quantity dialog for partial moves
            const quantity = actualItem.system.quantity || 1;
            let selectedQuantity = quantity;
            if (quantity > 1) {
                selectedQuantity = await ThirdEraActorSheet.#showQuantityDialog(actualItem, "moveToContainer");
                if (selectedQuantity === null) return false; // Cancelled
            }
            
            // If partial quantity selected, split the stack
            let itemToMove = actualItem;
            if (selectedQuantity < quantity) {
                itemToMove = await this._splitItemStack(actualItem, selectedQuantity);
            }
            
            // Check if a stackable item already exists in the container
            const itemForStacking = itemToMove.toObject();
            itemForStacking.system.containerId = containerId;
            if (wasEquipped) {
                if (itemToMove.type === "weapon") {
                    itemForStacking.system.equipped = "none";
                } else {
                    itemForStacking.system.equipped = "false";
                }
            }
            
            const existingStack = this._findStackableItem(itemForStacking);
            if (existingStack) {
                // Stack with existing item
                const currentQuantity = existingStack.system.quantity || 1;
                const movedQuantity = itemToMove.system.quantity || 1;
                await existingStack.update({ "system.quantity": currentQuantity + movedQuantity });
                
                // Delete the item that was moved (it's been merged)
                await itemToMove.delete();
                
                // Re-render to show updated quantities
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
                    if (!expandedContainers.includes(containerId)) {
                        const containerContents = this.element.querySelector(`.container-contents[data-container-id="${containerId}"]`);
                        const containerToggle = this.element.querySelector(`.container-toggle[data-container-id="${containerId}"]`);
                        if (containerContents && containerToggle) {
                            containerContents.style.display = "block";
                            containerToggle.classList.remove("fa-chevron-right");
                            containerToggle.classList.add("fa-chevron-down");
                            expandedContainers.push(containerId);
                            this.actor.setFlag("thirdera", "expandedContainers", expandedContainers);
                        }
                    }
                });
                
                return false; // Handled
            }
            
            // No stackable item found, move item to container normally
            const updates = { "system.containerId": containerId };
            if (wasEquipped) {
                if (itemToMove.type === "weapon") {
                    updates["system.equipped"] = "none";
                } else {
                    updates["system.equipped"] = "false";
                }
            }
            
            try {
                await itemToMove.update(updates);
                
                // Wait a moment for the update to propagate
                await new Promise(resolve => setTimeout(resolve, 50));
                
                // Verify the update by checking the item's system data
                const verifyItem = this.actor.items.get(itemToMove.id);
                if (!verifyItem || verifyItem.system.containerId !== containerId) {
                    ui.notifications.error(`Failed to move ${itemToMove.name} into ${container.name}.`);
                    return false;
                }
            } catch (error) {
                ui.notifications.error(`Failed to move ${itemToMove.name} into ${container.name}: ${error.message}`);
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
                ui.notifications.warn(`${itemToMove.name} has been unequipped and placed in ${container.name}.`);
            }
        } else {
            // New item from sidebar - check if stackable item exists first
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
            
            // Check if a stackable item already exists in the container
            const existingStack = this._findStackableItem(itemData);
            if (existingStack) {
                // Stack with existing item
                const currentQuantity = existingStack.system.quantity || 1;
                const droppedQuantity = itemData.system?.quantity || 1;
                await existingStack.update({ "system.quantity": currentQuantity + droppedQuantity });
                
                // Re-render to show updated quantities
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
                    if (!expandedContainers.includes(containerId)) {
                        const containerContents = this.element.querySelector(`.container-contents[data-container-id="${containerId}"]`);
                        const containerToggle = this.element.querySelector(`.container-toggle[data-container-id="${containerId}"]`);
                        if (containerContents && containerToggle) {
                            containerContents.style.display = "block";
                            containerToggle.classList.remove("fa-chevron-right");
                            containerToggle.classList.add("fa-chevron-down");
                            expandedContainers.push(containerId);
                            this.actor.setFlag("thirdera", "expandedContainers", expandedContainers);
                        }
                    }
                });
                
                return false; // Handled
            }
            
            // No stackable item found, create new item
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
            
            // Only show notification if item was equipped (shouldn't happen for new items, but check anyway)
            if (wasEquipped && equipValue) {
                ui.notifications.warn(`${actualItem.name} has been unequipped and placed in ${container.name}.`);
            }
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

    /**
     * Check if two items can be stacked together
     * @param {Item|Object} item1       First item
     * @param {Item|Object} item2       Second item
     * @returns {boolean}                True if items can stack
     */
    _canStackItems(item1, item2) {
        // Must have same name and type
        if (item1.name !== item2.name || item1.type !== item2.type) {
            return false;
        }

        // Must be in same location (containerId)
        const container1 = item1.system?.containerId || "";
        const container2 = item2.system?.containerId || "";
        if (container1 !== container2) {
            return false;
        }

        // Must have same equipped state
        const equipped1 = item1.system?.equipped || (item1.type === "weapon" ? "none" : "false");
        const equipped2 = item2.system?.equipped || (item2.type === "weapon" ? "none" : "false");
        if (equipped1 !== equipped2) {
            return false;
        }

        // Containers cannot stack
        if (item1.type === "equipment" && item1.system?.isContainer) {
            return false;
        }

        // Compare type-specific properties
        if (item1.type === "weapon") {
            const sys1 = item1.system || {};
            const sys2 = item2.system || {};
            if (sys1.damage?.dice !== sys2.damage?.dice ||
                sys1.damage?.type !== sys2.damage?.type ||
                sys1.critical?.range !== sys2.critical?.range ||
                sys1.critical?.multiplier !== sys2.critical?.multiplier ||
                sys1.range !== sys2.range ||
                sys1.properties?.melee !== sys2.properties?.melee ||
                sys1.properties?.handedness !== sys2.properties?.handedness ||
                sys1.properties?.size !== sys2.properties?.size ||
                sys1.properties?.proficiency !== sys2.properties?.proficiency) {
                return false;
            }
        } else if (item1.type === "armor") {
            const sys1 = item1.system || {};
            const sys2 = item2.system || {};
            if (sys1.armor?.type !== sys2.armor?.type ||
                sys1.armor?.bonus !== sys2.armor?.bonus ||
                sys1.armor?.maxDex !== sys2.armor?.maxDex ||
                sys1.armor?.checkPenalty !== sys2.armor?.checkPenalty ||
                sys1.armor?.spellFailure !== sys2.armor?.spellFailure ||
                sys1.size !== sys2.size) {
                return false;
            }
        } else if (item1.type === "equipment") {
            const sys1 = item1.system || {};
            const sys2 = item2.system || {};
            // Equipment items stack if they have same cost and weight (simple items like rations)
            // But containers already filtered out above
            if (sys1.cost !== sys2.cost || sys1.weight !== sys2.weight) {
                return false;
            }
        }

        return true;
    }

    /**
     * Find an existing stackable item for the given item
     * @param {Item|Object} item         The item to find a stack for
     * @returns {Item|null}              The stackable item, or null if none found
     */
    _findStackableItem(item) {
        // Get the item ID, handling both Item documents (item.id) and plain objects (item._id or item.id)
        const itemId = item.id || item._id;
        
        for (const existingItem of this.actor.items) {
            // Don't match self - compare with both id and _id to handle different object types
            if (existingItem.id === itemId || existingItem._id === itemId) continue;
            if (this._canStackItems(item, existingItem)) {
                return existingItem;
            }
        }
        return null;
    }

    /**
     * Attempt to stack an unequipped item with existing stackable items
     * @param {Item} item               The item that was just unequipped
     * @param {boolean} skipRender      If true, don't re-render (for bulk operations)
     * @returns {Promise<boolean>}       True if item was merged, false if it remains separate
     */
    async _stackAfterUnequip(item, skipRender = false) {
        // Only attempt stacking if item is now unequipped
        const equipped = item.system?.equipped || (item.type === "weapon" ? "none" : "false");
        if (equipped !== "none" && equipped !== "false") {
            return false; // Still equipped, can't stack
        }

        // Check if a stackable item exists
        const itemForStacking = item.toObject();
        const existingStack = this._findStackableItem(itemForStacking);
        
        if (existingStack) {
            // Stack with existing item
            const currentQuantity = existingStack.system.quantity || 1;
            const movedQuantity = item.system.quantity || 1;
            await existingStack.update({ "system.quantity": currentQuantity + movedQuantity });
            
            // Delete the item that was unequipped (it's been merged)
            await item.delete();
            
            // Re-render to show updated quantities (unless skipping for bulk operations)
            if (!skipRender) {
                await this.actor.prepareData();
                await this.render();
            }
            
            return true; // Item was merged
        }
        
        return false; // No stackable item found, item remains separate
    }

    /**
     * Split an item stack into two items
     * @param {Item} item               The item to split
     * @param {number} quantity          Quantity to split off
     * @returns {Promise<Item>}          The newly created split item
     */
    async _splitItemStack(item, quantity) {
        const currentQuantity = item.system.quantity || 1;
        if (quantity >= currentQuantity) {
            throw new Error(`Cannot split ${quantity} from stack of ${currentQuantity}`);
        }

        // Create new item with split quantity
        const itemData = item.toObject();
        itemData.system.quantity = quantity;
        
        // Remove _id so it creates a new item
        delete itemData._id;
        delete itemData.id;

        const [newItem] = await this.actor.createEmbeddedDocuments("Item", [itemData]);

        // Reduce original item's quantity
        const newQuantity = currentQuantity - quantity;
        if (newQuantity <= 0) {
            await item.delete();
        } else {
            await item.update({ "system.quantity": newQuantity });
        }

        return newItem;
    }

    /**
     * Show a dialog to select quantity for an action on a stacked item
     * @param {Item} item               The item to perform action on
     * @param {string} actionType       Type of action ("delete", "equip", "removeFromContainer")
     * @returns {Promise<number|null>}   Selected quantity, or null if cancelled
     */
    static async #showQuantityDialog(item, actionType) {
        const maxQuantity = item.system.quantity || 1;
        if (maxQuantity <= 1) {
            return maxQuantity; // No dialog needed for single items
        }

        const actionLabels = {
            delete: "delete",
            equip: "equip",
            removeFromContainer: "remove from container",
            moveToContainer: "move to container"
        };
        const actionLabel = actionLabels[actionType] || "use";

        // Create dialog content with quick selection buttons
        const content = `
            <div class="quantity-dialog">
                <p>How many <strong>${item.name}</strong> do you want to ${actionLabel}?</p>
                <p>You have ${maxQuantity} total.</p>
                <div class="quantity-quick-buttons" style="display: flex; gap: 5px; margin: 10px 0;">
                    <button type="button" class="quantity-btn" data-quantity="1">1</button>
                    <button type="button" class="quantity-btn" data-quantity="${maxQuantity}">All (${maxQuantity})</button>
                </div>
                <div style="margin: 10px 0;">
                    <label>Custom amount:</label>
                    <input type="number" id="quantity-custom" min="1" max="${maxQuantity}" value="1" style="width: 80px; margin-left: 10px;">
                </div>
            </div>
        `;

        return new Promise((resolve) => {
            let finalQuantity = 1; // Track the final selected quantity
            
            const dialog = new Dialog({
                title: `Select Quantity - ${item.name}`,
                content: content,
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: "OK",
                        callback: (html) => {
                            // Prioritize finalQuantity (set by button clicks) over input field
                            // Only read from input if finalQuantity is still the default (1) and user manually typed
                            const input = html.find("#quantity-custom")[0];
                            let quantity = finalQuantity; // Start with tracked value
                            // If finalQuantity is still default (1) and input has a different valid value, use input
                            // This handles manual typing when no button was clicked
                            if (finalQuantity === 1 && input && input.value) {
                                const inputValue = parseInt(input.value);
                                if (!isNaN(inputValue) && inputValue >= 1 && inputValue !== 1) {
                                    quantity = inputValue;
                                }
                            }
                            if (quantity < 1 || quantity > maxQuantity) {
                                ui.notifications.warn(`Quantity must be between 1 and ${maxQuantity}.`);
                                resolve(null);
                            } else {
                                resolve(quantity);
                            }
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "Cancel",
                        callback: () => resolve(null)
                    }
                },
                default: "ok",
                close: () => resolve(null)
            });

            dialog.render(true);
            
            // Attach handlers after a short delay to ensure DOM is ready
            // Use both requestAnimationFrame and setTimeout for maximum compatibility
            const attachHandlers = () => {
                if (!dialog.element) return;
                
                // Find buttons
                const buttons = dialog.element.find(".quantity-btn");
                
                // Handler function
                const handler = (event) => {
                    if (!event.currentTarget.classList.contains('quantity-btn')) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const quantity = parseInt(event.currentTarget.dataset.quantity);
                    finalQuantity = quantity; // Update tracked value
                    
                    // Update the input field
                    const input = dialog.element.find("#quantity-custom");
                    if (input.length) {
                        input.val(quantity);
                        input[0].value = quantity.toString();
                        input.trigger('change');
                    }
                };
                
                // Attach using event delegation (works even if buttons aren't ready)
                dialog.element.on("click", ".quantity-btn", handler);
                // Also attach directly to buttons if found
                if (buttons.length) {
                    buttons.on("click", handler);
                }
                
                // Track manual input changes
                dialog.element.find("#quantity-custom").on("input change", (event) => {
                    const value = parseInt(event.target.value);
                    if (!isNaN(value) && value >= 1 && value <= maxQuantity) {
                        finalQuantity = value;
                    }
                });
            };
            
            // Try multiple approaches to ensure handlers are attached
            requestAnimationFrame(() => {
                attachHandlers();
                // Also try after a short timeout as backup
                setTimeout(attachHandlers, 50);
            });
        });
    }

    /**
     * Transfer a container and all its contents from one actor to another
     * @param {Item} containerItem      The container item being transferred
     * @param {Actor} sourceActor        The source actor (where the container currently is)
     * @returns {Promise<Item|null>}     The created container item, or null if transfer failed
     */
    async _transferContainerWithContents(containerItem, sourceActor) {
        const oldContainerId = containerItem.id;
        
        // Collect all items that belong to this container (including nested containers)
        // Structure: { itemData, oldId, oldContainerId, isContainer }
        const contentsToTransfer = [];
        const idMapping = new Map(); // oldId -> newId
        
        // Recursively collect all items in the container and nested containers
        const collectContents = (containerId) => {
            for (const item of sourceActor.items) {
                if (item.system.containerId === containerId) {
                    const itemData = item.toObject();
                    const isContainer = item.type === "equipment" && item.system?.isContainer;
                    contentsToTransfer.push({
                        itemData,
                        oldId: item.id,
                        oldContainerId: containerId,
                        isContainer
                    });
                    
                    // If this is a nested container, collect its contents too
                    if (isContainer) {
                        collectContents(item.id);
                    }
                }
            }
        };
        
        collectContents(oldContainerId);
        
        // Check permissions
        if (!this.actor.isOwner) {
            ui.notifications.error(`You do not have permission to add items to ${this.actor.name}.`);
            return null;
        }
        
        // Transfer the container first
        const containerData = containerItem.toObject();
        let createdContainer;
        try {
            createdContainer = await this.actor.createEmbeddedDocuments("Item", [containerData]);
            if (!createdContainer || createdContainer.length === 0) {
                ui.notifications.error(`Failed to transfer container ${containerItem.name}.`);
                return null;
            }
            createdContainer = createdContainer[0];
            const newContainerId = createdContainer.id;
            console.log("Third Era | Container transferred:", { containerName: containerItem.name, newContainerId, targetActor: this.actor.name, targetActorType: this.actor.type });
            
            // Map old container ID to new container ID
            idMapping.set(oldContainerId, newContainerId);
            
            // Transfer contents in order: process items level by level
            // First level: items directly in the transferred container
            // Then process nested containers and their contents
            const processedIds = new Set();
            let itemsRemaining = contentsToTransfer.length;
            
            while (itemsRemaining > 0) {
                const itemsToCreate = [];
                const itemsToMap = [];
                
                // Find items whose parent container has already been mapped
                for (const content of contentsToTransfer) {
                    if (processedIds.has(content.oldId)) continue;
                    
                    const parentNewId = idMapping.get(content.oldContainerId);
                    if (parentNewId) {
                        // Update containerId to the new parent ID
                        content.itemData.system.containerId = parentNewId;
                        itemsToCreate.push(content.itemData);
                        itemsToMap.push(content);
                    }
                }
                
                if (itemsToCreate.length === 0) {
                    // No more items can be processed (shouldn't happen, but safety check)
                    console.warn("Third Era | Some items could not be transferred - parent containers may be missing.");
                    break;
                }
                
                // Create all items at this level
                try {
                    const created = await this.actor.createEmbeddedDocuments("Item", itemsToCreate);
                    console.log("Third Era | Created items:", { count: created.length, itemNames: created.map(i => i.name), targetActor: this.actor.name });
                    
                    // Update ID mapping
                    for (let i = 0; i < created.length; i++) {
                        const oldId = itemsToMap[i].oldId;
                        const newId = created[i].id;
                        idMapping.set(oldId, newId);
                        processedIds.add(oldId);
                        itemsRemaining--;
                    }
                } catch (err) {
                    console.error("Third Era | Failed to transfer container contents:", err);
                    console.error("Third Era | Error details:", { error: err.message, stack: err.stack, itemsToCreate: itemsToCreate.map(i => ({ name: i.name, type: i.type })) });
                    ui.notifications.warn(`Some items from ${containerItem.name} failed to transfer.`);
                    // Mark these as processed to avoid infinite loop
                    for (const item of itemsToMap) {
                        processedIds.add(item.oldId);
                        itemsRemaining--;
                    }
                }
            }
            
            // Verify items were created
            const allCreatedItems = this.actor.items.filter(item => {
                return item.id === newContainerId || contentsToTransfer.some(c => {
                    const newId = idMapping.get(c.oldId);
                    return newId && item.id === newId;
                });
            });
            console.log("Third Era | Verification - items on target actor:", {
                totalItemsOnActor: this.actor.items.size,
                expectedContainerId: newContainerId,
                expectedContentsCount: contentsToTransfer.length,
                foundItems: allCreatedItems.length,
                foundItemNames: allCreatedItems.map(i => i.name),
                containerFound: this.actor.items.has(newContainerId)
            });
            
            // Refresh the actor data and re-render
            await this.actor.prepareData();
            await this.render();
            
            // Delete the container and all its contents from the source actor
            const itemsToDelete = [oldContainerId];
            for (const content of contentsToTransfer) {
                itemsToDelete.push(content.oldId);
            }
            
            try {
                // Get the actual item documents from the source actor
                const itemsToDeleteDocs = itemsToDelete
                    .map(id => sourceActor.items.get(id))
                    .filter(item => item !== undefined);
                
                if (itemsToDeleteDocs.length > 0) {
                    await sourceActor.deleteEmbeddedDocuments("Item", itemsToDeleteDocs.map(item => item.id));
                }
            } catch (err) {
                console.error("Third Era | Failed to delete items from source actor:", err);
                ui.notifications.warn(`Container was transferred, but failed to remove it from ${sourceActor.name}. You may need to delete it manually.`);
            }
            
            const contentsCount = contentsToTransfer.length;
            ui.notifications.info(`Transferred ${containerItem.name}${contentsCount > 0 ? ` and ${contentsCount} item(s)` : ""} from ${sourceActor.name} to ${this.actor.name}.`);
            
            return createdContainer;
            
        } catch (err) {
            console.error("Third Era | Failed to transfer container:", err);
            ui.notifications.error(`Failed to transfer container ${containerItem.name}.`);
            return null;
        }
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
        
        // Check if a stackable item already exists
        const existingItem = this._findStackableItem(itemData);
        if (existingItem) {
            // Increment quantity instead of creating new item
            const currentQuantity = existingItem.system.quantity || 1;
            await existingItem.update({ "system.quantity": currentQuantity + 1 });
            return existingItem;
        }
        
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
        if (!item) return;

        // When deleting a spell, remove its id from all class shortlists (Ready to cast) first
        if (item.type === "spell") {
            const shortlist = { ...(this.actor.system.spellShortlistByClass || {}) };
            let changed = false;
            for (const [classId, list] of Object.entries(shortlist)) {
                if (Array.isArray(list) && list.includes(itemId)) {
                    shortlist[classId] = list.filter((id) => id !== itemId);
                    changed = true;
                }
            }
            if (changed) {
                await this.actor.update({ "system.spellShortlistByClass": shortlist });
            }
        }

        // If this is a container, move all items inside to main inventory first
        if (item.type === "equipment" && item.system.isContainer) {
            const itemsInContainer = this.actor.items.filter(i => i.system.containerId === itemId);
            if (itemsInContainer.length > 0) {
                const updates = itemsInContainer.map(i => ({ _id: i.id, "system.containerId": "" }));
                await this.actor.updateEmbeddedDocuments("Item", updates);
                ui.notifications.info(`${itemsInContainer.length} item(s) moved to inventory from ${item.name}.`);
            }
            return await item.delete();
        }

        // Handle stacked items
        const quantity = item.system.quantity || 1;
        if (quantity > 1) {
            const selectedQuantity = await ThirdEraActorSheet.#showQuantityDialog(item, "delete");
            if (selectedQuantity === null) return; // Cancelled

            if (selectedQuantity >= quantity) {
                // Delete entire stack
                return await item.delete();
            } else {
                // Reduce quantity
                const newQuantity = quantity - selectedQuantity;
                await item.update({ "system.quantity": newQuantity });
            }
        } else {
            // Single item, delete immediately
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

        const quantity = item.system.quantity || 1;
        const equipping = item.system.equipped !== "true";

        // When equipping, automatically split off 1 item from stack if quantity > 1
        // This allows the equipped item to be managed separately
        let itemToEquip = item;
        if (equipping && quantity > 1) {
            itemToEquip = await this._splitItemStack(item, 1);
        }

        // Equipment items: simple toggle, no slot/size logic
        if (itemToEquip.type === "equipment") {
            if (equipping) {
                await itemToEquip.update({ "system.equipped": "true" });
            } else {
                // Unequipping — toggle off and check for stacking
                await itemToEquip.update({ "system.equipped": "false" });
                await this._stackAfterUnequip(itemToEquip);
            }
            return;
        }

        if (!equipping) {
            // Unequipping — toggle off and check for stacking
            await itemToEquip.update({ "system.equipped": "false" });
            await this._stackAfterUnequip(itemToEquip);
            return;
        }

        // Check size compatibility
        const actorSize = this.actor.system.details.size;
        const armorSize = itemToEquip.system.size;
        if (armorSize !== actorSize) {
            ui.notifications.warn(`Cannot equip ${itemToEquip.name} — it is ${armorSize} but ${this.actor.name} is ${actorSize}.`);
            return;
        }

        // Equip the item FIRST to prevent it from being found as stackable during unequip
        await itemToEquip.update({ "system.equipped": "true" });

        // Equipping — unequip any other item in the same slot (body armor or shield)
        const isShield = itemToEquip.system.armor?.type === "shield";
        const updates = [];
        for (const other of this.actor.items) {
            if (other.id === itemToEquip.id) continue;
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
            
            // After bulk unequip, check each item for stacking (skip render during loop)
            // The item being equipped is already equipped, so it won't be found as stackable
            for (const update of updates) {
                const unequippedItem = this.actor.items.get(update._id);
                if (unequippedItem) {
                    await this._stackAfterUnequip(unequippedItem, true);
                }
            }
            
            // Re-render once after all stacking operations
            await this.actor.prepareData();
            await this.render();
            
            ui.notifications.info(`Unequipped ${unequippedNames.join(", ")} to equip ${itemToEquip.name}.`);
        }
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
            await item.update({ "system.equipped": "none" });
            await this._stackAfterUnequip(item);
            return;
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

        // When equipping, automatically split off 1 item from stack if quantity > 1
        // This allows the equipped item to be managed separately
        const quantity = item.system.quantity || 1;
        let itemToEquip = item;
        if (quantity > 1) {
            itemToEquip = await this._splitItemStack(item, 1);
        }

        // Block off-hand if current primary weapon is effectively two-handed
        if (hand === "offhand") {
            for (const other of this.actor.items) {
                if (other.id === itemToEquip.id || other.type !== "weapon") continue;
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

        // Equip the item FIRST to prevent it from being found as stackable during unequip
        await itemToEquip.update({ "system.equipped": hand });

        // Unequip any other weapon in the same hand slot
        const updates = [];
        for (const other of this.actor.items) {
            if (other.id === itemToEquip.id || other.type !== "weapon") continue;
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
                if (other.id === itemToEquip.id || other.type !== "weapon") continue;
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
            
            // After bulk unequip, check each item for stacking (skip render during loop)
            // The item being equipped is already equipped, so it won't be found as stackable
            for (const update of updates) {
                const unequippedItem = this.actor.items.get(update._id);
                if (unequippedItem) {
                    await this._stackAfterUnequip(unequippedItem, true);
                }
            }
            
            // Re-render once after all stacking operations
            await this.actor.prepareData();
            await this.render();
        }
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
        if (!cls) return;

        const spellListAccess = cls?.system?.spellcasting?.spellListAccess;
        const idsToRemove = spellListAccess === "full"
            ? ThirdEraActorSheet._getSpellIdsToRemoveForFullListClassRemoval(this.actor, cls)
            : [];

        // Remove levelHistory entries for this class and delete the class item
        const history = (this.actor.system.levelHistory || []).filter(e => e.classItemId !== itemId);
        await this.actor.update({ "system.levelHistory": history });
        await cls.delete();

        // Full-list caster: remove spells that only this class granted and clean shortlist
        if (idsToRemove.length > 0) {
            await ThirdEraActorSheet._removeSpellIdsFromShortlist(this.actor, idsToRemove);
            await this.actor.deleteEmbeddedDocuments("Item", idsToRemove);
        }
        // Remove the deleted class's key from shortlist for cleanliness
        const shortlist = { ...(this.actor.system.spellShortlistByClass || {}) };
        if (Object.hasOwn(shortlist, itemId)) {
            delete shortlist[itemId];
            await this.actor.update({ "system.spellShortlistByClass": shortlist });
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
            
            // Check if this is the first level: levelHistory is empty OR all entries reference classes that no longer exist
            const existingClassIds = new Set(this.actor.items.filter(i => i.type === "class").map(c => c.id));
            const hasValidLevels = history.some(entry => existingClassIds.has(entry.classItemId));
            const isFirstLevel = history.length === 0 || !hasValidLevels;
            
            let hpRolled = 0;
            
            // If this is the first level and the setting is enabled, set HP to max
            if (isFirstLevel && game.settings.get("thirdera", "firstLevelFullHp")) {
                const hitDie = cls.system.hitDie;
                // Parse hit die (e.g., "d8" -> 8, "d10" -> 10)
                const dieSize = parseInt(hitDie.substring(1));
                if (!isNaN(dieSize)) {
                    hpRolled = dieSize; // Max value of the die
                }
            }
            
            history.push({ classItemId: cls.id, hpRolled });
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

        const newClassLevel = classLevels - 1;
        const spellListAccess = cls?.system?.spellcasting?.spellListAccess;
        const idsToRemove = spellListAccess === "full"
            ? ThirdEraActorSheet._getSpellIdsToRemoveForFullListLevelDrop(this.actor, cls, newClassLevel)
            : [];

        // Store current HP before removal
        const currentHp = this.actor.system.attributes.hp.value;

        // Remove the last levelHistory entry for this class
        const history = [...(this.actor.system.levelHistory || [])];
        const lastIndex = history.findLastIndex(e => e.classItemId === itemId);
        if (lastIndex >= 0) {
            history.splice(lastIndex, 1);
            const updateData = { "system.levelHistory": history };
            
            // After removal, prepareDerivedData will recalculate max HP
            // We need to update first, then check and adjust current HP
            await this.actor.update(updateData);
            
            // Now that prepareDerivedData has run, get the new max HP
            const newMaxHp = this.actor.system.attributes.hp.max;
            
            // If current HP exceeds new max HP, reduce it to max HP
            if (currentHp > newMaxHp) {
                await this.actor.update({ "system.attributes.hp.value": newMaxHp });
            }
        }

        // Full-list caster: remove spells that lost slot access and clean shortlist
        if (idsToRemove.length > 0) {
            await ThirdEraActorSheet._removeSpellIdsFromShortlist(this.actor, idsToRemove);
            await this.actor.deleteEmbeddedDocuments("Item", idsToRemove);
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
        const container = this.actor.items.get(containerId);
        const containerName = container?.name || "container";
        const expandedContainers = this.actor.getFlag("thirdera", "expandedContainers") || [];
        const wasExpanded = expandedContainers.includes(containerId);

        // Handle stacked items
        const quantity = item.system.quantity || 1;
        let selectedQuantity = quantity;
        if (quantity > 1) {
            selectedQuantity = await ThirdEraActorSheet.#showQuantityDialog(item, "removeFromContainer");
            if (selectedQuantity === null) return; // Cancelled
        }

        // If partial quantity selected, split the stack
        let itemToRemove = item;
        if (selectedQuantity < quantity) {
            itemToRemove = await this._splitItemStack(item, selectedQuantity);
        }

        // Check if a stackable item exists in main inventory (not in any container)
        const itemForStacking = itemToRemove.toObject();
        itemForStacking.system.containerId = ""; // Will be in main inventory
        const existingStack = this._findStackableItem(itemForStacking);
        
        if (existingStack) {
            // Stack with existing item in main inventory
            const currentQuantity = existingStack.system.quantity || 1;
            const movedQuantity = itemToRemove.system.quantity || 1;
            await existingStack.update({ "system.quantity": currentQuantity + movedQuantity });
            
            // Delete the item that was moved (it's been merged)
            await itemToRemove.delete();
            
            // Re-render to show updated quantities
            await this.actor.prepareData();
            await this.render();
            
            // Restore container expand/collapse state
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
            return;
        }

        // No stackable item found, just remove from container
        // Check if item becomes equipped when removed (shouldn't happen, but check)
        const wasEquippedBefore = false; // Items in containers can't be equipped
        await itemToRemove.update({ "system.containerId": "" });
        
        // Re-render to show the updated item organization
        await this.actor.prepareData();
        await this.render();
        
        // Check if item is now equipped (shouldn't happen automatically)
        const itemAfter = this.actor.items.get(itemToRemove.id);
        const isEquippedAfter = itemAfter && (
            (itemAfter.type === "weapon" && itemAfter.system.equipped !== "none") ||
            ((itemAfter.type === "armor" || itemAfter.type === "equipment") && itemAfter.system.equipped === "true")
        );
        
        // Only show notification if equipped status changed
        if (isEquippedAfter && !wasEquippedBefore) {
            ui.notifications.warn(`${itemToRemove.name} has been removed from ${containerName} and is now equipped.`);
        }
        
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

    /**
     * Handle incrementing prepared spell count
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onIncrementPrepared(event, target) {
        const itemId = target.dataset.itemId;
        if (!itemId) return;
        const item = this.actor.items.get(itemId);
        if (!item || item.type !== "spell") return;
        const current = item.system.prepared || 0;
        await item.update({ "system.prepared": current + 1 });
    }

    /**
     * Handle decrementing prepared spell count
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onDecrementPrepared(event, target) {
        const itemId = target.dataset.itemId;
        if (!itemId) return;
        const item = this.actor.items.get(itemId);
        if (!item || item.type !== "spell") return;
        const current = item.system.prepared || 0;
        await item.update({ "system.prepared": Math.max(0, current - 1) });
    }

    /**
     * Handle incrementing cast spell count
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onIncrementCast(event, target) {
        const itemId = target.dataset.itemId;
        if (!itemId) return;
        const item = this.actor.items.get(itemId);
        if (!item || item.type !== "spell") return;
        const current = item.system.cast || 0;
        await item.update({ "system.cast": current + 1 });
    }

    /**
     * Handle decrementing cast spell count
     * @param {PointerEvent} event   The originating click event
     * @param {HTMLElement} target   The clicked element
     * @this {ThirdEraActorSheet}
     */
    static async #onDecrementCast(event, target) {
        const itemId = target.dataset.itemId;
        if (!itemId) return;
        const item = this.actor.items.get(itemId);
        if (!item || item.type !== "spell") return;
        const current = item.system.cast || 0;
        await item.update({ "system.cast": Math.max(0, current - 1) });
    }

    /**
     * Remove a domain from one of the actor's spellcasting classes (from Spells tab Domains section).
     * @param {PointerEvent} event
     * @param {HTMLElement} target   Element with data-class-item-id and data-domain-key
     */
    static async #onRemoveDomain(event, target) {
        const actionEl = target.closest("[data-action='removeDomain']") || target;
        const classItemId = actionEl.dataset?.classItemId
            || target.closest("[data-class-item-id]")?.dataset?.classItemId;
        const domainKey = actionEl.dataset?.domainKey
            || target.closest("[data-domain-key]")?.dataset?.domainKey;
        if (!classItemId || !domainKey) return;
        const classItem = this.actor.items.get(classItemId);
        if (!classItem || classItem.type !== "class" || !classItem.system?.spellcasting?.domains) return;
        const current = [...(classItem.system.spellcasting.domains || [])];
        const filtered = current.filter(
            d => (d.domainKey || "").trim().toLowerCase() !== domainKey.trim().toLowerCase()
        );
        if (filtered.length === current.length) return;
        await classItem.update({ "system.spellcasting.domains": filtered });
        await this.actor.prepareData();
        await this.render();
    }

    /**
     * Add a placeholder domain spell to the character (look up by name from getSpellsForDomain and create item).
     * @param {PointerEvent} event
     * @param {HTMLElement} target   Element with data-action="addPlaceholderSpell" and data-spell-name, data-domain-key
     */
    static async #onAddPlaceholderSpell(event, target) {
        const actionEl = target.closest("[data-action='addPlaceholderSpell']") || target;
        const spellName = (actionEl.dataset?.spellName || "").trim();
        const domainKey = (actionEl.dataset?.domainKey || "").trim();
        if (!spellName || !domainKey) return;
        const existing = this.actor.items.find(
            i => i.type === "spell" && (i.name || "").toLowerCase().trim() === spellName.toLowerCase().trim()
        );
        if (existing) {
            await this.actor.prepareData();
            await this.render();
            return;
        }
        const granted = getSpellsForDomain(domainKey);
        const entry = granted.find(
            e => (e.spellName || "").toLowerCase().trim() === spellName.toLowerCase().trim()
        );
        if (!entry?.uuid) {
            ui.notifications.warn(`Could not find spell "${spellName}" for domain. It may not be in the spells compendium.`);
            return;
        }
        try {
            const spellDoc = await foundry.utils.fromUuid(entry.uuid);
            if (spellDoc && spellDoc.type === "spell") {
                const clone = spellDoc.toObject();
                delete clone._id;
                await this.actor.createEmbeddedDocuments("Item", [clone]);
                await this.actor.prepareData();
                await this.render();
                ui.notifications.info(`Added ${spellName} to your character.`);
            }
        } catch (err) {
            console.warn("Third Era | Failed to add placeholder spell:", err);
            ui.notifications.error(`Could not add ${spellName}. Check the console.`);
        }
    }

    /**
     * Add a spell to the shortlist for a full-list prepared caster (Ready to cast panel).
     * @param {PointerEvent} event
     * @param {HTMLElement} target   Element with data-action="addToShortlist" data-item-id, data-class-item-id
     */
    static async #onAddToShortlist(event, target) {
        const itemId = target.closest("[data-item-id]")?.dataset?.itemId || target.dataset?.itemId;
        const classItemId = target.dataset?.classItemId?.trim();
        if (!itemId || !classItemId) return;
        const item = this.actor.items.get(itemId);
        if (!item || item.type !== "spell") return;
        const sheetBody = this.element?.querySelector(".sheet-body");
        const scrollTop = sheetBody?.scrollTop ?? 0;
        const shortlist = { ...(this.actor.system.spellShortlistByClass || {}) };
        const list = Array.isArray(shortlist[classItemId]) ? [...shortlist[classItemId]] : [];
        if (list.includes(itemId)) return;
        list.push(itemId);
        shortlist[classItemId] = list;
        await this.actor.update({ "system.spellShortlistByClass": shortlist });
        await this.actor.prepareData();
        await this.render();
        this.element?.querySelector(".sheet-body")?.scrollTo({ top: scrollTop });
    }

    /**
     * Remove a spell from the shortlist for a full-list prepared caster.
     * @param {PointerEvent} event
     * @param {HTMLElement} target   Element with data-action="removeFromShortlist" data-item-id, data-class-item-id
     */
    static async #onRemoveFromShortlist(event, target) {
        const itemId = target.closest("[data-item-id]")?.dataset?.itemId || target.dataset?.itemId;
        const classItemId = target.dataset?.classItemId?.trim();
        if (!itemId || !classItemId) return;
        const sheetBody = this.element?.querySelector(".sheet-body");
        const scrollTop = sheetBody?.scrollTop ?? 0;
        const shortlist = { ...(this.actor.system.spellShortlistByClass || {}) };
        const list = Array.isArray(shortlist[classItemId]) ? shortlist[classItemId].filter((id) => id !== itemId) : [];
        shortlist[classItemId] = list;
        await this.actor.update({ "system.spellShortlistByClass": shortlist });
        await this.actor.prepareData();
        await this.render();
        this.element?.querySelector(".sheet-body")?.scrollTo({ top: scrollTop });
    }

    /**
     * Toggle a spell in the shortlist for a full-list prepared caster (add if absent, remove if present).
     * @param {PointerEvent} event
     * @param {HTMLElement} target   Element with data-action="toggleShortlist" data-item-id, data-class-item-id
     */
    static async #onToggleShortlist(event, target) {
        event.preventDefault();
        const itemId = target.closest("[data-item-id]")?.dataset?.itemId || target.dataset?.itemId;
        const classItemId = target.dataset?.classItemId?.trim();
        if (!itemId || !classItemId) return;
        const sheetBody = this.element?.querySelector(".sheet-body");
        const scrollTop = sheetBody?.scrollTop ?? 0;
        const shortlist = { ...(this.actor.system.spellShortlistByClass || {}) };
        const list = Array.isArray(shortlist[classItemId]) ? [...shortlist[classItemId]] : [];
        const inList = list.includes(itemId);
        if (inList) {
            shortlist[classItemId] = list.filter((id) => id !== itemId);
        } else {
            list.push(itemId);
            shortlist[classItemId] = list;
        }
        await this.actor.update({ "system.spellShortlistByClass": shortlist });
        await this.actor.prepareData();
        await this.render();
        this.element?.querySelector(".sheet-body")?.scrollTo({ top: scrollTop });
    }
}
