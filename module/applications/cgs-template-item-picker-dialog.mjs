/**
 * Browse feats, creature features, class features, and gear to set `system.cgsTemplateUuid` on an item sheet.
 */
import { documentEligibleAsCgsTemplatePicker } from "../logic/cgs-template-link-display.mjs";
import { fuzzyScore } from "../utils/fuzzy.mjs";

const CGS_TEMPLATE_ITEM_TYPES = ["feat", "creatureFeature", "feature", "armor", "weapon", "equipment"];

/** @type {readonly string[]} */
const CGS_TEMPLATE_PACK_COLLECTIONS = Object.freeze([
    "thirdera.thirdera_feats",
    "thirdera.thirdera_creature_features",
    "thirdera.thirdera_features",
    "thirdera.thirdera_armor",
    "thirdera.thirdera_weapons",
    "thirdera.thirdera_equipment"
]);

/**
 * @param {unknown} pack
 * @returns {boolean}
 */
function isItemCompendiumPack(pack) {
    return String(pack?.documentName ?? "") === "Item";
}

/**
 * @param {{ editingItemUuid?: string }} [options]
 * @returns {Promise<Array<{ uuid: string, name: string, type: string, label: string }>>}
 */
export async function gatherCgsTemplatePickerRows(options = {}) {
    const skipUuid = (options.editingItemUuid ?? "").trim();
    /** @type {Array<{ uuid: string, name: string, type: string, label: string }>} */
    const rows = [];
    const seen = new Set();

    const worldLabel =
        typeof game !== "undefined" && game.i18n?.localize
            ? game.i18n.localize("THIRDERA.CGS.TemplateLinkSourceWorld")
            : "World";

    /** @param {import("@client/documents/item.mjs").default} doc */
    const pushDoc = (doc, sourceLabel) => {
        if (!doc || typeof doc !== "object") return;
        const t = /** @type {{ type?: string, uuid?: string, name?: string }} */ (doc).type;
        if (!t || !CGS_TEMPLATE_ITEM_TYPES.includes(t)) return;
        const uuid = String(/** @type {{ uuid?: string }} */ (doc).uuid ?? "").trim();
        if (!uuid || seen.has(uuid)) return;
        if (skipUuid && uuid === skipUuid) return;
        if (!documentEligibleAsCgsTemplatePicker(doc)) return;
        seen.add(uuid);
        const name = String(/** @type {{ name?: string }} */ (doc).name ?? "—");
        rows.push({
            uuid,
            name,
            type: t,
            label: `${name} — ${sourceLabel}`
        });
    };

    for (const item of game.items?.contents ?? []) {
        pushDoc(item, worldLabel);
    }

    for (const packId of CGS_TEMPLATE_PACK_COLLECTIONS) {
        const pack = game.packs?.get?.(packId);
        if (!pack || !isItemCompendiumPack(pack)) continue;
        const packTitle =
            (pack.metadata?.label ?? pack.metadata?.name ?? pack.collection ?? packId).trim() || "Compendium";
        try {
            await pack.getIndex({ fields: ["type", "name"] });
            const ids = [...pack.index.values()]
                .filter((row) => row?.type && CGS_TEMPLATE_ITEM_TYPES.includes(row.type))
                .map((row) => row._id)
                .filter(Boolean);
            const chunkSize = 150;
            for (let i = 0; i < ids.length; i += chunkSize) {
                const slice = ids.slice(i, i + chunkSize);
                const batch = await pack.getDocuments({ _id__in: slice });
                for (const doc of batch) pushDoc(doc, packTitle);
            }
        } catch (err) {
            console.warn(`Third Era | gatherCgsTemplatePickerRows: pack "${packId}"`, err);
        }
    }

    rows.sort((a, b) =>
        (a.label || "").localeCompare(b.label || "", game.i18n?.lang ?? "en", { sensitivity: "base" })
    );
    return rows;
}

export class CgsTemplateItemPickerDialog extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2
) {
    static DEFAULT_OPTIONS = {
        id: "cgs-template-item-picker-dialog",
        classes: ["thirdera", "cgs-template-item-picker-dialog", "skill-picker-dialog"],
        position: { width: 440, height: 480 },
        window: {
            frame: true,
            title: "THIRDERA.CGS.TemplateLinkPickerTitle",
            icon: "fa-solid fa-book",
            resizable: true
        },
        actions: {
            selectRow: CgsTemplateItemPickerDialog.#onSelectRow
        }
    };

    static PARTS = {
        main: {
            template: "systems/thirdera/templates/apps/cgs-template-item-picker-dialog.hbs",
            scrollable: [".cgs-template-picker-list"]
        }
    };

    /** @type {Array<{ uuid: string, name: string, type: string, label: string }>} */
    allRows = [];

    /** @type {string} */
    query = "";

    /** @type {number[]} */
    _bringToFrontTimeouts = [];

    /** @param {{ resolve?: (uuid: string) => void, onClose?: () => void, editingItemUuid?: string }} options */
    constructor(options = {}) {
        super(options);
        this._resolve = options.resolve ?? (() => {});
        this._onClose = options.onClose ?? (() => {});
        this._editingItemUuid = options.editingItemUuid ?? "";
    }

    async close(options = {}) {
        for (const id of this._bringToFrontTimeouts) clearTimeout(id);
        this._bringToFrontTimeouts = [];
        if (this._onClose) this._onClose();
        return super.close(options);
    }

    async render(force = false) {
        const out = await super.render(force);
        const bring = () => {
            if (typeof this.bringToFront === "function") this.bringToFront();
        };
        bring();
        if (this.element) {
            this.element.__app = this;
            this.element.addEventListener("mousedown", () => bring(), true);
            const searchInput = this.element.querySelector('input[name="cgsTemplatePickerSearch"]');
            if (searchInput) {
                const bringAndFocus = () => {
                    bring();
                    const input = this.element?.querySelector('input[name="cgsTemplatePickerSearch"]');
                    if (input) input.focus();
                };
                for (const ms of [50, 100, 200]) {
                    this._bringToFrontTimeouts.push(setTimeout(bringAndFocus, ms));
                }
                searchInput.addEventListener("input", async () => {
                    const value = searchInput.value ?? "";
                    const start = searchInput.selectionStart ?? value.length;
                    const end = searchInput.selectionEnd ?? value.length;
                    this.query = value;
                    await this.render();
                    const newInput = this.element?.querySelector('input[name="cgsTemplatePickerSearch"]');
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
        if (!this.allRows.length) {
            this.allRows = await gatherCgsTemplatePickerRows({ editingItemUuid: this._editingItemUuid });
        }
        const q = (this.query || "").trim().toLowerCase();
        let filtered = this.allRows;
        if (q) {
            filtered = this.allRows
                .map((r) => ({
                    ...r,
                    ...fuzzyScore(q, r.label, r.type)
                }))
                .filter((r) => r.matched)
                .sort((a, b) => a.score - b.score);
        }
        return {
            ...context,
            rows: filtered,
            query: this.query ?? ""
        };
    }

    static #onSelectRow(event, target) {
        const uuid = target?.dataset?.uuid ?? target?.closest?.("[data-uuid]")?.dataset?.uuid;
        if (!uuid) return;
        const el = target?.closest?.(".cgs-template-item-picker-dialog");
        const app =
            el?.__app ??
            Object.values(game.applications?.apps ?? {}).find((a) => a.constructor?.name === "CgsTemplateItemPickerDialog");
        if (app?._resolve) {
            app._resolve(String(uuid));
            app.close();
        }
    }

}
