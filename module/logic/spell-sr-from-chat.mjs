/**
 * Spell penetration from spell cast chat (Track B, B4).
 * Caster (message speaker) rolls 1d20 + CL vs a target's SR; mirrors spell-save / concentration chat UX.
 */

import { getActorSpellResistance, spellAllowsPenetrationRoll } from "./spell-resistance-helpers.mjs";

const PENETRATION_BUTTON_SELECTOR = ".thirdera-spell-penetration-from-chat";

/**
 * Non-GMs: only actors they can at least observe (picker list).
 * @param {Actor} actor
 * @returns {boolean}
 */
function userMayPickActor(actor) {
    if (!actor) return false;
    if (game.user.isGM) return true;
    return actor.testUserPermission(game.user, "OBSERVER");
}

/**
 * @param {ChatMessage} message
 * @returns {{ casterLevel: number, spellName: string, targetActorUuids: string[] }|null}
 */
function getSpellPenetrationCastData(message) {
    const spellCast = message?.flags?.thirdera?.spellCast;
    if (!spellCast) return null;
    if (!spellAllowsPenetrationRoll(spellCast.srKey ?? "")) return null;
    const casterLevel = spellCast.casterLevel;
    if (typeof casterLevel !== "number" || !Number.isFinite(casterLevel)) return null;
    const caster = message.speakerActor;
    if (!caster || typeof caster.rollSpellPenetration !== "function") return null;
    if (!(game.user.isGM || caster.testUserPermission(game.user, "OWNER"))) return null;
    return {
        casterLevel,
        spellName: spellCast.spellName ?? "",
        targetActorUuids: Array.isArray(spellCast.targetActorUuids) ? spellCast.targetActorUuids : []
    };
}

/**
 * Actors with SR &gt; 0 the user may choose in the picker (when cast had no qualifying targets).
 * @returns {Actor[]}
 */
function getActorsWithSrForPicker() {
    return game.actors.filter(
        (a) =>
            (a.type === "character" || a.type === "npc") &&
            getActorSpellResistance(a) > 0 &&
            userMayPickActor(a)
    );
}

/**
 * @param {Actor} caster
 * @param {number} casterLevel
 * @param {string} spellName
 * @param {string} [preselectedTargetUuid]
 */
async function rollPenetrationWithTargetPicker(caster, casterLevel, spellName, preselectedTargetUuid) {
    if (preselectedTargetUuid) {
        try {
            const doc = await foundry.utils.fromUuid(preselectedTargetUuid);
            if (doc && doc.documentName === "Actor") {
                const sr = getActorSpellResistance(doc);
                if (sr > 0) {
                    await caster.rollSpellPenetration({
                        casterLevel,
                        spellResistance: sr,
                        label: spellName || undefined
                    });
                    return;
                }
            }
        } catch (_) {
            /* fall through to picker */
        }
    }

    const candidates = getActorsWithSrForPicker();
    if (candidates.length === 0) {
        ui.notifications.warn(game.i18n.localize("THIRDERA.SpellPenetration.NoSrTarget"));
        return;
    }

    const options = candidates
        .map((a) => {
            const sr = getActorSpellResistance(a);
            return `<option value="${a.uuid}">${a.name} (SR ${sr})</option>`;
        })
        .join("");

    const content = `
    <form class="thirdera-spell-penetration-picker">
      <div class="form-group">
        <label>${game.i18n.localize("THIRDERA.SpellPenetration.ChooseTarget")}</label>
        <select name="actorUuid">${options}</select>
      </div>
    </form>`;

    new Dialog({
        title: game.i18n.localize("THIRDERA.SpellPenetration.DialogTitle"),
        content,
        buttons: {
            roll: {
                icon: '<i class="fas fa-dice-d20"></i>',
                label: game.i18n.localize("THIRDERA.SpellPenetration.RollButton"),
                callback: async (html) => {
                    const uuid =
                        (typeof html?.find === "function" && html.find('select[name="actorUuid"]').val?.()) ||
                        html?.querySelector?.('select[name="actorUuid"]')?.value;
                    if (!uuid) return;
                    const chosen = await foundry.utils.fromUuid(uuid);
                    if (!chosen || chosen.documentName !== "Actor") return;
                    const sr = getActorSpellResistance(chosen);
                    if (sr <= 0) {
                        ui.notifications.warn(game.i18n.localize("THIRDERA.SpellPenetration.NoSrTarget"));
                        return;
                    }
                    await caster.rollSpellPenetration({
                        casterLevel,
                        spellResistance: sr,
                        label: spellName || undefined
                    });
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
 * @param {string} messageId
 * @param {string} [targetActorUuid]
 */
async function handlePenetrationButtonClick(messageId, targetActorUuid) {
    const message = game.messages?.get(messageId);
    const data = message ? getSpellPenetrationCastData(message) : null;
    if (!data) {
        ui.notifications.warn(game.i18n.localize("THIRDERA.SpellPenetration.NoCasterOrPermission"));
        return;
    }
    const caster = message.speakerActor;
    await rollPenetrationWithTargetPicker(caster, data.casterLevel, data.spellName, targetActorUuid);
}

function registerSpellPenetrationFromChat() {
    Hooks.on("renderChatMessageHTML", (message, html) => {
        const data = getSpellPenetrationCastData(message);
        if (!data) return;

        (async () => {
            const qualifying = [];
            for (const uuid of data.targetActorUuids) {
                try {
                    const doc = await foundry.utils.fromUuid(uuid);
                    if (!doc || doc.documentName !== "Actor") continue;
                    const sr = getActorSpellResistance(doc);
                    if (sr <= 0) continue;
                    qualifying.push({ uuid, sr });
                } catch (_) {
                    /* skip */
                }
            }

            const wrap = document.createElement("div");
            wrap.className = "thirdera-spell-penetration-from-chat-wrap";

            if (qualifying.length > 0) {
                for (const { uuid, sr } of qualifying) {
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "thirdera-spell-penetration-from-chat thirdera-chat-apply-btn";
                    btn.dataset.messageId = message.id;
                    btn.dataset.targetActorUuid = uuid;
                    btn.dataset.spellResistance = String(sr);
                    btn.title = game.i18n.format("THIRDERA.SpellPenetration.RollVsTargetHint", { name: "…", sr });
                    btn.textContent = game.i18n.format("THIRDERA.SpellPenetration.RollVsTarget", { name: "…", sr });
                    wrap.append(btn);
                }

                const resolveNames = async () => {
                    for (const btn of wrap.querySelectorAll("[data-target-actor-uuid]")) {
                        const u = btn.dataset.targetActorUuid;
                        const srFromBtn = parseInt(btn.dataset.spellResistance, 10);
                        const srHint = Number.isFinite(srFromBtn) ? srFromBtn : "?";
                        try {
                            const doc = await foundry.utils.fromUuid(u);
                            const name = doc?.name ?? "?";
                            const sr = doc ? getActorSpellResistance(doc) : srHint;
                            btn.title = game.i18n.format("THIRDERA.SpellPenetration.RollVsTargetHint", { name, sr });
                            btn.textContent = game.i18n.format("THIRDERA.SpellPenetration.RollVsTarget", { name, sr });
                            btn.dataset.spellResistance = String(sr);
                        } catch (_) {
                            btn.textContent = game.i18n.format("THIRDERA.SpellPenetration.RollVsTarget", {
                                name: "?",
                                sr: srHint
                            });
                        }
                    }
                };
                resolveNames();
            } else {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "thirdera-spell-penetration-from-chat thirdera-chat-apply-btn";
                btn.dataset.messageId = message.id;
                btn.title = game.i18n.localize("THIRDERA.SpellPenetration.RollPickerHint");
                btn.textContent = game.i18n.localize("THIRDERA.SpellPenetration.RollPickerButton");
                wrap.append(btn);
            }

            const insertPoint = html.querySelector?.(".thirdera.cast-message") ?? html.querySelector?.(".message-content") ?? html;
            if (insertPoint) insertPoint.appendChild(wrap);
        })();
    });

    Hooks.on("ready", () => {
        const container = ui.chat?.element;
        if (!container) return;
        container.addEventListener("click", async (e) => {
            const btn = e.target?.closest?.(PENETRATION_BUTTON_SELECTOR);
            if (!btn) return;
            e.preventDefault();
            const messageId = btn.dataset?.messageId;
            const targetUuid = btn.dataset?.targetActorUuid || "";
            if (!messageId) return;
            await handlePenetrationButtonClick(messageId, targetUuid || undefined);
        });
    });

    Hooks.on("getChatMessageContextOptions", (_app, options) => {
        options.push({
            name: game.i18n.localize("THIRDERA.SpellPenetration.ContextMenu"),
            icon: "<i class=\"fa-solid fa-dice-d20\"></i>",
            condition: (li) => {
                const msg = game.messages?.get(li?.dataset?.messageId);
                return !!getSpellPenetrationCastData(msg);
            },
            callback: async (li) => {
                const msg = game.messages?.get(li?.dataset?.messageId);
                const data = msg ? getSpellPenetrationCastData(msg) : null;
                if (!data) return;
                const caster = msg.speakerActor;
                await rollPenetrationWithTargetPicker(caster, data.casterLevel, data.spellName, undefined);
            }
        });
    });
}

Hooks.once("init", () => {
    registerSpellPenetrationFromChat();
});
