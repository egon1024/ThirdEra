/**
 * Apply damage/healing dialog: amount, type (Damage | Healing), targets from canvas selection or explicit list.
 * Phase 1: open via game.thirdera.applyDamageHealing.openDialog() (macro/console).
 * Phase 2: sheet, chat, token entry points use openForSelection() or openWithOptions().
 * Phase 3: temp HP, nonlethal, healing reduces nonlethal (openWithOptions accepts nonlethal).
 * Phase 4: combined attack & damage roll; Apply from chat uses damage total on combined messages.
 */
import { applyDamageOrHealing } from "../logic/apply-damage-healing.mjs";

/**
 * Get actors from currently controlled (selected) tokens that have HP data.
 * @returns {Actor[]}
 */
function getTargetActorsFromSelection() {
    const controlled = game.canvas?.tokens?.controlled ?? [];
    const actors = [];
    const seen = new Set();
    for (const token of controlled) {
        const actor = token.actor;
        if (!actor || seen.has(actor.id)) continue;
        const hp = actor.system?.attributes?.hp;
        if (hp && typeof hp.value === "number" && typeof hp.max === "number") {
            actors.push(actor);
            seen.add(actor.id);
        }
    }
    return actors;
}

export class ApplyDamageHealingDialog extends foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2
) {
    /** @override */
    static DEFAULT_OPTIONS = {
        id: "apply-damage-healing-dialog",
        classes: ["thirdera", "apply-damage-healing-dialog"],
        position: { width: 320, height: 360 },
        window: {
            title: "THIRDERA.ApplyDamageHealing.Title",
            icon: "fa-solid fa-heart-pulse",
            resizable: true
        },
        actions: {
            apply: ApplyDamageHealingDialog.#onApply,
            cancel: ApplyDamageHealingDialog.#onCancel
        }
    };

    /** @override */
    static PARTS = {
        main: {
            template: "systems/thirdera/templates/apps/apply-damage-healing-dialog.hbs"
        }
    };

    /** @type {Actor[]} */
    targetActors = [];

    /**
     * @param {Actor[]} [targetActors] - Pre-selected target actors (e.g. from token context).
     * @param {Object} [options] - Optional initial amount and mode for the form.
     * @param {number|string} [options.amount] - Pre-filled amount (e.g. from chat roll).
     * @param {string} [options.mode] - "damage" or "healing".
     * @param {boolean} [options.nonlethal] - When mode is damage, apply as nonlethal.
     */
    constructor(targetActors, options = {}) {
        super(options);
        this.targetActors = targetActors ?? [];
        if (options.amount !== undefined) this.amount = options.amount;
        if (options.mode === "healing" || options.mode === "damage") this.mode = options.mode;
        if (options.nonlethal === true) this.nonlethal = true;
    }

    /** @override */
    _prepareContext(_options) {
        const targetNames = this.targetActors.map((a) => a.name || "Unknown");
        const canApply = this.targetActors.length > 0;
        const mode = this.mode ?? "damage";
        const amount = this.amount ?? "";
        const nonlethal = Boolean(this.nonlethal);
        return {
            appId: this.id,
            targetNames,
            canApply,
            mode,
            amount,
            nonlethal
        };
    }

    /** @override */
    async _render(force, options = {}) {
        this.mode = this.mode ?? "damage";
        this.amount = this.amount ?? "";
        return super._render(force, options);
    }

    /** @override — attach submit listener when part DOM is ready so Enter doesn't reload the page */
    _attachPartListeners(partId, htmlElement, options) {
        super._attachPartListeners(partId, htmlElement, options);
        if (partId !== "main") return;
        const form = htmlElement?.classList?.contains("apply-damage-healing-dialog-form") ? htmlElement : htmlElement?.querySelector?.(".apply-damage-healing-dialog-form");
        if (!form) return;
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (this.targetActors.length > 0) this._doApply();
        });
        const body = htmlElement?.querySelector?.(".apply-damage-healing-dialog-body");
        const modeRadios = form?.querySelectorAll?.("input[name='mode']");
        if (body && modeRadios?.length) {
            const updateMode = () => {
                const checked = form.querySelector("input[name='mode']:checked");
                if (checked) body.dataset.mode = checked.value;
            };
            for (const radio of modeRadios) radio.addEventListener("change", updateMode);
        }
    }

    static #onApply(event, target) {
        const el = target?.closest?.("[data-appid]");
        const appId = el?.dataset?.appid;
        const app = appId ? foundry.applications.instances.get(appId) : null;
        if (!app || !(app instanceof ApplyDamageHealingDialog)) return;
        app._doApply();
    }

    static #onCancel(event, target) {
        const el = target?.closest?.("[data-appid]");
        const appId = el?.dataset?.appid;
        const app = appId ? foundry.applications.instances.get(appId) : null;
        if (!app || !(app instanceof ApplyDamageHealingDialog)) return;
        app.close();
    }

    async _doApply() {
        const form = this.element?.querySelector(".apply-damage-healing-dialog-form");
        if (!form) return;
        const amountInput = form.querySelector("input[name='amount']");
        const modeInput = form.querySelector("input[name='mode']:checked");
        const nonlethalInput = form.querySelector("input[name='nonlethal']");
        const amount = Math.max(0, Math.floor(parseInt(amountInput?.value, 10) || 0));
        const mode = modeInput?.value === "healing" ? "healing" : "damage";
        const nonlethal = mode === "damage" && nonlethalInput?.checked === true;

        const allowed = this.targetActors.filter((actor) => actor.canUserModify(game.user, "update"));
        if (allowed.length === 0) {
            ui.notifications?.warn(game.i18n.localize("THIRDERA.ApplyDamageHealing.NoPermission"));
            return;
        }
        if (amount === 0) {
            this.close();
            return;
        }

        const { updated, errors } = await applyDamageOrHealing(allowed, amount, mode, { nonlethal });
        if (errors.length) {
            ui.notifications?.warn(errors.join(" "));
        }
        const msg = mode === "damage"
            ? (nonlethal
                ? game.i18n.format("THIRDERA.ApplyDamageHealing.AppliedNonlethalDamage", { amount, count: updated.length })
                : game.i18n.format("THIRDERA.ApplyDamageHealing.AppliedDamage", { amount, count: updated.length }))
            : game.i18n.format("THIRDERA.ApplyDamageHealing.AppliedHealing", { amount, count: updated.length });
        ui.notifications?.info(msg);
        this.close();
    }

    /**
     * Open the Apply damage/healing dialog for the current canvas selection.
     * Call from macro or console: game.thirdera.applyDamageHealing.openDialog()
     */
    static openForSelection() {
        const targetActors = getTargetActorsFromSelection();
        const dialog = new ApplyDamageHealingDialog(targetActors);
        dialog.render(true);
    }

    /**
     * Open the Apply damage/healing dialog with explicit targets and optional amount/mode.
     * Used by chat (amount + mode from roll), sheet (targets from selection), token (single actor).
     * @param {Object} [options]
     * @param {Actor[]} [options.targetActors] - Target actors (default: from canvas selection).
     * @param {number|string} [options.amount] - Pre-filled amount (e.g. roll total).
     * @param {string} [options.mode] - "damage" or "healing".
     */
    static openWithOptions(options = {}) {
        const targetActors = options.targetActors ?? getTargetActorsFromSelection();
        const dialog = new ApplyDamageHealingDialog(targetActors, {
            amount: options.amount,
            mode: options.mode,
            nonlethal: options.nonlethal
        });
        dialog.render(true);
    }
}
