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

// Import document classes
import { ThirdEraActor } from "./module/documents/actor.mjs";
import { ThirdEraItem } from "./module/documents/item.mjs";

// Import sheet classes
import { ThirdEraActorSheet } from "./module/sheets/actor-sheet.mjs";
import { ThirdEraItemSheet } from "./module/sheets/item-sheet.mjs";
import { AuditLog } from "./module/logic/audit-log.mjs";
import { CompendiumLoader } from "./module/logic/compendium-loader.mjs";
import { populateCompendiumCache } from "./module/logic/domain-spells.mjs";

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

    // Register custom Document classes
    CONFIG.Actor.documentClass = ThirdEraActor;
    CONFIG.Item.documentClass = ThirdEraItem;

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
        }
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
        school: SchoolData
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
        school: "THIRDERA.TYPES.Item.school"
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
        "systems/thirdera/templates/partials/scaling-table.hbs"
    ]);

    console.log("Third Era | System initialized");
});

/**
 * Ready hook
 */
Hooks.once("ready", async function () {
    console.log("Third Era | System ready");
    
    // Load compendiums from JSON files if they're empty
    await CompendiumLoader.init();
    // Populate domain-spells cache so getSpellsForDomain is sync in prepareDerivedData
    await populateCompendiumCache();
});

/**
 * When a spell is updated (e.g. levelsByDomain changed), refresh the domain-spells cache and
 * re-render any open domain sheets so the "Granted spells" list updates immediately.
 */
Hooks.on("updateItem", async (document, changes, options, userId) => {
    if (document.type !== "spell") return;
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
    const { rollType, actorId, itemId, itemName, sceneId, tokenId } = data;

    // Build the macro label and icon
    const labels = {
        weaponAttack: { name: `Attack: ${itemName}`, icon: "icons/skills/melee/blade-tip-orange.webp" },
        weaponDamage: { name: `Damage: ${itemName}`, icon: "icons/skills/melee/strike-blade-orange.webp" },
        skillCheck: { name: `Skill: ${itemName}`, icon: "icons/skills/targeting/crosshair-bars-yellow.webp" }
    };
    const label = labels[rollType] || { name: itemName, icon: "icons/svg/dice-target.svg" };

    // Build the macro script — resolves actor from token or world at runtime
    const command = `// Third Era ${rollType} macro
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

    // Concatenate strings
    Handlebars.registerHelper("concat", function (...args) {
        args.pop(); // Remove Handlebars options object
        return args.join("");
    });

    Handlebars.registerHelper("capitalize", function (str) {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
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
 * Add Delete button to Item Directory
 */
Hooks.on("renderItemDirectory", (app, html, data) => {
    _addSidebarDeleteButton(app, html, "Item");
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
