/**
 * Dialog to pick a skill for the mechanical-effects key (Phase 6).
 * Lists world + compendium skills, alphabetical; search with fuzzy (Levenshtein) filter.
 */
import { fuzzyScore } from "../utils/fuzzy.mjs";

/**
 * Gather all skill items from world and compendia, dedupe by system.key (world wins), sort by name.
 * Exported for use by actor sheet (modifier-only skills display names).
 * @returns {Promise<Array<{ key: string, name: string }>>}
 */
export async function getAllSkills() {
    const byKey = new Map();
    const fromWorld = (game.items?.contents ?? []).filter((i) => i.type === "skill");
    for (const item of fromWorld) {
        const key = (item.system?.key ?? "").trim().toLowerCase();
        if (key) byKey.set(key, { key: item.system.key, name: item.name });
    }
    const packs = game.packs?.contents ?? [];
    for (const pack of packs) {
        if (pack.documentName !== "Item") continue;
        try {
            const docs = await pack.getDocuments();
            for (const item of docs) {
                if (item.type !== "skill") continue;
                const key = (item.system?.key ?? "").trim().toLowerCase();
                if (key && !byKey.has(key)) byKey.set(key, { key: item.system.key, name: item.name });
            }
        } catch (_) {}
    }
    const list = [...byKey.values()].sort((a, b) => (a.name || "").localeCompare(b.name || "", game.i18n?.lang ?? "en"));
    return list;
}

export class SkillPickerDialog extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2
) {
    static DEFAULT_OPTIONS = {
        id: "skill-picker-dialog",
        classes: ["thirdera", "skill-picker-dialog"],
        position: { width: 360, height: 420 },
        window: {
            frame: true,
            title: "THIRDERA.MechanicalEffectsChooseSkill",
            icon: "fa-solid fa-list",
            resizable: true
        },
        actions: {
            selectSkill: SkillPickerDialog.#onSelectSkill,
            filterSkills: SkillPickerDialog.#onFilterSkills
        }
    };

    static PARTS = {
        main: {
            template: "systems/thirdera/templates/apps/skill-picker-dialog.hbs",
            scrollable: [".skill-picker-list"]
        }
    };

    /** @type {Array<{ key: string, name: string }>} */
    allSkills = [];

    /** @type {string} */
    query = "";

    /** @type {number[]} Timeouts for delayed bringToFront burst; cleared on close */
    _bringToFrontTimeouts = [];
    /** @type {boolean} True after first render burst so we don't re-add on search re-renders */
    _bringToFrontBurstDone = false;

    /** @param {{ resolve?: (key: string) => void, onClose?: () => void } } options */
    constructor(options = {}) {
        super(options);
        this._resolve = options.resolve ?? (() => {});
        this._onClose = options.onClose ?? (() => {});
    }

    async close(options = {}) {
        for (const id of this._bringToFrontTimeouts) clearTimeout(id);
        this._bringToFrontTimeouts = [];
        if (this._onClose) this._onClose();
        return super.close(options);
    }

    async render(force = false) {
        const out = await super.render(force);
        const bring = () => { if (typeof this.bringToFront === "function") this.bringToFront(); };
        bring();
        if (this.element) {
            this.element.__app = this;
            this.element.addEventListener("mousedown", () => bring(), true);
            const searchInput = this.element.querySelector('input[name="skillSearch"]');
            if (searchInput && !this._bringToFrontBurstDone) {
                this._bringToFrontBurstDone = true;
                // Burst of bringToFront so we stay above other panels that get bringToFront() after we open
                for (const ms of [50, 100, 200, 350]) {
                    this._bringToFrontTimeouts.push(setTimeout(() => bring(), ms));
                }
                const bringAndFocus = () => {
                    bring();
                    const input = this.element?.querySelector('input[name="skillSearch"]');
                    if (input) input.focus();
                };
                this._bringToFrontTimeouts.push(setTimeout(bringAndFocus, 100));
            }
            if (searchInput) {
                searchInput.addEventListener("input", async () => {
                    const value = searchInput.value ?? "";
                    const start = searchInput.selectionStart ?? value.length;
                    const end = searchInput.selectionEnd ?? value.length;
                    this.query = value;
                    await this.render();
                    const newInput = this.element?.querySelector('input[name="skillSearch"]');
                    if (newInput) {
                        newInput.focus();
                        newInput.setSelectionRange(start, end);
                    }
                });
            }
        }
        return out;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        if (!this.allSkills.length) this.allSkills = await getAllSkills();
        const q = (this.query || "").trim().toLowerCase();
        let filtered = this.allSkills;
        if (q) {
            filtered = this.allSkills
                .map((s) => ({ ...s, ...fuzzyScore(q, s.name, s.key) }))
                .filter((s) => s.matched)
                .sort((a, b) => a.score - b.score);
        }
        return {
            ...context,
            skills: filtered,
            query: this.query ?? "",
            hasQuery: q.length > 0
        };
    }

    static #onSelectSkill(event, target) {
        const key = target?.dataset?.skillKey ?? target?.closest?.("[data-skill-key]")?.dataset?.skillKey;
        if (!key) return;
        const el = target?.closest?.(".skill-picker-dialog");
        const app = el?.__app ?? Object.values(game.applications?.apps ?? {}).find((a) => a.constructor?.name === "SkillPickerDialog");
        if (app?._resolve) {
            app._resolve(key);
            app.close();
        }
    }

    static #onFilterSkills(event, target) {
        const input = target?.type === "input" ? target : target?.closest?.("input[name='skillSearch']");
        if (!input) return;
        const app = input.closest?.(".skill-picker-dialog")?.__app ?? Object.values(game.applications?.apps ?? {}).find((a) => a.constructor?.name === "SkillPickerDialog");
        if (app) {
            app.query = input.value ?? "";
            app.render();
        }
    }
}
