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

// Import document classes
import { ThirdEraActor } from "./module/documents/actor.mjs";
import { ThirdEraItem } from "./module/documents/item.mjs";

// Import sheet classes
import { ThirdEraActorSheet } from "./module/sheets/actor-sheet.mjs";
import { ThirdEraItemSheet } from "./module/sheets/item-sheet.mjs";

/**
 * Initialize the Third Era system
 */
Hooks.once("init", function () {
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
        }
    };


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
        skill: SkillData
    };

    // Register sheet application classes
    DocumentSheetConfig.registerSheet(Actor, "thirdera", ThirdEraActorSheet, {
        makeDefault: true,
        label: "THIRDERA.SheetLabels.Actor"
    });

    DocumentSheetConfig.registerSheet(Item, "thirdera", ThirdEraItemSheet, {
        makeDefault: true,
        label: "THIRDERA.SheetLabels.Item"
    });

    // Register Handlebars helpers
    registerHandlebarsHelpers();

    // Register Handlebars partials
    loadTemplates([
        "systems/thirdera/templates/partials/editor-box.hbs"
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
    const directoryItems = html.find(".directory-item.document");

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
                /*
                // Use standard Dialog.confirm
                const confirmed = await Dialog.confirm({
                    title: `Delete ${type}: ${document.name}`,
                    content: `<h4>Are you sure you want to delete this ${type}?</h4><p>This action cannot be undone.</p>`
                });

                if (confirmed) {
                    await document.delete();
                }
                */
                // Actually, document.deleteDialog() is better as it handles the logic for us
                document.deleteDialog();
            }
        });

        // Insert before the standard creation/edit controls if they exist, or just append
        li.append(deleteBtn);
    });
}
