/**
 * Take rest: optional natural healing plus reset spell cast/prepared counts, with chat summary.
 */
import { applyDamageOrHealing } from "../logic/apply-damage-healing.mjs";
import { getRestHealingAmount } from "../logic/rest-healing.mjs";

export class TakeRestDialog extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2
) {
    /** @override */
    static DEFAULT_OPTIONS = {
        id: "take-rest-dialog",
        classes: ["thirdera", "take-rest-dialog"],
        position: { width: 380, height: "auto" },
        window: {
            title: "THIRDERA.Rest.Title",
            icon: "fa-solid fa-campground",
            resizable: true
        },
        actions: {
            apply: TakeRestDialog.#onApply,
            cancel: TakeRestDialog.#onCancel
        }
    };

    /** @override */
    static PARTS = {
        main: {
            template: "systems/thirdera/templates/apps/take-rest-dialog.hbs"
        }
    };

    /** @type {Actor} */
    actor;

    /** @type {foundry.applications.sheets.ActorSheetV2|null} */
    sheet;

    /** @type {boolean} */
    resetCastCounts = true;

    /** @type {boolean} */
    resetPreparedCounts = false;

    /** @type {boolean} */
    applyNaturalHealing = true;

    /** Whether to show / allow prepared reset (prepared spellcasting classes only). */
    hasPreparedSpellcasting = false;

    /**
     * @param {Actor} actor
     * @param {object} [options]
     * @param {foundry.applications.sheets.ActorSheetV2|null} [options.sheet] - If set, re-rendered after a successful apply.
     * @param {boolean} [options.hasPreparedSpellcasting] - From sheet: any class with preparationType "prepared".
     * @param {boolean} [options.resetCastCounts]
     * @param {boolean} [options.resetPreparedCounts]
     * @param {boolean} [options.applyNaturalHealing]
     */
    constructor(actor, options = {}) {
        super(options);
        this.actor = actor;
        this.sheet = options.sheet ?? null;
        if (options.hasPreparedSpellcasting === true) this.hasPreparedSpellcasting = true;
        if (options.resetCastCounts === false) this.resetCastCounts = false;
        if (options.resetPreparedCounts === true) this.resetPreparedCounts = true;
        if (options.applyNaturalHealing === false) this.applyNaturalHealing = false;
    }

    /** @override */
    _prepareContext(options) {
        const actor = this.actor;
        const canApply = Boolean(actor?.canUserModify?.(game.user, "update"));
        const naturalHealingAmount = getRestHealingAmount(actor);
        const naturalHealingAmountHint = game.i18n.format("THIRDERA.Rest.NaturalHealingAmountHint", {
            amount: naturalHealingAmount
        });
        return {
            appId: this.id,
            characterName: actor?.name ?? "",
            canApply,
            naturalHealingAmount,
            naturalHealingAmountHint,
            resetCastCounts: this.resetCastCounts,
            resetPreparedCounts: this.resetPreparedCounts,
            applyNaturalHealing: this.applyNaturalHealing,
            hasPreparedSpellcasting: this.hasPreparedSpellcasting
        };
    }

    /** @override */
    _attachPartListeners(partId, htmlElement, options) {
        super._attachPartListeners(partId, htmlElement, options);
        if (partId !== "main") return;
        const form = htmlElement?.querySelector?.(".take-rest-dialog-form");
        if (!form) return;
        form.addEventListener("submit", (e) => e.preventDefault());
    }

    static #onApply(event, target) {
        const el = target?.closest?.("[data-appid]");
        const appId = el?.dataset?.appid;
        const app = appId ? foundry.applications.instances.get(appId) : null;
        if (!app || !(app instanceof TakeRestDialog)) return;
        app._doApply();
    }

    static #onCancel(event, target) {
        const el = target?.closest?.("[data-appid]");
        const appId = el?.dataset?.appid;
        const app = appId ? foundry.applications.instances.get(appId) : null;
        if (!app || !(app instanceof TakeRestDialog)) return;
        app.close();
    }

    async _doApply() {
        const form = this.element?.querySelector(".take-rest-dialog-form");
        if (!form) return;

        const actor = this.actor;
        if (!actor?.canUserModify?.(game.user, "update")) {
            ui.notifications?.warn(game.i18n.localize("THIRDERA.Rest.NoPermission"));
            return;
        }

        const applyHeal = form.querySelector("input[name='applyNaturalHealing']")?.checked === true;
        const resetCast = form.querySelector("input[name='resetCastCounts']")?.checked === true;
        const resetPrepared =
            this.hasPreparedSpellcasting
            && form.querySelector("input[name='resetPreparedCounts']")?.checked === true;

        let changed = false;
        const summaryParts = [];

        // 1) Natural healing
        if (applyHeal) {
            const amt = getRestHealingAmount(actor);
            const hp = actor.system?.attributes?.hp;
            if (amt > 0 && hp && typeof hp.value === "number") {
                const vBefore = hp.value;
                const nlBefore = Math.max(0, Math.floor(Number(hp.nonlethal)) || 0);
                const { updated, errors } = await applyDamageOrHealing([actor], amt, "healing");
                if (errors.length) {
                    ui.notifications?.warn(errors.join(" "));
                }
                if (updated.length) {
                    const vAfter = actor.system.attributes.hp.value;
                    const nlAfter = Math.max(0, Math.floor(Number(actor.system.attributes.hp.nonlethal)) || 0);
                    const effective = (vAfter - vBefore) + (nlBefore - nlAfter);
                    if (effective > 0) {
                        changed = true;
                        summaryParts.push(
                            game.i18n.format("THIRDERA.Rest.ChatSummaryHealing", { amount: effective })
                        );
                    }
                }
            }
        }

        // 2) Reset cast counts (embedded spells + CGS SLA grant counters)
        if (resetCast) {
            const toReset = actor.items.filter(
                (i) => i.type === "spell" && (i.system?.cast ?? 0) !== 0
            );
            if (toReset.length > 0) {
                changed = true;
                for (const item of toReset) {
                    await item.update({ "system.cast": 0 });
                }
                summaryParts.push(
                    game.i18n.format("THIRDERA.Rest.ChatSummaryResetCast", { count: toReset.length })
                );
            }
            const cg = actor.system?.cgsSpellGrantCasts;
            if (cg && typeof cg === "object") {
                const anyCgs = Object.values(cg).some((v) => (Number(v) || 0) !== 0);
                if (anyCgs) {
                    await actor.update({ "system.cgsSpellGrantCasts": {} });
                    changed = true;
                    summaryParts.push(game.i18n.localize("THIRDERA.Rest.ChatSummaryResetCgsGrantCasts"));
                }
            }
        }

        // 3) Reset prepared counts
        if (resetPrepared) {
            const toReset = actor.items.filter(
                (i) => i.type === "spell" && (i.system?.prepared ?? 0) !== 0
            );
            if (toReset.length > 0) {
                changed = true;
                for (const item of toReset) {
                    await item.update({ "system.prepared": 0 });
                }
                summaryParts.push(
                    game.i18n.format("THIRDERA.Rest.ChatSummaryResetPrepared", { count: toReset.length })
                );
            }
        }

        const chatBody = changed
            ? `<div class="thirdera take-rest-message"><p><strong>${foundry.utils.escapeHTML(actor.name)}</strong> ${game.i18n.localize("THIRDERA.Rest.ChatTakesRest")}</p>${summaryParts.map((p) => `<p>${p}</p>`).join("")}</div>`
            : `<div class="thirdera take-rest-message"><p><strong>${foundry.utils.escapeHTML(actor.name)}</strong> ${game.i18n.localize("THIRDERA.Rest.ChatNoChanges")}</p></div>`;

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: chatBody
        });

        ui.notifications?.info(
            changed
                ? game.i18n.localize("THIRDERA.Rest.NotifyComplete")
                : game.i18n.localize("THIRDERA.Rest.NotifyCompleteNoChanges")
        );

        this.close();
        if (this.sheet?.rendered) {
            await this.sheet.render(true);
        }
    }
}
