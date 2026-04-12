/**
 * Concentration rolls from spell cast chat messages (Track A, A3 defensive + A4 custom/damage dialog).
 * Mirrors spell-save-from-chat: renderChatMessageHTML + delegated click on ui.chat.
 */

import { defensiveDc } from "./concentration-dcs.mjs";
import { parseConcentrationOtherInputs } from "./concentration-from-chat-helpers.mjs";

const CONCENTRATION_DEFENSIVE_SELECTOR = ".thirdera-concentration-from-chat";
const CONCENTRATION_OTHER_SELECTOR = ".thirdera-concentration-other-from-chat";

/**
 * Shared eligibility: cast message with spell level, caster actor, and roll permission.
 * @param {ChatMessage} message
 * @returns {{ spellLevel: number, actor: Actor }|null}
 */
function getConcentrationCastBase(message) {
    const spellCast = message?.flags?.thirdera?.spellCast;
    if (!spellCast) return null;
    const spellLevel = spellCast.spellLevel;
    if (typeof spellLevel !== "number" || !Number.isFinite(spellLevel)) return null;
    const actor = message.speakerActor;
    if (!actor || typeof actor.rollConcentrationCheck !== "function") return null;
    if (!(game.user.isGM || actor.testUserPermission(game.user, "OWNER"))) return null;
    return { spellLevel, actor };
}

/**
 * @param {ChatMessage} message
 * @returns {{ spellLevel: number, dc: number, actor: Actor }|null}
 */
function getConcentrationCastContext(message) {
    const base = getConcentrationCastBase(message);
    if (!base) return null;
    const dc = defensiveDc(base.spellLevel);
    if (!Number.isFinite(dc)) return null;
    return { spellLevel: base.spellLevel, dc, actor: base.actor };
}

/**
 * Read damage / custom DC field strings from the A4 dialog (jQuery or DOM).
 * @param {jQuery|HTMLElement} html
 * @returns {{ damageStr: string, customStr: string }}
 */
function readConcentrationOtherDialogFieldStrings(html) {
    let damageStr = "";
    let customStr = "";
    if (typeof html?.find === "function") {
        damageStr = String(html.find('input[name="damage"]').val() ?? "").trim();
        customStr = String(html.find('input[name="customDc"]').val() ?? "").trim();
    } else {
        const root = html?.querySelector?.(".thirdera-concentration-other-dialog") ?? html;
        damageStr = (root?.querySelector?.('input[name="damage"]')?.value ?? "").trim();
        customStr = (root?.querySelector?.('input[name="customDc"]')?.value ?? "").trim();
    }
    return { damageStr, customStr };
}

/**
 * Read damage / custom DC from the A4 dialog; prefer damage when that field is non-empty.
 * @param {jQuery|HTMLElement} html - Dialog callback passes jQuery in Foundry.
 * @param {number} spellLevel
 * @returns {{ dc: number, label: string }|{ error: string }}
 */
function parseConcentrationOtherDialog(html, spellLevel) {
    const { damageStr, customStr } = readConcentrationOtherDialogFieldStrings(html);
    const parsed = parseConcentrationOtherInputs(damageStr, customStr, spellLevel);
    if (!parsed.ok) return { error: parsed.errorKey };
    const label =
        parsed.labelKind === "damage"
            ? game.i18n.format("THIRDERA.Concentration.DamageWhileCastingLabel", { damage: parsed.damage })
            : game.i18n.localize("THIRDERA.Concentration.CustomDcLabel");
    return { dc: parsed.dc, label };
}

/**
 * @param {Actor} actor
 * @param {number} spellLevel
 */
function showConcentrationOtherDialog(actor, spellLevel) {
    const spellLevelHint = game.i18n.format("THIRDERA.Concentration.OtherSpellLevelNote", { level: spellLevel });
    const content = `
    <form class="thirdera-concentration-other-dialog">
      <p class="notes">${spellLevelHint}</p>
      <div class="form-group">
        <label>${game.i18n.localize("THIRDERA.Concentration.OtherDamageLabel")}</label>
        <input type="number" name="damage" min="0" step="1" placeholder=""/>
        <p class="hint">${game.i18n.localize("THIRDERA.Concentration.OtherDamageHint")}</p>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("THIRDERA.Concentration.OtherCustomDcLabel")}</label>
        <input type="number" name="customDc" step="any" placeholder=""/>
        <p class="hint">${game.i18n.localize("THIRDERA.Concentration.OtherCustomDcHint")}</p>
      </div>
    </form>`;

    new Dialog({
        title: game.i18n.localize("THIRDERA.Concentration.OtherDialogTitle"),
        content,
        buttons: {
            roll: {
                icon: '<i class="fas fa-dice-d20"></i>',
                label: game.i18n.localize("THIRDERA.Concentration.OtherRoll"),
                callback: async (html) => {
                    const parsed = parseConcentrationOtherDialog(html, spellLevel);
                    if ("error" in parsed) {
                        ui.notifications.warn(game.i18n.localize(parsed.error));
                        return false;
                    }
                    await actor.rollConcentrationCheck({ dc: parsed.dc, label: parsed.label });
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: game.i18n.localize("Cancel")
            }
        }
    }).render(true);
}

function registerConcentrationFromChatEntryPoints() {
    Hooks.on("renderChatMessageHTML", (message, html) => {
        const base = getConcentrationCastBase(message);
        if (!base) return;

        const wrap = document.createElement("div");
        wrap.className = "thirdera-concentration-from-chat-wrap";

        const dc = defensiveDc(base.spellLevel);
        if (Number.isFinite(dc)) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "thirdera-concentration-from-chat thirdera-chat-apply-btn";
            btn.dataset.messageId = message.id;
            btn.title = game.i18n.format("THIRDERA.Concentration.RollDefensiveHint", { dc });
            btn.textContent = game.i18n.localize("THIRDERA.Concentration.RollDefensiveButton");
            wrap.append(btn);
        }

        const otherBtn = document.createElement("button");
        otherBtn.type = "button";
        otherBtn.className = "thirdera-concentration-other-from-chat thirdera-chat-apply-btn";
        otherBtn.dataset.messageId = message.id;
        otherBtn.title = game.i18n.localize("THIRDERA.Concentration.RollOtherHint");
        otherBtn.textContent = game.i18n.localize("THIRDERA.Concentration.RollOtherButton");
        wrap.append(otherBtn);

        const insertPoint = html.querySelector?.(".thirdera.cast-message") ?? html.querySelector?.(".message-content") ?? html;
        if (insertPoint) insertPoint.appendChild(wrap);
    });

    Hooks.on("ready", () => {
        const container = ui.chat?.element;
        if (!container) return;
        container.addEventListener("click", async (e) => {
            const otherBtn = e.target?.closest?.(CONCENTRATION_OTHER_SELECTOR);
            if (otherBtn) {
                e.preventDefault();
                const messageId = otherBtn.dataset?.messageId;
                const message = game.messages?.get(messageId);
                const base = message ? getConcentrationCastBase(message) : null;
                if (!base) {
                    ui.notifications.warn(game.i18n.localize("THIRDERA.Concentration.NoCasterOrPermission"));
                    return;
                }
                showConcentrationOtherDialog(base.actor, base.spellLevel);
                return;
            }

            const btn = e.target?.closest?.(CONCENTRATION_DEFENSIVE_SELECTOR);
            if (!btn) return;
            e.preventDefault();
            const messageId = btn.dataset?.messageId;
            const message = game.messages?.get(messageId);
            const ctx = message ? getConcentrationCastContext(message) : null;
            if (!ctx) {
                ui.notifications.warn(game.i18n.localize("THIRDERA.Concentration.NoCasterOrPermission"));
                return;
            }
            const label = game.i18n.localize("THIRDERA.Concentration.DefensiveCastingLabel");
            await ctx.actor.rollConcentrationCheck({ dc: ctx.dc, label });
        });
    });

    Hooks.on("getChatMessageContextOptions", (_app, options) => {
        options.push({
            name: game.i18n.localize("THIRDERA.Concentration.RollConcentrationContextMenu"),
            icon: "<i class=\"fa-solid fa-brain\"></i>",
            condition: (li) => {
                const message = game.messages?.get(li?.dataset?.messageId);
                return !!getConcentrationCastBase(message);
            },
            callback: async (li) => {
                const message = game.messages?.get(li?.dataset?.messageId);
                const base = message ? getConcentrationCastBase(message) : null;
                if (base) showConcentrationOtherDialog(base.actor, base.spellLevel);
            }
        });
    });
}

Hooks.once("init", () => {
    registerConcentrationFromChatEntryPoints();
});
