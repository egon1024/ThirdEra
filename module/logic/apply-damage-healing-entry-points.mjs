/**
 * Phase 2 entry points for Apply damage/healing: chat message button/context menu.
 * Sheet and token entry points are on the actor sheet (Combat tab) and in apply-damage-healing-dialog.mjs.
 */

import { ApplyDamageHealingDialog } from "../applications/apply-damage-healing-dialog.mjs";

const APPLY_BUTTON_SELECTOR = ".thirdera-apply-damage-healing-from-chat";

/**
 * Check if a chat message has dice rolls we can apply (e.g. damage or healing).
 * For combined "Attack & Damage" messages (Phase 4), uses only the damage (last) roll total.
 * @param {ChatMessage} message
 * @returns {{ amount: number, mode: "damage"|"healing" }|null}
 */
function getApplyDataFromMessage(message) {
    if (!message?.isRoll) return null;
    const rolls = message.rolls;
    if (!rolls?.length) return null;
    const flavor = (message.flavor ?? "").toLowerCase();
    const mode = flavor.includes("heal") ? "healing" : "damage";

    let total;
    if (rolls.length >= 2 && flavor.includes("attack") && flavor.includes("damage")) {
        // Phase 4: combined attack & damage message — use only the damage (last) roll
        const lastRoll = rolls[rolls.length - 1];
        total = lastRoll && typeof lastRoll.total === "number" ? lastRoll.total : 0;
    } else {
        total = 0;
        for (const roll of rolls) {
            if (roll && typeof roll.total === "number") total += roll.total;
        }
    }
    return { amount: total, mode };
}

/**
 * Open Apply dialog from chat message data (amount/mode); targets from current selection.
 * @param {number} amount
 * @param {string} mode
 */
function openApplyFromChat(amount, mode) {
    ApplyDamageHealingDialog.openWithOptions({
        amount: String(amount),
        mode: mode === "healing" ? "healing" : "damage"
    });
}

/**
 * Register Phase 2 chat entry points: renderChatMessageHTML (add Apply button) and getChatMessageContextOptions.
 */
function registerChatEntryPoints() {
    // Add "Apply" button to messages that contain a damage or healing roll
    Hooks.on("renderChatMessageHTML", (message, html, _messageData) => {
        const data = getApplyDataFromMessage(message);
        if (!data) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "thirdera-apply-damage-healing-from-chat";
        btn.dataset.amount = String(data.amount);
        btn.dataset.mode = data.mode;
        btn.title = game.i18n.localize("THIRDERA.ApplyDamageHealing.ChatApplyHint");
        btn.textContent = game.i18n.localize("THIRDERA.ApplyDamageHealing.ChatApply");
        btn.classList.add("thirdera-chat-apply-btn");
        const rollDiv = html.querySelector?.(".dice-roll") ?? html.querySelector?.(".message-content") ?? html;
        if (rollDiv) {
            const wrap = document.createElement("div");
            wrap.className = "thirdera-apply-from-chat-wrap";
            wrap.append(btn);
            rollDiv.appendChild(wrap);
        }
    });

    // Delegated click listener for Apply button (attach once when chat is ready)
    Hooks.on("ready", () => {
        const container = ui.chat?.element;
        if (!container) return;
        container.addEventListener("click", (e) => {
            const btn = e.target?.closest?.(APPLY_BUTTON_SELECTOR);
            if (!btn) return;
            e.preventDefault();
            const amount = parseInt(btn.dataset?.amount, 10) || 0;
            const mode = (btn.dataset?.mode === "healing") ? "healing" : "damage";
            openApplyFromChat(amount, mode);
        });
    });

    // Context menu: "Apply" for roll messages (callback receives the message list item li)
    Hooks.on("getChatMessageContextOptions", (_app, options) => {
        options.push({
            name: game.i18n.localize("THIRDERA.ApplyDamageHealing.ChatApply"),
            icon: "<i class=\"fa-solid fa-heart-pulse\"></i>",
            condition: (li) => {
                const message = game.messages?.get(li?.dataset?.messageId);
                return !!getApplyDataFromMessage(message);
            },
            callback: (li) => {
                const message = game.messages?.get(li?.dataset?.messageId);
                const data = message ? getApplyDataFromMessage(message) : null;
                if (data) openApplyFromChat(data.amount, data.mode);
            }
        });
    });
}

// Register when init runs (so hooks are ready)
Hooks.once("init", () => {
    registerChatEntryPoints();
});
