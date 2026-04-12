/**
 * Roll save from spell cast message: chat button and context menu.
 * Phase A: one "Roll save" button; actor picker when clicked.
 * Phase B: per-target "Roll save (Name)" buttons when message has targetActorUuids.
 */

import { getSpellCastDataFromMessage } from "./spell-save-from-chat-helpers.mjs";

const ROLL_SAVE_BUTTON_SELECTOR = ".thirdera-spell-save-from-chat";

/**
 * Actors the user can roll a save for (owned or GM sees all).
 * @returns {Actor[]}
 */
function getRollableActors() {
    return game.actors.filter(
        (a) => (a.type === "character" || a.type === "npc") && a.system?.saves && (game.user.isGM || a.testUserPermission(game.user, "OWNER"))
    );
}

/**
 * Show actor picker dialog, then roll save for the chosen actor.
 * @param {string} saveType - fort | ref | will
 * @param {number} dc
 * @param {string} [preselectedActorUuid] - If set and user has permission, use this actor without showing picker when only one intent.
 */
async function rollSaveWithActorPicker(saveType, dc, preselectedActorUuid) {
    const actors = getRollableActors();
    if (actors.length === 0) {
        ui.notifications.warn(game.i18n.localize("THIRDERA.SpellSave.NoActorToRoll"));
        return;
    }

    let actor = null;
    if (preselectedActorUuid) {
        actor = await foundry.utils.fromUuid(preselectedActorUuid);
        if (actor?.system?.saves && (game.user.isGM || actor.testUserPermission(game.user, "OWNER"))) {
            await actor.rollSavingThrow(saveType, { dc });
            return;
        }
    }

    const options = actors.map((a) => `<option value="${a.uuid}">${a.name}</option>`).join("");
    const content = `
    <form class="thirdera-spell-save-picker">
      <div class="form-group">
        <label>${game.i18n.localize("THIRDERA.SpellSave.ChooseWhoRolls")}</label>
        <select name="actorUuid">${options}</select>
      </div>
    </form>`;

    new Dialog({
        title: game.i18n.localize("THIRDERA.SpellSave.RollSaveVsDC"),
        content,
        buttons: {
            roll: {
                // Dialog V1 template renders {{{button.icon}}} as HTML; a bare class string shows up as button text.
                icon: '<i class="fas fa-dice-d20"></i>',
                label: game.i18n.localize("THIRDERA.SpellSave.RollSave"),
                callback: async (html) => {
                    const uuid =
                        (typeof html?.find === "function" && html.find('select[name="actorUuid"]').val?.()) ||
                        html?.querySelector?.('select[name="actorUuid"]')?.value;
                    if (!uuid) return;
                    const chosen = await foundry.utils.fromUuid(uuid);
                    if (chosen?.rollSavingThrow) await chosen.rollSavingThrow(saveType, { dc });
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: game.i18n.localize("Cancel")
            }
        }
    }).render(true);
}

/**
 * Register chat entry points: renderChatMessageHTML (Roll save button) and getChatMessageContextOptions.
 */
function registerSpellSaveEntryPoints() {
    Hooks.on("renderChatMessageHTML", (message, html) => {
        const data = getSpellCastDataFromMessage(message);
        if (!data) return;

        const saveLabel = CONFIG.THIRDERA?.Saves?.[data.saveType] ?? data.saveType;
        const targetUuids = data.targetActorUuids ?? [];

        const wrap = document.createElement("div");
        wrap.className = "thirdera-spell-save-from-chat-wrap";

        if (targetUuids.length > 0) {
            for (const uuid of targetUuids) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "thirdera-spell-save-from-chat thirdera-chat-apply-btn";
                btn.dataset.saveType = data.saveType;
                btn.dataset.dc = String(data.dc);
                btn.dataset.messageId = message.id;
                btn.dataset.actorUuid = uuid;
                btn.title = game.i18n.format("THIRDERA.SpellSave.RollSaveForHint", { name: "" });
                btn.textContent = game.i18n.format("THIRDERA.SpellSave.RollSaveFor", { name: "…" });
                wrap.append(btn);
            }
            const resolveNames = async () => {
                for (const btn of wrap.querySelectorAll("[data-actor-uuid]")) {
                    const u = btn.dataset.actorUuid;
                    try {
                        const doc = await foundry.utils.fromUuid(u);
                        const name = doc?.name ?? "?";
                        btn.title = game.i18n.format("THIRDERA.SpellSave.RollSaveForHint", { name });
                        btn.textContent = game.i18n.format("THIRDERA.SpellSave.RollSaveFor", { name });
                    } catch (_) {
                        btn.textContent = game.i18n.format("THIRDERA.SpellSave.RollSaveFor", { name: "?" });
                    }
                }
            };
            resolveNames();
        } else {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "thirdera-spell-save-from-chat thirdera-chat-apply-btn";
            btn.dataset.saveType = data.saveType;
            btn.dataset.dc = String(data.dc);
            btn.dataset.messageId = message.id;
            btn.title = game.i18n.localize("THIRDERA.SpellSave.RollSaveHint");
            btn.textContent = game.i18n.format("THIRDERA.SpellSave.RollSaveLabel", { save: saveLabel });
            wrap.append(btn);
        }

        const insertPoint = html.querySelector?.(".thirdera.cast-message") ?? html.querySelector?.(".message-content") ?? html;
        if (insertPoint) insertPoint.appendChild(wrap);
    });

    Hooks.on("ready", () => {
        const container = ui.chat?.element;
        if (!container) return;
        container.addEventListener("click", async (e) => {
            const btn = e.target?.closest?.(ROLL_SAVE_BUTTON_SELECTOR);
            if (!btn) return;
            e.preventDefault();
            const saveType = btn.dataset?.saveType;
            const dc = parseInt(btn.dataset?.dc, 10);
            const actorUuid = btn.dataset?.actorUuid || null;
            if (!saveType || !Number.isFinite(dc)) return;
            await rollSaveWithActorPicker(saveType, dc, actorUuid || undefined);
        });
    });

    Hooks.on("getChatMessageContextOptions", (_app, options) => {
        options.push({
            name: game.i18n.localize("THIRDERA.SpellSave.RollSaveContextMenu"),
            icon: "<i class=\"fa-solid fa-shield-halved\"></i>",
            condition: (li) => {
                const message = game.messages?.get(li?.dataset?.messageId);
                return !!getSpellCastDataFromMessage(message);
            },
            callback: async (li) => {
                const message = game.messages?.get(li?.dataset?.messageId);
                const data = message ? getSpellCastDataFromMessage(message) : null;
                if (data) await rollSaveWithActorPicker(data.saveType, data.dc);
            }
        });
    });
}

Hooks.once("init", () => {
    registerSpellSaveEntryPoints();
});
