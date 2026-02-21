/**
 * Level-up wizard: guided flow for adding a character level (choose class, HP, then skills/feat/spells in later steps).
 * Step 1 (this file): Choose class (existing or add new), then HP roll/input; commit levelHistory and close.
 */
import { ThirdEraActorSheet } from "../sheets/actor-sheet.mjs";
import { SpellData } from "../data/item-spell.mjs";

const STEPS = ["class", "hp"];

export class LevelUpWizard extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2
) {
    /** @override */
    static DEFAULT_OPTIONS = {
        id: "level-up-wizard",
        classes: ["thirdera", "level-up-wizard"],
        position: { width: 420, height: 380 },
        window: {
            title: "THIRDERA.LevelUpWizard.Title",
            icon: "fa-solid fa-arrow-up",
            resizable: false
        },
        actions: {
            next: LevelUpWizard.#onNext,
            back: LevelUpWizard.#onBack,
            cancel: LevelUpWizard.#onCancel,
            selectClass: LevelUpWizard.#onSelectClass,
            addNewClass: LevelUpWizard.#onAddNewClass,
            rollHp: LevelUpWizard.#onRollHp
        }
    };

    /** @override */
    static PARTS = {
        main: {
            template: "systems/thirdera/templates/apps/level-up-wizard.hbs"
        }
    };

    /** @type {Actor} */
    actor = null;

    /** @type {string} */
    step = "class";

    /** Selected class item ID (existing or newly created). Set when user picks "Level up [X]" or after "Add new class" creates one. */
    selectedClassItemId = null;

    /** HP value for this level (rolled or manual). */
    hpRolled = 0;

    /** When true, we are in "add new class" mode: show class picker instead of class list. */
    addNewClassMode = false;

    /** Available class documents for picker (world + compendiums). { uuid, name, packName } */
    availableClasses = [];

    constructor(actor, options = {}) {
        super(options);
        this.actor = actor;
    }

    /** @override */
    async _prepareContext(options) {
        const stepIndex = STEPS.indexOf(this.step);
        const stepLabel = game.i18n.format("THIRDERA.LevelUpWizard.StepNOfM", {
            n: stepIndex + 1,
            m: STEPS.length
        });

        if (this.step === "class") {
            const classes = (this.actor.items.filter(i => i.type === "class") || []).map((cls) => {
                const history = this.actor.system.levelHistory || [];
                const count = history.filter((e) => e.classItemId === cls.id).length;
                return {
                    id: cls.id,
                    name: cls.name,
                    currentLevels: count
                };
            });
            const hasClasses = classes.length > 0;

            // Build available classes for "Add new class" picker (world + compendiums)
            let availableClasses = [];
            if (this.addNewClassMode) {
                const seen = new Map(); // name -> { uuid, name, packName }
                const worldItems = (game.items?.contents ?? []).filter((i) => i.type === "class");
                for (const doc of worldItems) {
                    const key = (doc.name || "").toLowerCase().trim();
                    if (!seen.has(key)) seen.set(key, { uuid: doc.uuid, name: doc.name, packName: game.i18n.localize("Type.world") || "World" });
                }
                for (const pack of game.packs?.values() ?? []) {
                    if (pack.documentName !== "Item") continue;
                    try {
                        const docs = await pack.getDocuments({ type: "class" });
                        for (const doc of docs) {
                            const key = (doc.name || "").toLowerCase().trim();
                            if (!seen.has(key)) {
                                seen.set(key, { uuid: doc.uuid, name: doc.name, packName: pack.metadata?.label ?? pack.collection });
                            }
                        }
                    } catch (_) {
                        /* ignore */
                    }
                }
                availableClasses = [...seen.values()].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            }

            return {
                appId: this.id,
                step: this.step,
                stepLabel,
                stepTitle: game.i18n.localize("THIRDERA.LevelUpWizard.StepChooseClass"),
                classes,
                hasClasses,
                addNewClassMode: this.addNewClassMode,
                availableClasses,
                selectedClassValue: this.selectedClassItemId || ""
            };
        }

        if (this.step === "hp") {
            const cls = this.actor.items.get(this.selectedClassItemId);
            const hitDie = cls?.system?.hitDie ?? "d8";
            const className = cls?.name ?? "Unknown";
            const isFirstLevel = (this.actor.system.levelHistory || []).length === 0;
            const firstLevelFullHp = game.settings.get("thirdera", "firstLevelFullHp");
            let suggestedHp = this.hpRolled;
            if (suggestedHp === 0 && isFirstLevel && firstLevelFullHp && cls) {
                const dieSize = parseInt((cls.system.hitDie || "").substring(1), 10);
                if (!isNaN(dieSize)) suggestedHp = dieSize;
            }

            return {
                appId: this.id,
                step: this.step,
                stepLabel,
                stepTitle: game.i18n.localize("THIRDERA.LevelUpWizard.StepHitPoints"),
                className,
                hitDie,
                hpRolled: this.hpRolled,
                suggestedHp,
                canRoll: true
            };
        }

        return { appId: this.id, step: this.step, stepLabel, stepTitle: "" };
    }

    /** @override */
    _attachPartListeners(partId, htmlElement, options) {
        super._attachPartListeners(partId, htmlElement, options);
        if (partId !== "main") return;

        const root = this.element?.querySelector?.(".window-content") ?? this.element;
        const form = htmlElement?.classList?.contains("level-up-wizard-form") ? htmlElement : root?.querySelector?.(".level-up-wizard-form");

        const applyLeftAlign = () => {
            if (root) {
                root.style.setProperty("align-items", "flex-start", "important");
                root.style.setProperty("justify-content", "flex-start", "important");
                root.style.setProperty("text-align", "left", "important");
            }
            if (form) {
                form.style.setProperty("width", "100%", "important");
                form.style.setProperty("min-width", "100%", "important");
                form.style.setProperty("align-self", "stretch", "important");
                form.style.setProperty("text-align", "left", "important");
                form.style.setProperty("align-items", "flex-start", "important");
            }
        };
        applyLeftAlign();
        requestAnimationFrame(applyLeftAlign);

        const classOptions = root?.querySelectorAll?.(".level-up-class-option");
        if (classOptions?.length) {
            classOptions.forEach((btn) => {
                btn.addEventListener("click", () => {
                    const value = btn.dataset.value;
                    if (value === "add-new") {
                        this.addNewClassMode = true;
                        this.selectedClassItemId = null;
                    } else if (value) {
                        this.addNewClassMode = false;
                        this.selectedClassItemId = value;
                    }
                    this.render(true);
                });
            });
        }

        const newClassSelect = root?.querySelector?.('select[name="newClassUuid"]');
        if (newClassSelect) {
            newClassSelect.addEventListener("change", () => {
                this.render(true);
            });
        }
    }

    static async #onNext(event, target) {
        const wizard = LevelUpWizard.#getWizardFromTarget(target);
        if (!wizard?.actor) return;

        if (wizard.step === "class") {
            if (wizard.addNewClassMode) {
                const select = wizard.element?.querySelector?.('select[name="newClassUuid"]');
                const uuid = select?.value?.trim();
                if (!uuid) {
                    ui.notifications.warn(game.i18n.localize("THIRDERA.LevelUpWizard.SelectClassFirst"));
                    return;
                }
                const sourceItem = await foundry.utils.fromUuid(uuid);
                if (!sourceItem || sourceItem.type !== "class") {
                    ui.notifications.warn(game.i18n.localize("THIRDERA.LevelUpWizard.InvalidClass"));
                    return;
                }
                try {
                    const created = await LevelUpWizard.#createNewClassOnActor(wizard.actor, sourceItem);
                    if (created) {
                        wizard.selectedClassItemId = created.id;
                        wizard.addNewClassMode = false;
                        wizard.step = "hp";
                        wizard.hpRolled = 0;
                        const cls = wizard.actor.items.get(created.id);
                        if (cls && (wizard.actor.system.levelHistory || []).length === 0 && game.settings.get("thirdera", "firstLevelFullHp")) {
                            const dieSize = parseInt((cls.system.hitDie || "").substring(1), 10);
                            if (!isNaN(dieSize)) wizard.hpRolled = dieSize;
                        }
                        await wizard.render(true);
                    }
                } catch (err) {
                    console.error("Third Era | Level-up wizard add new class:", err);
                    ui.notifications.error(err.message || "Failed to add class.");
                }
                return;
            }
            if (!wizard.selectedClassItemId) {
                ui.notifications.warn(game.i18n.localize("THIRDERA.LevelUpWizard.SelectClassFirst"));
                return;
            }
            wizard.step = "hp";
            wizard.hpRolled = 0;
            const cls = wizard.actor.items.get(wizard.selectedClassItemId);
            if (cls && (wizard.actor.system.levelHistory || []).length === 0 && game.settings.get("thirdera", "firstLevelFullHp")) {
                const dieSize = parseInt((cls.system.hitDie || "").substring(1), 10);
                if (!isNaN(dieSize)) wizard.hpRolled = dieSize;
            }
            await wizard.render(true);
            return;
        }

        if (wizard.step === "hp") {
            const input = wizard.element?.querySelector?.('input[name="hpRolled"]');
            const value = input ? parseInt(input.value, 10) : wizard.hpRolled;
            const hpRolled = Number.isInteger(value) && value >= 0 ? value : 0;
            const history = [...(wizard.actor.system.levelHistory || [])];
            history.push({ classItemId: wizard.selectedClassItemId, hpRolled });
            await wizard.actor.update({ "system.levelHistory": history });
            wizard.close();
            if (wizard.actor.sheet?.rendered) await wizard.actor.sheet.render(true);
            ui.notifications.info(game.i18n.format("THIRDERA.LevelUpWizard.LevelAdded", { name: wizard.actor.name }));
        }
    }

    static #onBack(event, target) {
        const wizard = LevelUpWizard.#getWizardFromTarget(target);
        if (!wizard) return;
        if (wizard.step === "hp") {
            wizard.step = "class";
            wizard.hpRolled = 0;
            wizard.render(true);
        }
    }

    static #onCancel(event, target) {
        const wizard = LevelUpWizard.#getWizardFromTarget(target);
        if (wizard) wizard.close();
    }

    static #onSelectClass(event, target) {
        const wizard = LevelUpWizard.#getWizardFromTarget(target);
        if (!wizard) return;
        const value = target.value;
        if (value === "add-new") {
            wizard.addNewClassMode = true;
            wizard.selectedClassItemId = null;
        } else {
            wizard.addNewClassMode = false;
            wizard.selectedClassItemId = value || null;
        }
        wizard.render(true);
    }

    static #onAddNewClass(event, target) {
        const wizard = LevelUpWizard.#getWizardFromTarget(target);
        if (!wizard) return;
        wizard.addNewClassMode = true;
        wizard.selectedClassItemId = null;
        wizard.render(true);
    }

    static async #onRollHp(event, target) {
        const wizard = LevelUpWizard.#getWizardFromTarget(target);
        if (!wizard?.actor) return;
        const hitDie = target.dataset.hitDie;
        if (!hitDie) return;
        const roll = await new Roll(`1${hitDie}`).evaluate();
        await roll.toMessage({
            speaker: ChatMessage.implementation.getSpeaker({ actor: wizard.actor }),
            flavor: game.i18n.format("THIRDERA.LevelUpWizard.RollHpFlavor", { name: wizard.actor.name })
        });
        wizard.hpRolled = roll.total;
        const input = wizard.element?.querySelector?.('input[name="hpRolled"]');
        if (input) input.value = roll.total;
        await wizard.render(true);
    }

    static #getWizardFromTarget(target) {
        const el = target?.closest?.("[data-appid]") ?? target?.closest?.(".level-up-wizard");
        if (!el) return null;
        const appId = el.dataset?.appid;
        if (!appId) return null;
        const app = foundry.applications.apps.get(appId);
        return app instanceof LevelUpWizard ? app : null;
    }

    /**
     * Create a new class item on the actor (no levelHistory entry). Adds class skills and full-list caster spells.
     * @param {Actor} actor
     * @param {Item} sourceClassItem - Class document from world or compendium
     * @returns {Promise<Item|null>} Created class item on the actor
     */
    static async #createNewClassOnActor(actor, sourceClassItem) {
        const itemName = sourceClassItem.name || "Class";
        const systemData = foundry.utils.duplicate(sourceClassItem.system ?? {});
        const classImg = sourceClassItem.img ?? "";
        const initialData = { name: `\u200B${itemName}`, type: "class", img: classImg, system: {} };
        const createdDocs = await actor.createEmbeddedDocuments("Item", [initialData]);
        const created = createdDocs?.[0] ?? null;
        if (!created?.id) return null;
        await created.update({ name: itemName, system: systemData }, { diff: false });
        const createdClass = actor.items.get(created.id);
        const sc = createdClass?.system?.spellcasting;

        if (sc?.spellListAccess === "learned") {
            const spellListKey = (sc.spellListKey || "").trim()
                || (itemName === "Wizard" || itemName === "Sorcerer" ? "sorcererWizard" : itemName.toLowerCase());
            const toRemove = actor.items.filter(
                (i) => i.type === "spell" && SpellData.hasLevelForClass(i.system, spellListKey)
            ).map((i) => i.id);
            if (toRemove.length) await actor.deleteEmbeddedDocuments("Item", toRemove);
        }

        const classSkills = systemData?.classSkills || [];
        const existingSkillKeys = new Set(actor.items.filter((i) => i.type === "skill" && i.system.key).map((s) => s.system.key));
        const toCreate = [];
        for (const entry of classSkills) {
            if (existingSkillKeys.has(entry.key)) continue;
            const sourceSkill = game.items.find((i) => i.type === "skill" && i.system.key === entry.key);
            if (sourceSkill) toCreate.push(sourceSkill.toObject());
        }
        if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);

        const isFullListCaster = sc?.spellListAccess === "full";
        if (createdClass && isFullListCaster) {
            await ThirdEraActorSheet.addClassSpellListForFullListCaster(actor, createdClass, 1);
        }
        return createdClass;
    }
}
