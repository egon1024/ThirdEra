/**
 * Spell List Browser: view all spells available to a character class or domain.
 * Allows selecting a class or domain, viewing spells by level (and school for arcane class),
 * clicking to open spell sheets, and dragging spells to actors or domains.
 */
import { getAllClasses, getSpellsForClass } from "../logic/class-spell-list.mjs";
import { getAllDomains, getSpellsForDomain } from "../logic/domain-spells.mjs";
import { normalizeQuery, spellMatches, SPELL_SEARCH_HIDDEN_CLASS } from "../logic/spell-search.mjs";

export class SpellListBrowser extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2
) {
    /** @override */
    static DEFAULT_OPTIONS = {
        id: "spell-list-browser",
        classes: ["thirdera", "spell-list-browser"],
        position: { width: 520, height: 640 },
        window: {
            title: "THIRDERA.SpellListBrowser.Title",
            icon: "fa-solid fa-book-sparkles",
            resizable: true
        },
        actions: {
            changeClass: SpellListBrowser.#onChangeClass
        }
    };

    /** @override */
    static PARTS = {
        main: {
            template: "systems/thirdera/templates/apps/spell-list-browser.hbs",
            scrollable: [".spell-list-body"]
            // root: true removed — with root, priorElement.replaceChildren(htmlElement.children) moves form children
            // into content and leaves the form empty; the moved spell-list-body may not receive our styles or
            // the template output may differ. Without root, the form is inserted whole so content is intact.
        }
    };

    /** Currently selected source: { type: "class", uuid, name, spellListKey, casterType } or { type: "domain", uuid, name, domainKey }. */
    selectedSource = null;

    /** Search/filter term for spells. */
    searchTerm = "";

    /** @override */
    async _prepareContext(options) {
        const [classes, domains] = await Promise.all([getAllClasses(), getAllDomains()]);
        this._cachedClasses = classes;
        this._cachedDomains = domains;

        const selectedSource = this.selectedSource ?? (this.selectedClass ? { type: "class", ...this.selectedClass } : null);

        let spellsByLevel = [];
        let isArcane = false;

        if (selectedSource?.type === "class" && selectedSource?.spellListKey) {
            const rawSpells = await getSpellsForClass(selectedSource.spellListKey);
            const casterType = (selectedSource.casterType || "").toLowerCase();
            const spellListKey = (selectedSource.spellListKey || "").toLowerCase();
            const arcaneKeys = ["sorcererwizard", "bard"];
            isArcane = casterType === "arcane" || arcaneKeys.includes(spellListKey);

            // Group by level, then by school (arcane) or flat (divine)
            const byLevel = new Map();
            for (const entry of rawSpells) {
                const level = entry.level;
                if (!byLevel.has(level)) byLevel.set(level, []);
                byLevel.get(level).push(entry);
            }

            for (let level = 0; level <= 9; level++) {
                const entries = byLevel.get(level) || [];
                if (entries.length === 0) continue;

                if (isArcane) {
                    // Arcane: flat spells array (same structure as divine) so {{#each levelData.spells}} works.
                    // Include schoolName on each entry for inline school indicator.
                    const bySchool = new Map();
                    for (const e of entries) {
                        const school = (e.schoolName || e.schoolKey || "(No school)").trim() || "(No school)";
                        if (!bySchool.has(school)) bySchool.set(school, []);
                        bySchool.get(school).push(e);
                    }
                    const schools = [...bySchool.keys()].sort((a, b) => a.localeCompare(b));
                    const spells = [];
                    for (const school of schools) {
                        const spellList = bySchool.get(school);
                        spellList.sort((a, b) => (a.spell?.name || "").localeCompare(b.spell?.name || ""));
                        for (const e of spellList) {
                            spells.push({
                                spell: e.spell,
                                uuid: e.spell?.uuid ?? "",
                                name: e.spell?.name ?? "",
                                img: e.spell?.img ?? "",
                                schoolName: school
                            });
                        }
                    }
                    spellsByLevel.push({ level, spells, isArcane: true });
                } else {
                    const spells = entries
                        .slice()
                        .sort((a, b) => (a.spell?.name || "").localeCompare(b.spell?.name || ""))
                        .map((e) => ({
                            spell: e.spell,
                            uuid: e.spell?.uuid ?? "",
                            name: e.spell?.name ?? "",
                            img: e.spell?.img ?? ""
                        }));
                    spellsByLevel.push({ level, spells, isArcane: false });
                }
            }
        } else if (selectedSource?.type === "domain" && selectedSource?.domainKey) {
            const granted = getSpellsForDomain(selectedSource.domainKey);
            if (granted.length > 0) {
                const uniqueUuids = [...new Set(granted.map((g) => g.uuid).filter(Boolean))];
                const spellDocs = await Promise.all(uniqueUuids.map((uuid) => foundry.utils.fromUuid(uuid).catch(() => null)));
                const spellMap = new Map();
                for (const doc of spellDocs) {
                    if (doc?.uuid) spellMap.set(doc.uuid, doc);
                }

                const byLevel = new Map();
                for (const entry of granted) {
                    const level = entry.level;
                    if (level < 1 || level > 9) continue;
                    if (!byLevel.has(level)) byLevel.set(level, []);
                    const spell = spellMap.get(entry.uuid) ?? null;
                    byLevel.get(level).push({
                        spell,
                        uuid: entry.uuid,
                        name: spell?.name ?? entry.spellName ?? "",
                        img: spell?.img ?? ""
                    });
                }

                for (let level = 1; level <= 9; level++) {
                    const entries = byLevel.get(level) || [];
                    if (entries.length === 0) continue;
                    entries.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                    spellsByLevel.push({ level, spells: entries, isArcane: false });
                }
            }
        }

        const selectedValue = selectedSource ? `${selectedSource.type}:${selectedSource.uuid}` : "";
        const classesWithValue = classes.map((c) => ({ ...c, optionValue: `class:${c.uuid}` }));
        const domainsWithValue = domains.map((d) => ({ ...d, optionValue: `domain:${d.uuid}` }));

        return {
            classes: classesWithValue,
            domains: domainsWithValue,
            selectedSource,
            selectedValue,
            spellsByLevel,
            isArcane,
            searchTerm: this.searchTerm ?? "",
            hasSpells: spellsByLevel.length > 0
        };
    }

    /** @override */
    _attachPartListeners(partId, htmlElement, options) {
        super._attachPartListeners(partId, htmlElement, options);
        if (partId !== "main") return;

        // Query the live DOM: when root was true, content was in .window-content; without root, form is in DOM
        const content = this.element?.querySelector?.(".window-content") ?? this.element;
        const root = content ?? this.element;
        const select = root?.querySelector?.('select[name="selectedSource"]');
        if (select) {
            select.addEventListener("change", async (event) => {
                const value = event.target.value;
                if (!value) {
                    this.selectedSource = null;
                    await this.render(true);
                    return;
                }
                const colon = value.indexOf(":");
                const type = colon >= 0 ? value.slice(0, colon) : "class";
                const uuid = colon >= 0 ? value.slice(colon + 1) : value;
                const classes = this._cachedClasses ?? [];
                const domains = this._cachedDomains ?? [];
                if (type === "domain") {
                    const found = domains.find((d) => d.uuid === uuid) ?? null;
                    this.selectedSource = found ? { type: "domain", ...found } : null;
                } else {
                    const found = classes.find((c) => c.uuid === uuid) ?? null;
                    this.selectedSource = found ? { type: "class", ...found } : null;
                }
                await this.render(true);
            });
        }

        const searchInput = root?.querySelector?.('input[name="search"]');
        if (searchInput) {
            const noResultsEl = root?.querySelector?.(".spell-search-no-results");
            searchInput.addEventListener("input", () => {
                this.searchTerm = searchInput.value ?? "";
                const query = normalizeQuery(this.searchTerm);
                const spellItems = root?.querySelectorAll?.(".spell-item[data-spell-name]") ?? [];
                let visibleCount = 0;
                for (const el of spellItems) {
                    const name = el.dataset.spellName ?? "";
                    const show = !query || spellMatches(name, query);
                    el.classList.toggle(SPELL_SEARCH_HIDDEN_CLASS, !show);
                    if (show) visibleCount++;
                }
                for (const group of root?.querySelectorAll?.(".spell-school-group") ?? []) {
                    const anyVisible = group.querySelector(`.spell-item:not(.${SPELL_SEARCH_HIDDEN_CLASS})`);
                    group.classList.toggle(SPELL_SEARCH_HIDDEN_CLASS, !anyVisible);
                }
                for (const levelGroup of root?.querySelectorAll?.(".spell-level-group") ?? []) {
                    const anyVisible = levelGroup.querySelector(`.spell-item:not(.${SPELL_SEARCH_HIDDEN_CLASS})`);
                    levelGroup.classList.toggle(SPELL_SEARCH_HIDDEN_CLASS, !anyVisible);
                }
                if (noResultsEl) {
                    noResultsEl.classList.toggle(SPELL_SEARCH_HIDDEN_CLASS, !(query && visibleCount === 0));
                }
            });
            if (searchInput.value?.trim()) searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        }

        // Drag handlers for spell entries
        root?.querySelectorAll?.("[data-spell-uuid]").forEach((el) => {
            el.setAttribute("draggable", "true");
            el.addEventListener("dragstart", this._onSpellDragStart.bind(this));
        });
    }

    /**
     * Handle spell drag start - set drag data so drop targets (actor, domain) can import the spell.
     * @param {DragEvent} event
     */
    async _onSpellDragStart(event) {
        const uuid = event.currentTarget?.dataset?.spellUuid;
        if (!uuid) return;
        try {
            const doc = await foundry.utils.fromUuid(uuid);
            const dragData = doc?.toDragData?.();
            if (dragData) {
                event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
            }
        } catch (_) {
            // Ignore
        }
    }

    /**
     * Handle class selector change (via form action; fallback if JS change doesn't fire).
     * @param {Event} event
     */
    static async #onChangeClass(event) {
        event.preventDefault();
        const form = event.target?.closest?.("form");
        const select = form?.querySelector?.('select[name="selectedSource"]');
        if (!select) return;
        const app = [...(foundry.applications?.instances?.values() ?? [])].find(
            (a) => a.constructor?.name === "SpellListBrowser"
        );
        if (!app) return;
        const value = select.value;
        if (!value) {
            app.selectedSource = null;
            await app.render(true);
            return;
        }
        const colon = value.indexOf(":");
        const type = colon >= 0 ? value.slice(0, colon) : "class";
        const uuid = colon >= 0 ? value.slice(colon + 1) : value;
        const classes = app._cachedClasses ?? [];
        const domains = app._cachedDomains ?? [];
        if (type === "domain") {
            const found = domains.find((d) => d.uuid === uuid) ?? null;
            app.selectedSource = found ? { type: "domain", ...found } : null;
        } else {
            const found = classes.find((c) => c.uuid === uuid) ?? null;
            app.selectedSource = found ? { type: "class", ...found } : null;
        }
        await app.render(true);
    }
}
