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

// Import document classes
import { ThirdEraActor } from "./module/documents/actor.mjs";
import { ThirdEraItem } from "./module/documents/item.mjs";

// Import sheet classes
import { ThirdEraActorSheet } from "./module/sheets/actor-sheet.mjs";
import { ThirdEraItemSheet } from "./module/sheets/item-sheet.mjs";

/**
 * Initialize the Third Era system
 */
Hooks.once("init", async function () {
    console.log("Third Era | Initializing Third Era Game System");

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
        class: ClassData
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
Hooks.once("ready", function () {
    console.log("Third Era | System ready");
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
        const documentId = li.data("documentId");

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

            const document = app.documents.get(documentId);
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
