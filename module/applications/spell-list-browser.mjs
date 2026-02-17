/**
 * Spell List Browser: view all spells available to a character class.
 * Allows selecting a class, viewing spells by level (and school for arcane casters),
 * clicking to open spell sheets, and dragging spells to actors or domains.
 */
import { getAllClasses, getSpellsForClass } from "../logic/class-spell-list.mjs";

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

    /** Currently selected class (from class selector). */
    selectedClass = null;

    /** Search/filter term for spells. */
    searchTerm = "";

    /** @override */
    async _prepareContext(options) {
        const classes = await getAllClasses();
        this._cachedClasses = classes;
        const selectedClass = this.selectedClass ?? null;
        // #region agent log
        fetch("http://127.0.0.1:7244/ingest/3e68fb46-28cf-4993-8150-24eb15233806",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:"spell-list-browser.mjs:_prepareContext",message:"selectedClass resolve",data:{thisSelectedClass:!!this.selectedClass,thisSelectedClassUuid:this.selectedClass?.uuid,resolvedUuid:selectedClass?.uuid,resolvedName:selectedClass?.name,classesFirstUuid:classes[0]?.uuid},timestamp:Date.now(),hypothesisId:"H8"})}).catch(()=>{});
        // #endregion

        let spellsByLevel = [];
        let isArcane = false;

        if (selectedClass?.spellListKey) {
            const rawSpells = await getSpellsForClass(selectedClass.spellListKey);
            const casterType = (selectedClass.casterType || "").toLowerCase();
            const spellListKey = (selectedClass.spellListKey || "").toLowerCase();
            // Infer arcane from casterType or from spell list key (Bard, Sorcerer, Wizard use arcane lists)
            const arcaneKeys = ["sorcererwizard", "bard"];
            isArcane = casterType === "arcane" || arcaneKeys.includes(spellListKey);
            // #region agent log
            fetch("http://127.0.0.1:7244/ingest/3e68fb46-28cf-4993-8150-24eb15233806",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:"spell-list-browser.mjs:_prepareContext",message:"spell prep",data:{selectedClassName:selectedClass?.name,selectedClassUuid:selectedClass?.uuid,spellListKey:selectedClass?.spellListKey,rawSpellsLen:rawSpells?.length,isArcane,firstLevelEntries:rawSpells?.length?([...new Map(rawSpells.map((e)=>[e.level,e])).entries()].slice(0,3)):[]},timestamp:Date.now(),hypothesisId:"H6"})}).catch(()=>{});
            // #endregion

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
        }

        // #region agent log
        const firstGroup = spellsByLevel[0];
        fetch("http://127.0.0.1:7244/ingest/3e68fb46-28cf-4993-8150-24eb15233806",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:"spell-list-browser.mjs:_prepareContext",message:"context return",data:{selectedClassUuid:selectedClass?.uuid,selectedClassName:selectedClass?.name,isArcane,spellsByLevelLen:spellsByLevel.length,hasSpells:spellsByLevel.length>0,firstLevelSpellsLen:firstGroup?.spells?.length,firstSpellHasSchoolName:!!firstGroup?.spells?.[0]?.schoolName},timestamp:Date.now(),hypothesisId:"H7"})}).catch(()=>{});
        // #endregion
        return {
            classes,
            selectedClass,
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
        const select = root?.querySelector?.('select[name="selectedClass"]');
        if (select) {
            select.addEventListener("change", async (event) => {
                const uuid = event.target.value;
                const classes = this._cachedClasses ?? [];
                const found = uuid ? classes.find((c) => c.uuid === uuid) ?? null : null;
                this.selectedClass = found;
                // #region agent log
                fetch("http://127.0.0.1:7244/ingest/3e68fb46-28cf-4993-8150-24eb15233806",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:"spell-list-browser.mjs:change",message:"select change",data:{uuid,uuidLen:uuid?.length,found:!!found,foundUuid:found?.uuid,classesUuids:classes.slice(0,3).map((c)=>c.uuid)},timestamp:Date.now(),hypothesisId:"H9"})}).catch(()=>{});
                // #endregion
                await this.render(true);
            });
        }

        const searchInput = root?.querySelector?.('input[name="search"]');
        if (searchInput) {
            const fuzzyMatch = (text, query) => {
                if (!text || !query) return true;
                const s = text.toLowerCase();
                let idx = 0;
                for (const c of query) {
                    const pos = s.indexOf(c, idx);
                    if (pos < 0) return false;
                    idx = pos + 1;
                }
                return true;
            };
            const levenshtein = (a, b) => {
                if (!a.length) return b.length;
                if (!b.length) return a.length;
                const matrix = [];
                for (let i = 0; i <= b.length; i++) matrix[i] = [i];
                for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
                for (let i = 1; i <= b.length; i++) {
                    for (let j = 1; j <= a.length; j++) {
                        matrix[i][j] =
                            b[i - 1] === a[j - 1]
                                ? matrix[i - 1][j - 1]
                                : 1 + Math.min(matrix[i - 1][j - 1], matrix[i][j - 1], matrix[i - 1][j]);
                    }
                }
                return matrix[b.length][a.length];
            };
            const spellMatches = (name, query) => {
                if (!query) return true;
                if (fuzzyMatch(name, query)) return true;
                const q = query.toLowerCase();
                const maxEdits = q.length <= 4 ? 1 : q.length <= 7 ? 2 : 3;
                const words = (name || "").toLowerCase().split(/\s+/).filter(Boolean);
                for (const word of words) {
                    if (Math.abs(word.length - q.length) > maxEdits) continue;
                    if (levenshtein(q, word) <= maxEdits) return true;
                }
                return false;
            };
            const noResultsEl = root?.querySelector?.(".spell-search-no-results");
            const HIDDEN_CLASS = "spell-search-hidden";
            searchInput.addEventListener("input", () => {
                this.searchTerm = searchInput.value ?? "";
                const query = (this.searchTerm || "").trim().toLowerCase().replace(/\s+/g, " ") || "";
                const spellItems = root?.querySelectorAll?.(".spell-item[data-spell-name]") ?? [];
                let visibleCount = 0;
                for (const el of spellItems) {
                    const name = el.dataset.spellName ?? "";
                    const show = !query || spellMatches(name, query);
                    el.classList.toggle(HIDDEN_CLASS, !show);
                    if (show) visibleCount++;
                }
                for (const group of root?.querySelectorAll?.(".spell-school-group") ?? []) {
                    const anyVisible = group.querySelector(`.spell-item:not(.${HIDDEN_CLASS})`);
                    group.classList.toggle(HIDDEN_CLASS, !anyVisible);
                }
                for (const levelGroup of root?.querySelectorAll?.(".spell-level-group") ?? []) {
                    const anyVisible = levelGroup.querySelector(`.spell-item:not(.${HIDDEN_CLASS})`);
                    levelGroup.classList.toggle(HIDDEN_CLASS, !anyVisible);
                }
                if (noResultsEl) {
                    noResultsEl.classList.toggle(HIDDEN_CLASS, !(query && visibleCount === 0));
                }
            });
            if (searchInput.value?.trim()) searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        }

        // #region agent log
        setTimeout(()=>{
            const appEl=this.element?.closest?.(".window-app")??this.element;
            const hasThirdera=!!(appEl?.classList?.contains?.("thirdera")||root?.closest?.(".thirdera"));
            const bodyEl=root?.querySelector?.(".spell-list-body");
            const bodyBg=bodyEl?getComputedStyle(bodyEl).backgroundColor:"N/A";
            const spellItems=root?.querySelectorAll?.(".spell-item")??[];
            const schoolGroups=root?.querySelectorAll?.(".spell-school-group")??[];
            const iconEl=root?.querySelector?.(".spell-item .item-image i, .spell-item .item-image img");
            const iconColor=iconEl?getComputedStyle(iconEl).color:"N/A";
            fetch("http://127.0.0.1:7244/ingest/3e68fb46-28cf-4993-8150-24eb15233806",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:"spell-list-browser.mjs:_attachPartListeners",message:"DOM/CSS check",data:{appElFound:!!appEl,windowClasses:appEl?.className,hasThirdera,bodyBg,spellItemCount:spellItems.length,schoolGroupCount:schoolGroups.length,iconColor,iconTag:iconEl?.tagName,selectValue:root?.querySelector?.("select[name=selectedClass]")?.value},timestamp:Date.now(),hypothesisId:"H1"})}).catch(()=>{});
        },100);
        // #endregion

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
            if (doc?.toDragData) {
                event.dataTransfer.setData("text/plain", JSON.stringify(doc.toDragData()));
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
        const select = form?.querySelector?.('select[name="selectedClass"]');
        if (!select) return;
        const app = [...(foundry.applications?.instances?.values() ?? [])].find(
            (a) => a.constructor?.name === "SpellListBrowser"
        );
        if (app) {
            const uuid = select.value;
            const classes = app._cachedClasses ?? [];
            app.selectedClass = classes.find((c) => c.uuid === uuid) ?? null;
            await app.render(true);
        }
    }
}
