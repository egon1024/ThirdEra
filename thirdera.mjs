/**
 * Third Era Game System for Foundry VTT
 * D&D 3.5 Edition SRD Implementation
 */

// Import data models
import { CharacterData } from "./module/data/actor-character.mjs";
import { NPCData } from "./module/data/actor-npc.mjs";
import { WeaponData } from "./module/data/item-weapon.mjs";
import { ArmorData } from "./module/data/item-armor.mjs";
import { EquipmentData } from "./module/data/item-equipment.mjs";
import { SpellData } from "./module/data/item-spell.mjs";
import { FeatData } from "./module/data/item-feat.mjs";
import { SkillData } from "./module/data/item-skill.mjs";
import { RaceData } from "./module/data/item-race.mjs";
import { ClassData } from "./module/data/item-class.mjs";
import { FeatureData } from "./module/data/item-feature.mjs";
import { DomainData } from "./module/data/item-domain.mjs";
import { SchoolData } from "./module/data/item-school.mjs";
import { ConditionData } from "./module/data/item-condition.mjs";
import { CreatureTypeData } from "./module/data/item-creature-type.mjs";
import { SubtypeData } from "./module/data/item-subtype.mjs";

// Import document classes
import { ThirdEraActor } from "./module/documents/actor.mjs";
import { ThirdEraItem } from "./module/documents/item.mjs";

// Import sheet classes
import { ThirdEraActorSheet } from "./module/sheets/actor-sheet.mjs";
import { ThirdEraItemSheet } from "./module/sheets/item-sheet.mjs";
import { AuditLog } from "./module/logic/audit-log.mjs";
import { CompendiumLoader } from "./module/logic/compendium-loader.mjs";
import { migrateAllRaceStockDeltas } from "./module/logic/race-srd-changes-merge.mjs";
import { migrateAllRaceQualitativeTraits } from "./module/logic/race-qualitative-traits-stock.mjs";
import { populateCompendiumCache } from "./module/logic/domain-spells.mjs";
import {
    syncDerivedFlatFootedCondition,
    syncDerivedHpCondition,
    syncFlatFootedForCombat,
    removeDerivedFlatFooted
} from "./module/logic/derived-conditions.mjs";
import { registerModifierSourceProviders } from "./module/logic/modifier-aggregation.mjs";
import { registerCapabilitySourceProviders } from "./module/logic/capability-aggregation.mjs";
import {
    cgsActorCgsGrantsSensesProvider,
    cgsNpcStatBlockSensesProvider
} from "./module/logic/cgs-actor-capability-providers.mjs";
import { cgsConditionsCapabilityProvider } from "./module/logic/cgs-conditions-capability-provider.mjs";
import { cgsEmbeddedItemGrantsProvider } from "./module/logic/cgs-embedded-item-grants-provider.mjs";
import { ApplyDamageHealingDialog } from "./module/applications/apply-damage-healing-dialog.mjs";
import { fuzzyScore } from "./module/utils/fuzzy.mjs";
import { registerTokenDimensionHooks } from "./module/logic/token-dimensions-from-size-hooks.mjs";
import {
    createDefaultCgsRefreshDeps,
    refreshCapabilityGrantsForActor,
    refreshCapabilityGrantDependentsFromItem,
    resolveParentActorForItem,
    registerCgsCapabilityRefreshHooks
} from "./module/logic/cgs-refresh-hooks.mjs";
import "./module/logic/apply-damage-healing-entry-points.mjs";
import "./module/logic/spell-save-from-chat.mjs";
import "./module/logic/concentration-from-chat.mjs";
import "./module/logic/spell-sr-from-chat.mjs";

const cgsRefreshDeps = createDefaultCgsRefreshDeps();

/**
 * Initialize HP auto-increase system
 * Automatically increases current HP when max HP increases (from leveling, constitution changes, etc.)
 */
function initHpAutoIncrease() {
    // Store old max HP values before updates
    const oldMaxHpMap = new Map();
    // Track documents currently being updated by our hook to prevent infinite loops
    const updatingHp = new Set();
    
    // Capture old max HP before update
    Hooks.on("preUpdateActor", (document, changes, options, userId) => {
        // Only track character actors
        if (document.type !== "character") return;
        
        // Skip if this is just a current HP update (to avoid infinite loops)
        const changeKeys = Object.keys(foundry.utils.flattenObject(changes));
        const isOnlyCurrentHpUpdate = changeKeys.length === 1 && 
            changeKeys[0] === "system.attributes.hp.value";
        if (isOnlyCurrentHpUpdate || updatingHp.has(document.id)) return;
        
        // Store the current max HP (before prepareDerivedData runs)
        const currentMaxHp = document.system.attributes.hp.max;
        oldMaxHpMap.set(document.id, currentMaxHp);
    });
    
    // Adjust current HP after update (prepareDerivedData has run by this point)
    Hooks.on("updateActor", async (document, changes, options, userId) => {
        // Only process character actors
        if (document.type !== "character") return;
        
        // Skip if this is just a current HP update (to avoid processing our own updates)
        const changeKeys = Object.keys(foundry.utils.flattenObject(changes));
        const isOnlyCurrentHpUpdate = changeKeys.length === 1 && 
            changeKeys[0] === "system.attributes.hp.value";
        if (isOnlyCurrentHpUpdate || updatingHp.has(document.id)) return;
        
        // Get the old max HP we stored
        const oldMaxHp = oldMaxHpMap.get(document.id);
        if (oldMaxHp === undefined) return; // No old value stored, skip
        
        // Clean up the stored value
        oldMaxHpMap.delete(document.id);
        
        // Get the new max HP (prepareDerivedData has run, so this is the updated value)
        const newMaxHp = document.system.attributes.hp.max;
        
        // If max HP increased, increase current HP by the same amount
        if (newMaxHp > oldMaxHp) {
            const hpIncrease = newMaxHp - oldMaxHp;
            const currentHp = document.system.attributes.hp.value;
            const newCurrentHp = Math.min(currentHp + hpIncrease, newMaxHp);
            
            // Update current HP if it changed
            if (newCurrentHp !== currentHp) {
                updatingHp.add(document.id);
                try {
                    await document.update({ "system.attributes.hp.value": newCurrentHp });
                } finally {
                    updatingHp.delete(document.id);
                }
            }
        }
    });
}

/**
 * Initialize the Third Era system
 */
Hooks.once("init", async function () {
    console.log("Third Era | Initializing Third Era Game System");

    // Initialize logic modules
    AuditLog.init();
    initHpAutoIncrease();
    registerTokenDimensionHooks();
    registerCgsCapabilityRefreshHooks();

    // Register custom Document classes
    CONFIG.Actor.documentClass = ThirdEraActor;
    CONFIG.Item.documentClass = ThirdEraItem;

    // Expose Apply damage/healing dialog for macros/console and Phase 2 entry points
    Hooks.on("ready", () => {
        game.thirdera = game.thirdera ?? {};
        game.thirdera.applyDamageHealing = {
            openDialog: () => ApplyDamageHealingDialog.openForSelection(),
            openWithOptions: (options) => ApplyDamageHealingDialog.openWithOptions(options)
        };
    });

    // Define THIRDERA configuration
    CONFIG.THIRDERA = {
        AbilityScores: {
            str: "Strength",
            dex: "Dexterity",
            con: "Constitution",
            int: "Intelligence",
            wis: "Wisdom",
            cha: "Charisma"
        },
        Saves: {
            fort: "Fortitude",
            ref: "Reflex",
            will: "Will"
        },
        armorTypes: {
            light: "Light Armor",
            medium: "Medium Armor",
            heavy: "Heavy Armor",
            shield: "Shield"
        },
        alignments: {
            "": "—",
            "Lawful Good": "Lawful Good",
            "Neutral Good": "Neutral Good",
            "Chaotic Good": "Chaotic Good",
            "Lawful Neutral": "Lawful Neutral",
            "True Neutral": "True Neutral",
            "Chaotic Neutral": "Chaotic Neutral",
            "Lawful Evil": "Lawful Evil",
            "Neutral Evil": "Neutral Evil",
            "Chaotic Evil": "Chaotic Evil"
        },
        sizes: {
            Fine: "Fine",
            Diminutive: "Diminutive",
            Tiny: "Tiny",
            Small: "Small",
            Medium: "Medium",
            Large: "Large",
            Huge: "Huge",
            Gargantuan: "Gargantuan",
            Colossal: "Colossal"
        },
        weaponHandedness: {
            light: "Light",
            oneHanded: "One-Handed",
            twoHanded: "Two-Handed"
        },
        weaponHand: {
            none: "Not Equipped",
            primary: "Primary Hand",
            offhand: "Off-Hand"
        },
        sizeModifiers: {
            Fine: 8,
            Diminutive: 4,
            Tiny: 2,
            Small: 1,
            Medium: 0,
            Large: -1,
            Huge: -2,
            Gargantuan: -4,
            Colossal: -8
        },
        /** Damage types for natural attacks (and weapon display). */
        damageTypes: {
            bludgeoning: "Bludgeoning",
            slashing: "Slashing",
            piercing: "Piercing",
            "bludgeoning and piercing": "Bludgeoning and piercing",
            "bludgeoning and slashing": "Bludgeoning and slashing",
            "slashing and piercing": "Slashing and piercing"
        },
        /** Fly maneuverability (SRD). Used for NPC/monster movement. */
        movementManeuverability: {
            "": "—",
            perfect: "Perfect",
            good: "Good",
            average: "Average",
            poor: "Poor",
            clumsy: "Clumsy"
        },
        /** Sense types for NPC/monster stat block (Phase E). */
        senseTypes: {
            darkvision: "Darkvision",
            lowLight: "Low-light vision",
            scent: "Scent",
            blindsight: "Blindsight",
            blindsense: "Blindsense",
            tremorsense: "Tremorsense"
        },
        /** Treasure presets for NPC/monster reference (Phase F). Custom text allowed via sheet. */
        treasure: {
            "": "—",
            "None": "None",
            "Standard": "Standard",
            "Double": "Double",
            "Triple": "Triple"
        },
        hitDice: {
            d4: "d4",
            d6: "d6",
            d8: "d8",
            d10: "d10",
            d12: "d12"
        },
        babProgressions: {
            good: "Good (+1/level)",
            average: "Average (+3/4 levels)",
            poor: "Poor (+1/2 levels)"
        },
        saveProgressions: {
            good: "Good (+2 + level/2)",
            poor: "Poor (+level/3)"
        },
        casterTypes: {
            none: "None",
            arcane: "Arcane",
            divine: "Divine"
        },
        preparationTypes: {
            none: "None",
            prepared: "Prepared",
            spontaneous: "Spontaneous"
        },
        spellListAccessTypes: {
            none: "None",
            full: "Full list (all spells at level)",
            learned: "Learned (spellbook or spells known)"
        },
        castingAbilities: {
            none: "None",
            int: "Intelligence",
            wis: "Wisdom",
            cha: "Charisma"
        },
        /** Spell list keys for looking up per-class spell levels. Sorcerer and Wizard share the same list. */
        spellListKeys: {
            sorcererWizard: "Sorcerer/Wizard",
            bard: "Bard",
            cleric: "Cleric",
            druid: "Druid",
            paladin: "Paladin",
            ranger: "Ranger"
        },
        /** Spell Resistance choices for spells. Keys are machine-readable for future automation. */
        spellResistanceChoices: {
            "": "—",
            yes: "Yes",
            no: "No",
            "yes-harmless": "Yes (harmless)",
            "no-object": "No (object)",
            "see-text": "See text"
        },
        /** SRD schools of magic (fallback when school items not loaded). */
        schools: {
            abjuration: "Abjuration",
            conjuration: "Conjuration",
            divination: "Divination",
            enchantment: "Enchantment",
            evocation: "Evocation",
            illusion: "Illusion",
            necromancy: "Necromancy",
            transmutation: "Transmutation"
        },
        /** Set of status IDs from condition items; populated in ready. Used to identify condition effects on actors. */
        conditionStatusIds: new Set(),
        /** Canonical modifier keys for the unified modifier system. See module/logic/modifier-aggregation.mjs and docs-site/development.md. */
        modifierKeys: null,
        /** Registry of modifier-source providers: (actor) => Array<{ label, changes }>. Populated at init by modifier-aggregation. */
        modifierSourceProviders: [],
        /** Frozen list of CGS output category keys. Set at init by capability-aggregation. */
        capabilityGrantCategoryIds: null,
        /** Registry of capability grant providers: (actor) => contributions[]. Phase 1: empty; later phases add built-ins. */
        capabilitySourceProviders: []
    };

    // Register World Settings
    game.settings.register("thirdera", "currencyWeight", {
        name: "THIRDERA.Settings.CurrencyWeight.Name",
        hint: "THIRDERA.Settings.CurrencyWeight.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: () => {
            // Trigger a re-render of all actors to update weight calculations
            for (const actor of game.actors) {
                actor.prepareData();
                actor.render(false);
            }
        }
    });

    game.settings.register("thirdera", "auditLogEnabled", {
        name: "THIRDERA.Settings.AuditLogEnabled.Name",
        hint: "THIRDERA.Settings.AuditLogEnabled.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("thirdera", "auditLogFilterGM", {
        name: "THIRDERA.Settings.AuditLogFilterGM.Name",
        hint: "THIRDERA.Settings.AuditLogFilterGM.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register("thirdera", "firstLevelFullHp", {
        name: "THIRDERA.Settings.FirstLevelFullHp.Name",
        hint: "THIRDERA.Settings.FirstLevelFullHp.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    // Register data models
    CONFIG.Actor.dataModels = {
        character: CharacterData,
        npc: NPCData
    };

    CONFIG.Item.dataModels = {
        weapon: WeaponData,
        armor: ArmorData,
        equipment: EquipmentData,
        spell: SpellData,
        feat: FeatData,
        feature: FeatureData,
        skill: SkillData,
        race: RaceData,
        class: ClassData,
        domain: DomainData,
        school: SchoolData,
        condition: ConditionData,
        creatureType: CreatureTypeData,
        subtype: SubtypeData
    };

    // Register item type labels for the creation menu
    CONFIG.Item.typeLabels = {
        weapon: "THIRDERA.TYPES.Item.weapon",
        armor: "THIRDERA.TYPES.Item.armor",
        equipment: "THIRDERA.TYPES.Item.equipment",
        spell: "THIRDERA.TYPES.Item.spell",
        feat: "THIRDERA.TYPES.Item.feat",
        feature: "THIRDERA.TYPES.Item.feature",
        skill: "THIRDERA.TYPES.Item.skill",
        race: "THIRDERA.TYPES.Item.race",
        class: "THIRDERA.TYPES.Item.class",
        domain: "THIRDERA.TYPES.Item.domain",
        school: "THIRDERA.TYPES.Item.school",
        condition: "THIRDERA.TYPES.Item.condition",
        creatureType: "THIRDERA.TYPES.Item.creatureType",
        subtype: "THIRDERA.TYPES.Item.subtype"
    };

    // Register sheet application classes
    foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, "thirdera", ThirdEraActorSheet, {
        makeDefault: true,
        label: "THIRDERA.SheetLabels.Actor"
    });

    foundry.applications.apps.DocumentSheetConfig.registerSheet(Item, "thirdera", ThirdEraItemSheet, {
        makeDefault: true,
        label: "THIRDERA.SheetLabels.Item"
    });

    // Register Handlebars helpers
    registerHandlebarsHelpers();

    // Register Handlebars partials
    await foundry.applications.handlebars.loadTemplates([
        "systems/thirdera/templates/partials/editor-box.hbs",
        "systems/thirdera/templates/partials/scaling-table.hbs",
        "systems/thirdera/templates/partials/spell-search.hbs",
        "systems/thirdera/templates/partials/mechanical-effects-table.hbs",
        "systems/thirdera/templates/partials/cgs-merged-senses.hbs",
        "systems/thirdera/templates/partials/cgs-legacy-statblock-senses.hbs",
        "systems/thirdera/templates/partials/cgs-mechanics-senses.hbs",
        "systems/thirdera/templates/apps/spell-list-browser.hbs",
        "systems/thirdera/templates/apps/skill-picker-dialog.hbs"
    ]);

    // Register modifier-source providers after CONFIG.THIRDERA exists
    registerModifierSourceProviders();
    registerCapabilitySourceProviders();
    CONFIG.THIRDERA.capabilitySourceProviders.push(
        cgsNpcStatBlockSensesProvider,
        cgsActorCgsGrantsSensesProvider,
        cgsConditionsCapabilityProvider,
        cgsEmbeddedItemGrantsProvider
    );

    console.log("Third Era | System initialized");
});

/**
 * Build CONFIG.statusEffects from condition items (compendium + world) so Token HUD and
 * Actor.toggleStatusEffect(conditionId) work. Also sets CONFIG.THIRDERA.conditionStatusIds.
 * World condition items are included so custom conditions appear in the dropdown and support drag-drop.
 */
async function buildConditionStatusEffects() {
    const conditionIds = [];
    const seenIds = new Set();
    /** @type {Map<string, import("./module/documents/item.mjs").ThirdEraItem>} */
    const conditionItemsById = new Map();

    function addConditionItem(item) {
        if (item.type !== "condition") return;
        const rawId = item.system?.conditionId?.trim();
        const id = (rawId ? String(rawId).toLowerCase() : (item.id || "")).trim();
        if (!id) return;
        conditionItemsById.set(id, item);
        if (seenIds.has(id)) return;
        seenIds.add(id);
        CONFIG.statusEffects.push({
            id,
            name: item.name,
            img: item.img || "icons/svg/aura.svg"
        });
        conditionIds.push(id);
    }

    const pack = game.packs.get("thirdera.thirdera_conditions");
    if (pack) {
        const docs = await pack.getDocuments();
        for (const item of docs) addConditionItem(item);
    }
    for (const item of game.items?.contents ?? []) addConditionItem(item);

    CONFIG.THIRDERA.conditionStatusIds = new Set(conditionIds);
    CONFIG.THIRDERA.conditionItemsById = conditionItemsById;
}

/**
 * Resolve compendium index img paths so thumbnails load when the UI is under /game.
 * Relative paths like "icons/svg/shield.svg" are resolved with getRoute to be origin-relative
 * (e.g. "/icons/svg/shield.svg" or "/vtt/icons/...") so they don't 404 when requested from /game.
 * The UI uses the index populated from metadata at load (constructor), not getIndex(), so we must
 * resolve both the existing index and wrap getIndex for future refreshes.
 */
// Icons that don't exist in Foundry core — use shield instead so thumbnails don't 404.
const COMPENDIUM_MISSING_ICONS = new Set(["wolf.svg", "star.svg", "dodge.svg", "raven.svg", "run.svg"]);

function resolveIndexImgPaths(index) {
    const base = typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "";
    for (const entry of index.values()) {
        if (!entry.img) continue;
        const filename = (entry.img.split("/").pop() ?? "").split("?")[0];
        if (COMPENDIUM_MISSING_ICONS.has(filename)) entry.img = "icons/svg/shield.svg";
        const isRelative = !entry.img.startsWith("/") && !entry.img.startsWith("http");
        if (isRelative) {
            const path = foundry.utils.getRoute(entry.img);
            entry.img = base ? `${base}${path.startsWith("/") ? path : `/${path}`}` : path;
        }
    }
}

function applyCompendiumImageRouteFix() {
    for (const pack of game.packs) {
        if (!pack?.collection?.index) continue;

        // Resolve img on the index already in memory (from metadata at load).
        resolveIndexImgPaths(pack.collection.index);
        // Force tree rebuild so directory UI uses entries with resolved img (tree is built from index.contents).
        pack.initializeTree();

        const origGetIndex = pack.collection.getIndex.bind(pack.collection);
        pack.collection.getIndex = async function (options) {
            const index = await origGetIndex(options);
            resolveIndexImgPaths(index);
            this.initializeTree();
            return index;
        };
    }

    const base = window.location?.origin ?? "";
    const fixThumbnailSrc = (rawSrc) => {
        const filename = (rawSrc.split("/").pop() ?? "").split("?")[0];
        if (COMPENDIUM_MISSING_ICONS.has(filename)) return "icons/svg/shield.svg";
        return rawSrc;
    };
    const setThumbnailSrc = (img, rawSrc) => {
        const src = fixThumbnailSrc(rawSrc);
        const path = src.startsWith("/") ? src : foundry.utils.getRoute(src);
        img.setAttribute("src", `${base}${path.startsWith("/") ? path : `/${path}`}`);
    };

    // Fix any compendium thumbnail img that has a bad src (run on a single element or a root).
    const fixThumbnailsIn = (root) => {
        if (!root?.querySelectorAll) return;
        for (const img of root.querySelectorAll("img.thumbnail")) {
            const src = (img.getAttribute("src") ?? img.src ?? "").trim();
            if (!src || src.startsWith("data:")) continue;
            setThumbnailSrc(img, src);
        }
    };

    // Run when compendium app renders.
    Hooks.on("renderApplication", (app, html, data) => {
        if (!app?.options?.id?.startsWith("compendium-")) return;
        fixThumbnailsIn(app?.element ?? html);
        setTimeout(() => fixThumbnailsIn(app?.element), 0);
        setTimeout(() => fixThumbnailsIn(app?.element), 100);
    });

    // Fix thumbnails as soon as they are added to the DOM (before the browser requests the bad URL).
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (!node?.querySelectorAll) continue;
                if (node.classList?.contains("thumbnail") && node.tagName === "IMG") {
                    const src = (node.getAttribute("src") ?? node.src ?? "").trim();
                    if (src && !src.startsWith("data:")) setThumbnailSrc(node, src);
                }
                fixThumbnailsIn(node);
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // When a compendium thumbnail fails to load, replace with fallback icon so it displays.
    document.body.addEventListener(
        "error",
        (e) => {
            if (e.target?.tagName !== "IMG" || !e.target.classList?.contains("thumbnail")) return;
            const src = e.target.src || e.target.getAttribute("src") || "";
            const filename = (src.split("/").pop() ?? "").split("?")[0];
            if (COMPENDIUM_MISSING_ICONS.has(filename)) {
                setThumbnailSrc(e.target, "icons/svg/shield.svg");
            }
        },
        true
    );
}

/**
 * Ready hook
 */
Hooks.once("ready", async function () {
    console.log("Third Era | System ready");
    
    // Load compendiums from JSON files if they're empty
    await CompendiumLoader.init();
    // Merge bundled SRD skill/save/hide rows into existing race items (compendium + world + actors); does not replace documents.
    try {
        const raceDelta = await migrateAllRaceStockDeltas({ game });
        if (!raceDelta.skipped && (raceDelta.compendiumUpdated + raceDelta.worldUpdated + raceDelta.actorsUpdated) > 0) {
            console.log(
                "Third Era | Race SRD mechanical rows merged (existing items preserved): " +
                    `compendium ${raceDelta.compendiumUpdated} updated, ` +
                    `world ${raceDelta.worldUpdated} updated, ` +
                    `embedded ${raceDelta.actorsUpdated} updated`
            );
        }
    } catch (e) {
        console.warn("Third Era | Race stock delta migration error:", e);
    }
    try {
        const raceQual = await migrateAllRaceQualitativeTraits({ game });
        if (!raceQual.skipped && (raceQual.compendiumUpdated + raceQual.worldUpdated + raceQual.actorsUpdated) > 0) {
            console.log(
                "Third Era | Race qualitative traits (reference HTML) merged into empty fields: " +
                    `compendium ${raceQual.compendiumUpdated} updated, ` +
                    `world ${raceQual.worldUpdated} updated, ` +
                    `embedded ${raceQual.actorsUpdated} updated`
            );
        }
    } catch (e) {
        console.warn("Third Era | Race qualitative traits migration error:", e);
    }
    // Resolve compendium index img paths so thumbnails work from /game.
    applyCompendiumImageRouteFix();
    // Build CONFIG.statusEffects from condition items so Token HUD and toggleStatusEffect work
    await buildConditionStatusEffects();
    // Populate domain-spells cache so getSpellsForDomain is sync in prepareDerivedData
    await populateCompendiumCache();
    // Sync HP-derived and combat-derived conditions so actors load with correct state
    for (const actor of (game.actors?.contents ?? [])) {
        if (actor.system?.attributes?.hp) await syncDerivedHpCondition(actor);
    }
    await syncFlatFootedForCombat();
    // Re-render actor sheets so conditions and Ready to cast show on initial load.
    // Include sheets that are not yet rendered (no app.rendered check) so restored windows get correct data.
    function reRenderActorSheets() {
        const instances = foundry.applications?.instances;
        if (!instances) return;
        let count = 0;
        for (const app of instances.values()) {
            if (app.document?.documentName === "Actor" && game.system?.id === "thirdera") {
                app.render(true);
                count++;
            }
        }
    }
    reRenderActorSheets();
    // Staggered re-renders so sheets that register or finish restoring after ready are caught
    [0, 100, 300].forEach((delay) => setTimeout(reRenderActorSheets, delay));
});

/**
 * Sync HP-derived conditions (dead, dying, disabled, stable) when actor HP or stable flag changes.
 */
Hooks.on("updateActor", async (document, changes, options, userId) => {
    const flat = foundry.utils.flattenObject(changes);
    if ("system.attributes.hp.value" in flat || "system.attributes.hp.stable" in flat) {
        await syncDerivedHpCondition(document);
    }
});

/**
 * Sync flat-footed from combat when combat turn or combatants change.
 */
Hooks.on("updateCombat", async (combat, changes, options, userId) => {
    const flat = foundry.utils.flattenObject(changes);
    if ("turn" in flat || "combatants" in flat || "round" in flat) {
        await syncFlatFootedForCombat();
    }
});

/**
 * Remove combat-derived flat-footed from all actors when combat ends.
 */
Hooks.on("deleteCombat", async (combat, options, userId) => {
    for (const c of (combat.combatants ?? [])) {
        const actor = c.actor ?? game.actors.get(c.actorId);
        if (actor) await removeDerivedFlatFooted(actor);
    }
});

/**
 * When a spell is updated (e.g. levelsByDomain changed), refresh the domain-spells cache and
 * re-render any open domain sheets so the "Granted spells" list updates immediately.
 */
Hooks.on("updateItem", async (document, changes, options, userId) => {
    if (document.type === "condition") {
        const conditionId = (document.system?.conditionId ?? "").trim().toLowerCase();
        if (conditionId && game.actors) {
            for (const actor of game.actors) {
                const effects = actor.effects ?? [];
                const has = effects.some((e) => {
                    const s = e.statuses;
                    if (s instanceof Set) return s.has(conditionId);
                    if (Array.isArray(s)) return s.includes(conditionId);
                    return false;
                });
                if (has) await refreshCapabilityGrantsForActor(actor, cgsRefreshDeps);
            }
        }
        return;
    }
    if (document.type === "race") {
        await refreshCapabilityGrantDependentsFromItem(document, cgsRefreshDeps);
        return;
    }
    // Resolve parent actor: (1) document.parent/actor/collection.parent, (2) parse UUID "Actor.actorId.Item.itemId", or (3) resolve via fromUuid (embedded doc may have .parent).
    let actor = null;
    if (document.type === "feat") {
        actor = document.parent ?? document.actor ?? document.collection?.parent ?? null;
        if (!actor && document.uuid && typeof game !== "undefined" && game.actors) {
            const parts = String(document.uuid).split(".");
            if (parts[0] === "Actor" && parts[1]) {
                actor = game.actors.get(parts[1]) ?? null;
            }
            if (!actor && typeof foundry?.utils?.fromUuid === "function") {
                try {
                    const resolved = await foundry.utils.fromUuid(document.uuid);
                    actor = resolved?.parent ?? resolved?.actor ?? null;
                } catch (_) { /* ignore */ }
            }
        }
    }
    if (document.type === "feat" && actor) {
        await refreshCapabilityGrantsForActor(actor, cgsRefreshDeps);
        return;
    }
    // Armor, weapon, equipment: when an owned item is updated, refresh the actor so AC and other derived stats update.
    if (document.type === "armor" || document.type === "weapon" || document.type === "equipment") {
        let armorActor = document.parent ?? document.actor ?? document.collection?.parent ?? null;
        if (!armorActor && document.uuid && typeof game !== "undefined" && game.actors) {
            const parts = String(document.uuid).split(".");
            if (parts[0] === "Actor" && parts[1]) armorActor = game.actors.get(parts[1]) ?? null;
            if (!armorActor && typeof foundry?.utils?.fromUuid === "function") {
                try {
                    const resolved = await foundry.utils.fromUuid(document.uuid);
                    armorActor = resolved?.parent ?? resolved?.actor ?? null;
                } catch (_) { /* ignore */ }
            }
        }
        // Fallback: world item (uuid "Item.xxx") — find any actor that has an item with this id.
        const actorsToCheck = [...(game.actors?.contents ?? game.actors ?? [])];
        if (typeof canvas !== "undefined" && canvas.scene?.tokens) {
            for (const token of canvas.scene.tokens) {
                const tActor = token.actor;
                if (tActor && !actorsToCheck.find(a => a.id === tActor.id)) actorsToCheck.push(tActor);
            }
        }
        if (!armorActor && document.id && actorsToCheck.length) {
            for (const a of actorsToCheck) {
                const hasItem = a.items?.get(document.id);
                if (hasItem) {
                    armorActor = a;
                    break;
                }
            }
        }
        // Last resort: world item — sync to all actors so we don't miss one whose .items didn't iterate (e.g. Victor).
        const actorsToRefresh = [];
        if (armorActor) {
            actorsToRefresh.push(armorActor);
        } else if (document.type === "armor" || document.type === "weapon" || document.type === "equipment") {
            actorsToRefresh.push(...actorsToCheck);
        }
        // World item: sync this document's system data onto matching embedded items so AC/stats update
        const docUuid = document.uuid;
        const docName = (document.name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
        const docType = document.type;
        const systemData = document.system?.toObject?.() ?? document.system ?? {};
        const getActorItems = (actor) => {
            const c = actor?.items;
            if (!c) return [];
            if (Array.isArray(c)) return c;
            try {
                if (typeof c.contents !== "undefined" && Array.isArray(c.contents)) return c.contents;
                if (typeof c[Symbol.iterator] === "function") return Array.from(c);
                if (typeof c.values === "function") return Array.from(c.values());
                if (typeof c.get === "function" && typeof c.keys === "function") {
                    const out = [];
                    for (const id of c.keys()) out.push(c.get(id));
                    return out.filter(Boolean);
                }
                return [];
            } catch (_) {
                return [];
            }
        };
        const nameMatches = (itemName) => (itemName ?? "").trim().toLowerCase().replace(/\s+/g, " ") === docName;
        for (const a of actorsToRefresh) {
            const items = getActorItems(a);
            const sameType = (i) => i.type === docType || i._source?.type === docType || (docType === "armor" && i.system?.armor != null) || (docType === "weapon" && i.system?.weapon != null) || (docType === "equipment" && i.system?.equipment != null);
            let matching = items.filter((i) => sameType(i) && (i.sourceId === docUuid || nameMatches(i.name ?? i._source?.name)));
            if (matching.length === 0 && docType === "armor" && items.length) {
                const equippedArmor = items.filter((i) => (i.type === "armor" || i.system?.armor != null) && i.system?.equipped === "true");
                const byName = equippedArmor.filter((i) => nameMatches(i.name ?? i._source?.name));
                if (byName.length > 0) matching = byName;
                else if (equippedArmor.length === 1) matching = equippedArmor;
            }
            // World/pack items: push template system onto matching embedded copies. Embedded updates must not run this
            // (redundant; matching-by-name can also hit unrelated rows).
            if (!document.isEmbedded) {
                for (const item of matching) {
                    await item.update({ system: systemData });
                }
            }
            await refreshCapabilityGrantsForActor(a, cgsRefreshDeps);
        }
        return;
    }
    if (document.type !== "spell") {
        const skipCgsParentRefresh = new Set(["condition", "feat", "armor", "weapon", "equipment", "race"]);
        if (!skipCgsParentRefresh.has(document.type)) {
            const pa = await resolveParentActorForItem(document, cgsRefreshDeps);
            if (pa) await refreshCapabilityGrantsForActor(pa, cgsRefreshDeps);
        }
        return;
    }
    await populateCompendiumCache();
    const instances = foundry.applications?.instances;
    if (!instances) return;
    for (const app of instances.values()) {
        if (app.document?.type === "domain" && app.rendered) {
            app.render(true);
        }
    }
});

/**
 * Handle hotbar drops — create macros for weapon attack/damage and skill check rolls
 */
Hooks.on("hotbarDrop", (bar, data, slot) => {
    if (data.type !== "ThirdEraRoll") return;
    createThirdEraMacro(data, slot);
    return false;
});

/**
 * Create a macro from hotbar drop data
 * @param {Object} data   The drag data
 * @param {number} slot   The hotbar slot
 */
async function createThirdEraMacro(data, slot) {
    const { rollType, actorId, itemId, itemName, sceneId, tokenId, classItemId, spellLevel } = data;

    // Build the macro label and icon
    const labels = {
        weaponAttack: { name: `Attack: ${itemName}`, icon: "icons/skills/melee/blade-tip-orange.webp" },
        weaponDamage: { name: `Damage: ${itemName}`, icon: "icons/skills/melee/strike-blade-orange.webp" },
        skillCheck: { name: `Skill: ${itemName}`, icon: "icons/skills/targeting/crosshair-bars-yellow.webp" },
        spellCast: { name: `Cast: ${itemName}`, icon: "icons/svg/book.svg" }
    };
    const label = labels[rollType] || { name: itemName, icon: "icons/svg/dice-target.svg" };

    // Build the macro script — resolves actor from token or world at runtime
    let command;
    if (rollType === "spellCast") {
        const cid = (classItemId || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        const sl = (spellLevel ?? "").toString().replace(/"/g, '\\"');
        command = `// Third Era spell cast macro
const speaker = ChatMessage.implementation.getSpeaker();
let actor;
if (speaker.token) {
    const scene = game.scenes.get(speaker.scene);
    const token = scene?.tokens.get(speaker.token);
    actor = token?.actor;
}
actor ??= game.actors.get("${actorId}");
if (!actor) return ui.notifications.warn("No actor found for this macro.");
const item = actor.items.get("${itemId}") ?? actor.items.find(i => i.name === "${itemName.replace(/"/g, '\\"')}");
if (!item || item.type !== "spell") return ui.notifications.warn("${itemName.replace(/"/g, '\\"')} not found on " + actor.name);
await actor.castSpell(item, { classItemId: "${cid}", spellLevel: "${sl}" });`;
    } else {
        command = `// Third Era ${rollType} macro
const speaker = ChatMessage.implementation.getSpeaker();
let actor;
if (speaker.token) {
    const scene = game.scenes.get(speaker.scene);
    const token = scene?.tokens.get(speaker.token);
    actor = token?.actor;
}
actor ??= game.actors.get("${actorId}");
if (!actor) return ui.notifications.warn("No actor found for this macro.");
const item = actor.items.get("${itemId}") ?? actor.items.find(i => i.name === "${itemName.replace(/"/g, '\\"')}");
if (!item) return ui.notifications.warn("${itemName.replace(/"/g, '\\"')} not found on " + actor.name);
${rollType === "weaponAttack" ? "item.rollAttack();" : rollType === "weaponDamage" ? "item.rollDamage();" : `actor.rollSkillCheck("${itemName.replace(/"/g, '\\"')}");`}`;
    }

    // Check for an existing macro with the same name
    let macro = game.macros.find(m => m.name === label.name && m.command === command);
    if (!macro) {
        macro = await Macro.implementation.create({
            name: label.name,
            type: "script",
            img: label.icon,
            command,
            flags: { "thirdera.rollMacro": true }
        });
    }
    game.user.assignHotbarMacro(macro, slot);
}

/**
 * Register Handlebars helpers
 */
function registerHandlebarsHelpers() {
    // Calculate ability modifier
    Handlebars.registerHelper("abilityMod", function (score) {
        return Math.floor((score - 10) / 2);
    });

    // Format modifier with sign
    Handlebars.registerHelper("signedNumber", function (num) {
        const n = Number(num);
        return n >= 0 ? `+${n}` : `${n}`;
    });

    // Check if value equals another value
    Handlebars.registerHelper("eq", function (a, b) {
        return a === b;
    });

    Handlebars.registerHelper("gt", function (a, b) {
        return Number(a) > Number(b);
    });

    Handlebars.registerHelper("gte", function (a, b) {
        return Number(a) >= Number(b);
    });

    // Phase 6: mechanical effects key type "Skill" and skill picker
    Handlebars.registerHelper("skillKeyForSelect", function (key) {
        return (key || "").startsWith("skill.") ? "skill" : (key || "");
    });
    Handlebars.registerHelper("isSkillKey", function (key) {
        const k = key || "";
        return k === "skill" || k.startsWith("skill.");
    });
    Handlebars.registerHelper("skillKeySuffix", function (key) {
        return (key || "").startsWith("skill.") ? (key || "").slice(6) : "";
    });
    /** Resolve skill key (e.g. "skill.appraise") to display name from world items; fallback to capitalized key suffix. */
    Handlebars.registerHelper("skillNameForKey", function (key) {
        const full = key || "";
        const suffix = full.startsWith("skill.") ? full.slice(6).trim() : "";
        if (!suffix) return "";
        const items = typeof game !== "undefined" && game.items?.contents ? game.items.contents : [];
        const skill = items.find((i) => i.type === "skill" && (i.system?.key ?? "").toLowerCase() === suffix.toLowerCase());
        if (skill?.name) return skill.name;
        return suffix.charAt(0).toUpperCase() + suffix.slice(1).toLowerCase();
    });

    Handlebars.registerHelper("length", function (arr) {
        return Array.isArray(arr) ? arr.length : 0;
    });

    Handlebars.registerHelper("or", function (...args) {
        const options = args.pop();
        return args.some(Boolean);
    });

    // Concatenate strings
    Handlebars.registerHelper("concat", function (...args) {
        args.pop(); // Remove Handlebars options object
        return args.join("");
    });

    Handlebars.registerHelper("capitalize", function (str) {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    // Ordinal for spell level labels: 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th", etc. Accepts string or number.
    Handlebars.registerHelper("ordinal", function (n) {
        const i = parseInt(n, 10);
        if (Number.isNaN(i) || i === 0) return String(n);
        const j = i % 10, k = i % 100;
        if (j === 1 && k !== 11) return i + "st";
        if (j === 2 && k !== 12) return i + "nd";
        if (j === 3 && k !== 13) return i + "rd";
        return i + "th";
    });

    // Group arcane spells by school for sub-headers. Returns [{ schoolName, spells }, ...] or empty array.
    // Used in Spell List Browser for arcane casters.
    Handlebars.registerHelper("spellSchoolGroups", function (spells, isArcane) {
        if (!isArcane || !Array.isArray(spells)) return [];
        const bySchool = new Map();
        for (const s of spells) {
            const school = (s.schoolName || "(No school)").trim() || "(No school)";
            if (!bySchool.has(school)) bySchool.set(school, []);
            bySchool.get(school).push(s);
        }
        const schools = [...bySchool.keys()].sort((a, b) => a.localeCompare(b));
        return schools.map((school) => ({ schoolName: school, spells: bySchool.get(school) }));
    });

}

/* -------------------------------------------- */
/*  Sidebar Directory Enhancements              */
/* -------------------------------------------- */

/**
 * Add Delete button to Actor Directory
 */
Hooks.on("renderActorDirectory", (app, html, data) => {
    _addSidebarDeleteButton(app, html, "Actor");
});

/**
 * Add Delete button and Spell List button to Item Directory
 */
Hooks.on("renderItemDirectory", (app, html, data) => {
    _addSidebarDeleteButton(app, html, "Item");
    _addSpellListButton(html);
});

/**
 * Helper to inject delete button into sidebar directories
 * @param {Application} app   The sidebar directory application
 * @param {jQuery} html       The rendered HTML
 * @param {string} type       The document type (Actor/Item)
 */
function _addSidebarDeleteButton(app, html, type) {
    const directoryItems = $(html).find(".directory-item.document");

    directoryItems.each((index, element) => {
        const li = $(element);
        // Get entryId from data attribute (try multiple methods for compatibility)
        const entryId = element.dataset?.entryId || li.data("entryId") || li.attr("data-entry-id");

        // Check if button already exists
        if (li.find(".document-delete").length) return;

        // Create delete button
        const deleteBtn = $(`<a class="document-delete" title="Delete ${type}"><i class="fas fa-trash"></i></a>`);

        // Style the button
        deleteBtn.css({
            "flex": "0 0 24px",
            "text-align": "center",
            "color": "#4b4a44",
            "line-height": "32px"
        });

        // Add hover effect
        deleteBtn.hover(
            function () { $(this).css("color", "#d00"); },
            function () { $(this).css("color", "#4b4a44"); }
        );

        deleteBtn.click(async (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (!entryId) return;

            // Get the document from the appropriate collection
            let document = null;
            if (type === "Item") {
                document = game.items.get(entryId);
            } else if (type === "Actor") {
                document = game.actors.get(entryId);
            }

            if (document) {
                const confirmed = await foundry.applications.api.DialogV2.confirm({
                    window: { title: `Delete ${type}: ${document.name}` },
                    content: `<h4>Are you sure you want to delete this ${type}?</h4><p>This action cannot be undone.</p>`,
                    rejectClose: false,
                    modal: true
                });

                if (confirmed) {
                    await document.delete();
                }
            }
        });

        // Insert before the standard creation/edit controls if they exist, or just append
        li.append(deleteBtn);
    });
}

/**
 * Add Spell List button to Item Directory header.
 * @param {HTMLElement|jQuery} html - The rendered directory HTML
 */
function _addSpellListButton(html) {
    const el = html?.jquery ? html[0] : html;
    const headerActions = el?.querySelector?.(".header-actions");
    if (!headerActions) return;
    if (headerActions.querySelector?.(".spell-list-browser-btn")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "spell-list-browser-btn create-entry";
    btn.innerHTML = '<i class="fa-solid fa-book-sparkles" inert></i><span data-i18n="THIRDERA.SpellListBrowser.Button">Spell List</span>';
    btn.title = game.i18n.localize("THIRDERA.SpellListBrowser.Button");
    btn.addEventListener("click", async () => {
        const { SpellListBrowser } = await import("./module/applications/spell-list-browser.mjs");
        new SpellListBrowser().render(true);
    });
    headerActions.appendChild(btn);
}

function ensureMonsterFuzzyStyle() {
    if (document.getElementById("thirdera-monster-fuzzy-style")) return;
    const style = document.createElement("style");
    style.id = "thirdera-monster-fuzzy-style";
    style.textContent = ".thirdera-fuzzy-force-show{display:flex !important;}";
    document.head.appendChild(style);
}

/**
 * Add fuzzy search behavior to the monster compendium window.
 * Foundry default search remains active for other compendiums.
 */
Hooks.on("renderCompendium", (app, html) => {
    const root = app?.element?.jquery ? app.element[0] : app?.element ?? html?.[0] ?? html;
    const isMonsterPack = String(app?.id ?? "") === "compendium-thirdera_thirdera_monsters";
    if (!isMonsterPack || !root?.querySelector) return;
    ensureMonsterFuzzyStyle();
    const searchInput = root.querySelector('input[name="search"]') ?? root.querySelector(".header-search input");
    if (!searchInput || searchInput.dataset.thirderaMonsterFuzzyBound === "true") return;
    searchInput.dataset.thirderaMonsterFuzzyBound = "true";
    const applyMonsterFuzzyFilter = () => {
        const query = String(searchInput.value ?? "").trim();
        const rows = root.querySelectorAll("li.directory-item, li.compendium-entry, li.document");
        for (const row of rows) {
            const name = String((row.querySelector(".entry-name, .document-name, h4, a")?.textContent ?? "")).trim();
            if (!query) {
                row.classList.remove("hidden");
                row.classList.remove("thirdera-fuzzy-force-show");
                row.hidden = false;
                row.setAttribute("aria-hidden", "false");
                row.style.display = "";
                continue;
            }
            const score = fuzzyScore(query, name);
            row.classList.toggle("hidden", !score.matched);
            row.classList.toggle("thirdera-fuzzy-force-show", score.matched);
            row.hidden = !score.matched;
            row.setAttribute("aria-hidden", score.matched ? "false" : "true");
            row.style.display = score.matched ? "" : "none";
        }
    };
    searchInput.addEventListener("input", applyMonsterFuzzyFilter);
    searchInput.addEventListener("keyup", applyMonsterFuzzyFilter);
    applyMonsterFuzzyFilter();
});

