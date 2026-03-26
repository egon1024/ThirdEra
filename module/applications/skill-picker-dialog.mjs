/**
 * Dialog to pick a skill for the mechanical-effects key (Phase 6).
 * Lists world + compendium skills, alphabetical; search with fuzzy (Levenshtein) filter.
 */
import { fuzzyScore } from "../utils/fuzzy.mjs";

/**
 * Load every skill Item from an Item compendium without scanning unrelated types when possible.
 * Order: typed DB query → index + batched `_id__in` → full pack load (last resort).
 * @param {import("@client/documents/collections/compendium-collection.mjs").default} pack
 * @returns {Promise<Item[]>}
 */
async function loadSkillDocumentsFromItemPack(pack) {
    const packId = pack.metadata?.id ?? pack.collection ?? "unknown";
    /** @type {Item[]} */
    let docs = [];

    try {
        const queried = await pack.getDocuments({ type: "skill" });
        if (Array.isArray(queried) && queried.length) return queried;
    } catch (err) {
        console.warn(`Third Era | Skill lists: getDocuments({ type: "skill" }) failed for pack "${packId}"`, err);
    }

    try {
        await pack.getIndex({ fields: ["type", "name"] });
        const skillIds = [...pack.index.values()]
            .filter((row) => row?.type === "skill")
            .map((row) => row._id)
            .filter(Boolean);
        if (skillIds.length) {
            const chunkSize = 100;
            for (let i = 0; i < skillIds.length; i += chunkSize) {
                const slice = skillIds.slice(i, i + chunkSize);
                const batch = await pack.getDocuments({ _id__in: slice });
                for (const d of batch) {
                    if (d.type === "skill") docs.push(d);
                }
            }
            if (docs.length) return docs;
        }
    } catch (err) {
        console.warn(`Third Era | Skill lists: index / batched load failed for pack "${packId}"`, err);
    }

    try {
        const all = await pack.getDocuments();
        docs = all.filter((d) => d.type === "skill");
        if (all.length > 250 && docs.length) {
            console.warn(
                `Third Era | Skill lists: full pack scan for "${packId}" (${all.length} items) — consider a { type: "skill" } query or index fix`
            );
        }
        return docs;
    } catch (err) {
        console.warn(`Third Era | Skill lists: could not read Item pack "${packId}"`, err);
        return [];
    }
}

function isItemCompendiumPack(pack) {
    return String(pack?.documentName ?? "") === "Item";
}

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
        if (!isItemCompendiumPack(pack)) continue;
        try {
            const skillDocs = await loadSkillDocumentsFromItemPack(pack);
            for (const item of skillDocs) {
                const key = (item.system?.key ?? "").trim().toLowerCase();
                if (key && !byKey.has(key)) byKey.set(key, { key: item.system.key, name: item.name });
            }
        } catch (err) {
            console.warn("Third Era | getAllSkills: pack iteration error", pack?.metadata?.id, err);
        }
    }
    const list = [...byKey.values()].sort((a, b) => (a.name || "").localeCompare(b.name || "", game.i18n?.lang ?? "en"));
    return list;
}

/**
 * All skill Item documents from the world and every Item compendium (one row per document UUID).
 * Used by the NPC sheet “Add skill” dropdown so GMs can embed any loaded skill by source.
 * @returns {Promise<Array<{ uuid: string, name: string, key: string, label: string }>>}
 */
export async function getNpcSkillAddOptions() {
    const rows = [];
    const seenUuid = new Set();

    const worldLabel = game.i18n?.localize?.("THIRDERA.Skills.SourceWorld") ?? "World";

    const pushDoc = (doc, sourceLabel) => {
        if (!doc || doc.type !== "skill" || seenUuid.has(doc.uuid)) return;
        seenUuid.add(doc.uuid);
        const key = (doc.system?.key ?? "").trim();
        const baseName = doc.name || "Skill";
        const label = sourceLabel ? `${baseName} — ${sourceLabel}` : baseName;
        rows.push({ uuid: doc.uuid, name: baseName, key, label });
    };

    for (const item of game.items?.contents ?? []) {
        if (item.type === "skill") pushDoc(item, worldLabel);
    }

    const packs = game.packs?.contents ?? [];
    for (const pack of packs) {
        if (!isItemCompendiumPack(pack)) continue;
        const packTitle = (pack.metadata?.label ?? pack.metadata?.name ?? pack.collection?.id ?? "").trim() || "Compendium";
        try {
            const docs = await loadSkillDocumentsFromItemPack(pack);
            for (const item of docs) pushDoc(item, packTitle);
        } catch (err) {
            console.warn("Third Era | getNpcSkillAddOptions: pack iteration error", pack?.metadata?.id, err);
        }
    }

    rows.sort((a, b) => (a.label || "").localeCompare(b.label || "", game.i18n?.lang ?? "en", { sensitivity: "base" }));
    return rows;
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
