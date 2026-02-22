/**
 * Level-up flow: guided steps for adding a character level (choose class, HP, skill points, feat, then commit).
 * Step 1: Choose class (existing or add new), then HP roll/input.
 * Step 2: Assign skill points for this level, then choose feat if gained this level; commit levelHistory, skill ranks, and feat.
 */
import { ThirdEraActorSheet } from "../sheets/actor-sheet.mjs";
import { SpellData } from "../data/item-spell.mjs";

const STEPS = ["class", "hp", "skills", "feat"];

/** Character levels that grant a general feat (3.5 SRD). */
const GENERAL_FEAT_LEVELS = new Set([1, 3, 6, 9, 12, 15, 18]);
/** Fighter class levels that grant a bonus feat (3.5 SRD). */
const FIGHTER_BONUS_FEAT_LEVELS = new Set([1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);

export class LevelUpFlow extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2
) {
    /** @override */
    static DEFAULT_OPTIONS = {
        id: "level-up-flow",
        classes: ["thirdera", "level-up-flow"],
        position: { width: 420, height: 480 },
        window: {
            title: "THIRDERA.LevelUp.Title",
            icon: "fa-solid fa-arrow-up",
            resizable: true
        },
        actions: {
            next: LevelUpFlow.#onNext,
            back: LevelUpFlow.#onBack,
            cancel: LevelUpFlow.#onCancel,
            selectClass: LevelUpFlow.#onSelectClass,
            addNewClass: LevelUpFlow.#onAddNewClass,
            rollHp: LevelUpFlow.#onRollHp
        }
    };

    /** @override */
    static PARTS = {
        main: {
            template: "systems/thirdera/templates/apps/level-up-flow.hbs"
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

    /** When in add-new-class mode, the UUID selected in the dropdown (so it persists across re-renders). */
    selectedNewClassUuid = "";

    /** Pending skill points to spend per skill for this level: { skillId: number }. */
    pendingSkillPoints = {};

    /** UUID of feat to add when committing (general or fighter bonus feat this level). */
    selectedFeatUuid = "";

    constructor(actor, options = {}) {
        super(options);
        this.actor = actor;
    }

    /** @override */
    async _prepareContext(options) {
        const stepIndex = STEPS.indexOf(this.step);
        const stepLabel = game.i18n.format("THIRDERA.LevelUp.StepNOfM", {
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
                stepTitle: game.i18n.localize("THIRDERA.LevelUp.StepChooseClass"),
                classes,
                hasClasses,
                addNewClassMode: this.addNewClassMode,
                availableClasses,
                selectedClassValue: this.selectedClassItemId || "",
                selectedNewClassUuid: this.selectedNewClassUuid || ""
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
                stepTitle: game.i18n.localize("THIRDERA.LevelUp.StepHitPoints"),
                className,
                hitDie,
                hpRolled: this.hpRolled,
                suggestedHp,
                canRoll: true
            };
        }

        if (this.step === "skills") {
            const ctx = await LevelUpFlow.#buildSkillsStepContext(this);
            return { appId: this.id, step: this.step, stepLabel, stepTitle: ctx.stepTitle, ...ctx };
        }

        if (this.step === "feat") {
            const ctx = await LevelUpFlow.#buildFeatStepContext(this);
            return { appId: this.id, step: this.step, stepLabel, stepTitle: ctx.stepTitle, ...ctx };
        }

        return { appId: this.id, step: this.step, stepLabel, stepTitle: "" };
    }

    /**
     * Build context for the skills step: budget for this level and full skill list (actor skills + all others from world/compendiums).
     * @param {LevelUpFlow} flow
     * @returns {Promise<Object>}
     */
    static async #buildSkillsStepContext(flow) {
        const actor = flow.actor;
        const cls = actor.items.get(flow.selectedClassItemId);
        const levelHistory = actor.system.levelHistory || [];
        const totalLevelAfter = levelHistory.length + 1;
        const isFirstLevel = levelHistory.length === 0;

        let skillPointsForLevel = 0;
        if (cls) {
            const base = cls.system.skillPointsPerLevel ?? 0;
            const intMod = actor.system.abilities?.int?.mod ?? 0;
            skillPointsForLevel = Math.max(1, base + intMod);
            if (isFirstLevel) skillPointsForLevel *= 4;
        }

        const classSkillKeys = actor.system.classSkillKeys ?? new Set();
        const grantedSkillKeys = actor.system.grantedSkillKeys ?? new Set();
        const excludedSkillKeys = actor.system.excludedSkillKeys ?? new Set();
        const classSkillKeysLower = new Set([...classSkillKeys].map((k) => String(k).toLowerCase()));
        const grantedSkillKeysLower = new Set([...grantedSkillKeys].map((k) => String(k).toLowerCase()));
        const excludedSkillKeysLower = new Set([...excludedSkillKeys].map((k) => String(k).toLowerCase()));

        const selectedClassSkillKeysLower = new Set();
        if (cls?.system?.classSkills) {
            for (const entry of cls.system.classSkills) {
                if (entry.key) selectedClassSkillKeysLower.add(String(entry.key).toLowerCase());
            }
        }

        const allSkillsByKeyLower = await LevelUpFlow.#getAllSkillsByKey();
        const actorSkillKeysLower = new Set(
            actor.items.filter((i) => i.type === "skill" && i.system.key).map((s) => String(s.system.key).toLowerCase())
        );

        const classSkills = [];
        const crossClassSkills = [];
        let pointsSpent = 0;

        function pushRow(row) {
            const cost = row.isForbidden ? 0 : (row.effectivePoints ?? row.addRanks * row.costPerRank);
            pointsSpent += cost;
            if (row.isClassSkill) classSkills.push(row);
            else crossClassSkills.push(row);
        }

        const abilities = actor.system?.abilities ?? {};
        for (const skill of actor.items.filter((i) => i.type === "skill")) {
            const sd = skill.system;
            const key = sd.key;
            const keyLower = key ? String(key).toLowerCase() : "";
            const isGranted = keyLower && grantedSkillKeysLower.has(keyLower);
            const isClassSkill = isGranted || !!(keyLower && (classSkillKeysLower.has(keyLower) || selectedClassSkillKeysLower.has(keyLower)));
            const isForbidden = keyLower && excludedSkillKeysLower.has(keyLower)
                || (sd.exclusive === "true" && keyLower && !classSkillKeysLower.has(keyLower) && !selectedClassSkillKeysLower.has(keyLower) && !isGranted);
            const maxRanksAfter = isClassSkill ? totalLevelAfter + 3 : Math.floor((totalLevelAfter + 3) / 2);
            const currentRanks = sd.ranks ?? 0;
            const points = flow.pendingSkillPoints?.[skill.id] ?? 0;
            const costPerRank = isClassSkill ? 1 : 2;
            const maxAdd = isForbidden ? 0 : Math.max(0, maxRanksAfter - currentRanks);
            const maxPoints = maxAdd * costPerRank;
            const addRanks = Math.min(points / costPerRank, maxAdd);
            const effectivePoints = addRanks * costPerRank;
            const resultingRanks = currentRanks + addRanks;
            const modSummary = LevelUpFlow.#skillModifierSummary(abilities, sd.ability, sd.modifier?.misc);
            pushRow({
                id: skill.id,
                name: skill.name,
                currentRanks,
                pointsToSpend: Math.min(points, maxPoints),
                maxPoints,
                addRanks,
                effectivePoints,
                resultingRanks,
                maxRanksAfter,
                maxAdd,
                isClassSkill,
                isForbidden,
                costPerRank,
                ...modSummary,
                forbiddenReason: keyLower && excludedSkillKeysLower.has(keyLower)
                    ? "Excluded by race"
                    : (sd.exclusive === "true" && keyLower && !classSkillKeysLower.has(keyLower) && !selectedClassSkillKeysLower.has(keyLower) && !isGranted ? "Exclusive — requires a class that grants this skill" : "")
            });
        }

        for (const [keyLower, { name, key: origKey, exclusive, ability: skillAbility }] of allSkillsByKeyLower) {
            if (actorSkillKeysLower.has(keyLower)) continue;
            if (exclusive && !classSkillKeysLower.has(keyLower) && !grantedSkillKeysLower.has(keyLower) && !selectedClassSkillKeysLower.has(keyLower)) continue;
            const isGranted = grantedSkillKeysLower.has(keyLower);
            const isClassSkill = isGranted || classSkillKeysLower.has(keyLower) || selectedClassSkillKeysLower.has(keyLower);
            const isForbidden = excludedSkillKeysLower.has(keyLower);
            const maxRanksAfter = isClassSkill ? totalLevelAfter + 3 : Math.floor((totalLevelAfter + 3) / 2);
            const currentRanks = 0;
            const rowId = `key:${origKey}`;
            const points = flow.pendingSkillPoints?.[rowId] ?? 0;
            const costPerRank = isClassSkill ? 1 : 2;
            const maxAdd = isForbidden ? 0 : Math.max(0, maxRanksAfter - currentRanks);
            const maxPoints = maxAdd * costPerRank;
            const addRanks = Math.min(points / costPerRank, maxAdd);
            const effectivePoints = addRanks * costPerRank;
            const resultingRanks = currentRanks + addRanks;
            const modSummary = LevelUpFlow.#skillModifierSummary(abilities, skillAbility, 0);
            pushRow({
                id: rowId,
                name,
                currentRanks,
                pointsToSpend: Math.min(points, maxPoints),
                maxPoints,
                addRanks,
                effectivePoints,
                resultingRanks,
                maxRanksAfter,
                maxAdd,
                isClassSkill,
                isForbidden,
                costPerRank,
                ...modSummary,
                forbiddenReason: isForbidden ? "Excluded by race" : ""
            });
        }

        classSkills.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        crossClassSkills.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        const remaining = skillPointsForLevel - pointsSpent;
        const valid = remaining >= 0;

        return {
            stepTitle: game.i18n.localize("THIRDERA.LevelUp.StepSkillPoints"),
            skillPointsForLevel,
            pointsSpent,
            remaining,
            valid,
            classSkills,
            crossClassSkills
        };
    }

    /**
     * Get all skill documents from world and compendiums, keyed by lowercase system.key.
     * @returns {Promise<Map<string, { name: string, key: string, exclusive: boolean, ability: string }>>} keyLower -> skill info
     */
    static async #getAllSkillsByKey() {
        const map = new Map();
        for (const doc of (game.items?.contents ?? []).filter((i) => i.type === "skill")) {
            const key = doc.system?.key;
            if (!key) continue;
            const k = String(key).toLowerCase();
            if (!map.has(k)) map.set(k, { name: doc.name, key, exclusive: doc.system?.exclusive === "true", ability: doc.system?.ability || "int" });
        }
        for (const pack of game.packs?.values() ?? []) {
            if (pack.documentName !== "Item") continue;
            try {
                const docs = await pack.getDocuments({ type: "skill" });
                for (const doc of docs) {
                    const key = doc.system?.key;
                    if (!key) continue;
                    const k = String(key).toLowerCase();
                    if (!map.has(k)) map.set(k, { name: doc.name, key, exclusive: doc.system?.exclusive === "true", ability: doc.system?.ability || "int" });
                }
            } catch (_) { /* ignore */ }
        }
        return map;
    }

    /**
     * Build modifier summary for a skill row (ability + misc for display in level-up flow).
     * @param {Object} abilities - Actor's system.abilities (with .mod per key)
     * @param {string} abilityKey - Skill's key ability (str, dex, con, int, wis, cha)
     * @param {number} misc - Skill's misc modifier
     * @returns {{ abilityKeyDisplay: string, abilityMod: number, misc: number, modifierSummary: string }}
     */
    static #skillModifierSummary(abilities, abilityKey, misc) {
        const key = (abilityKey || "int").toLowerCase();
        const abilityMod = abilities?.[key]?.mod ?? 0;
        const abilityKeyDisplay = key.toUpperCase();
        const miscNum = Number(misc) || 0;
        const parts = [`${abilityKeyDisplay} ${abilityMod >= 0 ? "+" : ""}${abilityMod}`];
        if (miscNum !== 0) parts.push(`Misc ${miscNum >= 0 ? "+" : ""}${miscNum}`);
        return {
            abilityKeyDisplay,
            abilityMod,
            misc: miscNum,
            modifierSummary: parts.join(", ")
        };
    }

    /**
     * Find a skill document by system.key (world first, then compendiums).
     * @param {string} key - Skill key (e.g. "climb")
     * @returns {Promise<Item|null>}
     */
    static async #findSkillByKey(key) {
        const keyLower = String(key || "").toLowerCase();
        const world = game.items?.find((i) => i.type === "skill" && (i.system?.key || "").toLowerCase() === keyLower);
        if (world) return world;
        for (const pack of game.packs?.values() ?? []) {
            if (pack.documentName !== "Item") continue;
            try {
                const docs = await pack.getDocuments({ type: "skill" });
                const found = docs.find((d) => (d.system?.key || "").toLowerCase() === keyLower);
                if (found) return found;
            } catch (_) { /* ignore */ }
        }
        return null;
    }

    /**
     * Build context for the feat step: whether a feat is gained this level and available feats list.
     * @param {LevelUpFlow} flow
     * @returns {Promise<Object>}
     */
    static async #buildFeatStepContext(flow) {
        const actor = flow.actor;
        const levelHistory = actor.system.levelHistory || [];
        const totalLevelAfter = levelHistory.length + 1;
        const cls = actor.items.get(flow.selectedClassItemId);
        const className = cls?.name ?? "";
        const levelsInClass = levelHistory.filter((e) => e.classItemId === flow.selectedClassItemId).length + 1;

        const gainsGeneralFeat = GENERAL_FEAT_LEVELS.has(totalLevelAfter);
        const isFighter = (className || "").toLowerCase() === "fighter";
        const gainsFighterBonus = isFighter && FIGHTER_BONUS_FEAT_LEVELS.has(levelsInClass);
        const gainsFeat = gainsGeneralFeat || gainsFighterBonus;

        let availableFeats = [];
        if (gainsFeat) {
            const seen = new Map();
            const worldItems = (game.items?.contents ?? []).filter((i) => i.type === "feat");
            for (const doc of worldItems) {
                const k = (doc.name || "").toLowerCase().trim();
                if (!seen.has(k)) seen.set(k, { uuid: doc.uuid, name: doc.name, packName: game.i18n.localize("Type.world") || "World" });
            }
            for (const pack of game.packs?.values() ?? []) {
                if (pack.documentName !== "Item") continue;
                try {
                    const docs = await pack.getDocuments({ type: "feat" });
                    for (const doc of docs) {
                        const k = (doc.name || "").toLowerCase().trim();
                        if (!seen.has(k)) seen.set(k, { uuid: doc.uuid, name: doc.name, packName: pack.metadata?.label ?? pack.collection });
                    }
                } catch (_) { /* ignore */ }
            }
            availableFeats = [...seen.values()].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        }

        return {
            stepTitle: game.i18n.localize("THIRDERA.LevelUp.StepFeat"),
            gainsFeat,
            gainsGeneralFeat,
            gainsFighterBonus,
            className,
            availableFeats,
            selectedFeatUuid: flow.selectedFeatUuid || ""
        };
    }

    /** @override */
    _attachPartListeners(partId, htmlElement, options) {
        super._attachPartListeners(partId, htmlElement, options);
        if (partId !== "main") return;

        const root = this.element?.querySelector?.(".window-content") ?? this.element;
        const form = htmlElement?.classList?.contains("level-up-flow-form") ? htmlElement : root?.querySelector?.(".level-up-flow-form");

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
                        this.selectedNewClassUuid = "";
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
                this.selectedNewClassUuid = newClassSelect.value?.trim() ?? "";
            });
        }

        const pointsInputs = root?.querySelectorAll?.('input[name="pointsToSpend"]');
        if (pointsInputs?.length) {
            const skillsListEl = root?.querySelector?.(".level-up-flow-skills-list");
            const syncPending = async (ev) => {
                const triggerInput = ev?.target?.name === "pointsToSpend" ? ev.target : null;
                let nextIndex = 0;
                if (triggerInput) {
                    const idx = Array.from(pointsInputs).indexOf(triggerInput);
                    if (idx >= 0) nextIndex = (idx + 1) % pointsInputs.length;
                }
                for (const input of pointsInputs) {
                    const id = input.dataset.skillId;
                    const raw = parseFloat(input.value, 10);
                    const points = Number.isFinite(raw) && raw >= 0 ? raw : 0;
                    if (id) this.pendingSkillPoints[id] = points;
                }
                const scrollTop = skillsListEl?.scrollTop ?? 0;
                await this.render(true);
                requestAnimationFrame(() => {
                    const list = this.element?.querySelector?.(".level-up-flow-skills-list");
                    if (list) list.scrollTop = scrollTop;
                    const inputs = this.element?.querySelectorAll?.('input[name="pointsToSpend"]');
                    if (inputs?.length && nextIndex < inputs.length) {
                        inputs[nextIndex].focus();
                        inputs[nextIndex].select();
                    }
                });
            };
            pointsInputs.forEach((input) => {
                input.addEventListener("change", (e) => syncPending(e));
                input.addEventListener("focus", function () {
                    this.select();
                });
            });
        }

        const featSelect = root?.querySelector?.('select[name="featUuid"]');
        if (featSelect) {
            featSelect.addEventListener("change", () => {
                this.selectedFeatUuid = featSelect.value?.trim() ?? "";
            });
        }
    }

    static async #onNext(event, target) {
        const flow = LevelUpFlow.#getFlowFromTarget(target);
        if (!flow?.actor) return;

        if (flow.step === "class") {
            if (flow.addNewClassMode) {
                const select = flow.element?.querySelector?.('select[name="newClassUuid"]');
                const uuid = select?.value?.trim();
                if (!uuid) {
                    ui.notifications.warn(game.i18n.localize("THIRDERA.LevelUp.SelectClassFirst"));
                    return;
                }
                const sourceItem = await foundry.utils.fromUuid(uuid);
                if (!sourceItem || sourceItem.type !== "class") {
                    ui.notifications.warn(game.i18n.localize("THIRDERA.LevelUp.InvalidClass"));
                    return;
                }
                try {
                    const created = await LevelUpFlow.#createNewClassOnActor(flow.actor, sourceItem);
                    if (created) {
                        flow.selectedClassItemId = created.id;
                        flow.addNewClassMode = false;
                        flow.step = "hp";
                        flow.hpRolled = 0;
                        const cls = flow.actor.items.get(created.id);
                        if (cls && (flow.actor.system.levelHistory || []).length === 0 && game.settings.get("thirdera", "firstLevelFullHp")) {
                            const dieSize = parseInt((cls.system.hitDie || "").substring(1), 10);
                            if (!isNaN(dieSize)) flow.hpRolled = dieSize;
                        }
                        await flow.render(true);
                    }
                } catch (err) {
                    console.error("Third Era | Level-up flow add new class:", err);
                    ui.notifications.error(err.message || "Failed to add class.");
                }
                return;
            }
            if (!flow.selectedClassItemId) {
                ui.notifications.warn(game.i18n.localize("THIRDERA.LevelUp.SelectClassFirst"));
                return;
            }
            flow.step = "hp";
            flow.hpRolled = 0;
            const cls = flow.actor.items.get(flow.selectedClassItemId);
            if (cls && (flow.actor.system.levelHistory || []).length === 0 && game.settings.get("thirdera", "firstLevelFullHp")) {
                const dieSize = parseInt((cls.system.hitDie || "").substring(1), 10);
                if (!isNaN(dieSize)) flow.hpRolled = dieSize;
            }
            await flow.render(true);
            return;
        }

        if (flow.step === "hp") {
            const input = flow.element?.querySelector?.('input[name="hpRolled"]');
            const value = input ? parseInt(input.value, 10) : flow.hpRolled;
            flow.hpRolled = Number.isInteger(value) && value >= 0 ? value : 0;
            await LevelUpFlow.#ensureClassSkillsOnActor(flow.actor, flow.selectedClassItemId);
            flow.step = "skills";
            flow.pendingSkillPoints = {};
            await flow.render(true);
            return;
        }

        if (flow.step === "skills") {
            LevelUpFlow.#readPendingSkillPointsFromForm(flow);
            const ctx = await LevelUpFlow.#buildSkillsStepContext(flow);
            if (!ctx.valid) {
                ui.notifications.warn(game.i18n.localize("THIRDERA.LevelUp.SkillPointsOverBudget"));
                return;
            }
            const ctxFeat = await LevelUpFlow.#buildFeatStepContext(flow);
            if (ctxFeat.gainsFeat) {
                flow.step = "feat";
                flow.selectedFeatUuid = "";
                await flow.render(true);
            } else {
                await LevelUpFlow.#commitLevelUp(flow);
            }
            return;
        }

        if (flow.step === "feat") {
            const select = flow.element?.querySelector?.('select[name="featUuid"]');
            const uuid = select?.value?.trim() ?? flow.selectedFeatUuid;
            if (uuid) flow.selectedFeatUuid = uuid;
            await LevelUpFlow.#commitLevelUp(flow);
        }
    }

    static #readPendingSkillPointsFromForm(flow) {
        const root = flow.element?.querySelector?.(".window-content") ?? flow.element;
        if (!root) return;
        const inputs = root.querySelectorAll?.('input[data-skill-id][name="pointsToSpend"]') ?? [];
        for (const input of inputs) {
            const id = input.dataset.skillId;
            const raw = parseFloat(input.value, 10);
            const points = Number.isFinite(raw) && raw >= 0 ? raw : 0;
            if (id) flow.pendingSkillPoints[id] = points;
        }
    }

    /**
     * Commit the level-up: push levelHistory, update skill ranks, add feat if selected, close.
     * @param {LevelUpFlow} flow
     */
    static async #commitLevelUp(flow) {
        LevelUpFlow.#readPendingSkillPointsFromForm(flow);
        if (flow.step === "feat") {
            const select = flow.element?.querySelector?.('select[name="featUuid"]');
            const uuid = select?.value?.trim() ?? flow.selectedFeatUuid;
            if (uuid) flow.selectedFeatUuid = uuid;
        }

        const history = [...(flow.actor.system.levelHistory || [])];
        history.push({ classItemId: flow.selectedClassItemId, hpRolled: flow.hpRolled });
        await flow.actor.update({ "system.levelHistory": history });

        const totalLevelAfter = flow.actor.system.levelHistory.length;
        const classSkillKeys = flow.actor.system.classSkillKeys ?? new Set();
        const grantedSkillKeys = flow.actor.system.grantedSkillKeys ?? new Set();
        const cls = flow.actor.items.get(flow.selectedClassItemId);
        const selectedClassSkillKeysLower = new Set();
        if (cls?.system?.classSkills) {
            for (const entry of cls.system.classSkills) {
                if (entry.key) selectedClassSkillKeysLower.add(String(entry.key).toLowerCase());
            }
        }
        const classSkillKeysLower = new Set([...classSkillKeys].map((k) => String(k).toLowerCase()));
        const grantedSkillKeysLower = new Set([...grantedSkillKeys].map((k) => String(k).toLowerCase()));

        for (const [skillId, points] of Object.entries(flow.pendingSkillPoints ?? {})) {
            if (points <= 0) continue;
            const keyLower = skillId.startsWith("key:") ? skillId.slice(4).toLowerCase() : (flow.actor.items.get(skillId)?.system?.key || "").toLowerCase();
            const isClassSkill = keyLower && (grantedSkillKeysLower.has(keyLower) || classSkillKeysLower.has(keyLower) || selectedClassSkillKeysLower.has(keyLower));
            const costPerRank = isClassSkill ? 1 : 2;
            const maxRanksAfter = isClassSkill ? totalLevelAfter + 3 : Math.floor((totalLevelAfter + 3) / 2);
            const addRanks = Math.min(points / costPerRank, maxRanksAfter);
            if (addRanks <= 0) continue;
            if (skillId.startsWith("key:")) {
                const key = skillId.slice(4);
                const newRanks = Math.min(addRanks, maxRanksAfter);
                const sourceSkill = await LevelUpFlow.#findSkillByKey(key);
                if (sourceSkill) {
                    const obj = sourceSkill.toObject();
                    delete obj._id;
                    obj.system = obj.system ?? {};
                    obj.system.ranks = newRanks;
                    await flow.actor.createEmbeddedDocuments("Item", [obj]);
                }
                continue;
            }
            const skill = flow.actor.items.get(skillId);
            if (!skill || skill.type !== "skill") continue;
            const sd = skill.system;
            const current = sd.ranks ?? 0;
            const newRanks = Math.min(current + addRanks, maxRanksAfter);
            if (newRanks > current) await skill.update({ "system.ranks": newRanks });
        }

        if (flow.selectedFeatUuid) {
            try {
                const sourceFeat = await foundry.utils.fromUuid(flow.selectedFeatUuid);
                if (sourceFeat && sourceFeat.type === "feat") {
                    const obj = sourceFeat.toObject();
                    delete obj._id;
                    await flow.actor.createEmbeddedDocuments("Item", [obj]);
                }
            } catch (err) {
                console.error("Third Era | Level-up flow add feat:", err);
                ui.notifications.warn(game.i18n.format("THIRDERA.LevelUp.FeatAddFailed", { message: err?.message || "Unknown error" }));
            }
        }

        flow.close();
        if (flow.actor.sheet?.rendered) await flow.actor.sheet.render(true);
        ui.notifications.info(game.i18n.format("THIRDERA.LevelUp.LevelAdded", { name: flow.actor.name }));
    }

    static #onBack(event, target) {
        const flow = LevelUpFlow.#getFlowFromTarget(target);
        if (!flow) return;
        if (flow.step === "hp") {
            flow.step = "class";
            flow.hpRolled = 0;
            flow.render(true);
        } else if (flow.step === "skills") {
            flow.step = "hp";
            flow.render(true);
        } else if (flow.step === "feat") {
            flow.step = "skills";
            flow.selectedFeatUuid = "";
            flow.render(true);
        }
    }

    static #onCancel(event, target) {
        const flow = LevelUpFlow.#getFlowFromTarget(target);
        if (flow) flow.close();
    }

    static #onSelectClass(event, target) {
        const flow = LevelUpFlow.#getFlowFromTarget(target);
        if (!flow) return;
        const value = target.value;
        if (value === "add-new") {
            flow.addNewClassMode = true;
            flow.selectedClassItemId = null;
        } else {
            flow.addNewClassMode = false;
            flow.selectedClassItemId = value || null;
        }
        flow.render(true);
    }

    static #onAddNewClass(event, target) {
        const flow = LevelUpFlow.#getFlowFromTarget(target);
        if (!flow) return;
        flow.addNewClassMode = true;
        flow.selectedClassItemId = null;
        flow.render(true);
    }

    static async #onRollHp(event, target) {
        const flow = LevelUpFlow.#getFlowFromTarget(target);
        if (!flow?.actor) return;
        const hitDie = target.dataset.hitDie;
        if (!hitDie) return;
        const roll = await new Roll(`1${hitDie}`).evaluate();
        await roll.toMessage({
            speaker: ChatMessage.implementation.getSpeaker({ actor: flow.actor }),
            flavor: game.i18n.format("THIRDERA.LevelUp.RollHpFlavor", { name: flow.actor.name })
        });
        flow.hpRolled = roll.total;
        const input = flow.element?.querySelector?.('input[name="hpRolled"]');
        if (input) input.value = roll.total;
        await flow.render(true);
    }

    static #getFlowFromTarget(target) {
        const el = target?.closest?.("[data-appid]") ?? target?.closest?.(".level-up-flow");
        if (!el) return null;
        const appId = el.dataset?.appid;
        if (!appId) return null;
        const app = foundry.applications.instances.get(appId);
        return app instanceof LevelUpFlow ? app : null;
    }

    /**
     * Ensure the actor has skill items for the given class's class skills. Creates any missing skills
     * from world or compendiums so the skills step can list them.
     * @param {Actor} actor
     * @param {string} classItemId - ID of the class item on the actor
     */
    static async #ensureClassSkillsOnActor(actor, classItemId) {
        const cls = actor.items.get(classItemId);
        if (!cls) return;
        const classSkills = cls.system?.classSkills || [];
        const existingSkillKeysLower = new Set(
            actor.items
                .filter((i) => i.type === "skill" && i.system.key)
                .map((s) => String(s.system.key).toLowerCase())
        );
        const toCreate = [];
        for (const entry of classSkills) {
            const entryKey = entry.key?.trim();
            if (!entryKey) continue;
            if (existingSkillKeysLower.has(entryKey.toLowerCase())) continue;
            const sourceSkill = await LevelUpFlow.#findSkillByKey(entryKey);
            if (sourceSkill) {
                toCreate.push(sourceSkill.toObject());
                existingSkillKeysLower.add(String(sourceSkill.system?.key || "").toLowerCase());
            }
        }
        if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
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
