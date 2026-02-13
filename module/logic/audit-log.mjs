/**
 * Simple audit log that whispers document changes to GMs via chat.
 */
export class AuditLog {
    /**
     * Initialize the audit log by registering hooks.
     */
    static init() {
        // Document create hooks
        Hooks.on("createActor", (document, options, userId) => this._onDocumentEvent("Created", document, userId));
        Hooks.on("createItem", (document, options, userId) => this._onDocumentEvent("Created", document, userId));

        // Document update hooks
        Hooks.on("updateActor", (document, diff, options, userId) => this._onDocumentEvent("Updated", document, userId, diff));
        Hooks.on("updateItem", (document, diff, options, userId) => this._onDocumentEvent("Updated", document, userId, diff));

        // Document delete hooks
        Hooks.on("deleteActor", (document, options, userId) => this._onDocumentEvent("Deleted", document, userId));
        Hooks.on("deleteItem", (document, options, userId) => this._onDocumentEvent("Deleted", document, userId));
    }

    /**
     * Handle a document lifecycle event.
     * @param {string} action      The action (Created, Updated, Deleted)
     * @param {Document} document  The document affected
     * @param {string} userId      The ID of the user who performed the action
     * @param {Object} [diff]      The change diff for updates
     * @private
     */
    static async _onDocumentEvent(action, document, userId, diff = null) {
        // Check if audit log is enabled
        if (!game.settings.get("thirdera", "auditLogEnabled")) return;

        const user = game.users.get(userId);
        const userName = user?.name || "Unknown User";
        const type = game.i18n.localize(`DOCUMENT.${document.documentName}`);
        const name = document.name;

        // If it's an update, check if it's actually meaningful (not just internal flags)
        if (action === "Updated" && diff) {
            const keys = this._filterMeaningfulChanges(diff);
            if (keys.length === 0) return;
        }

        // Build localization key
        const labelKey = `THIRDERA.AuditLog.${action}`;
        let message = game.i18n.format(labelKey, {
            user: userName,
            type: type,
            name: name
        });

        // Add significant field changes for updates
        if (action === "Updated" && diff) {
            const significantFields = this._getSignificantFields(diff, document);
            if (significantFields.length > 0) {
                message += ` (${significantFields.join(", ")})`;
            }
        }

        // Add context for items (which actor they belong to)
        if (document.parent && document.parent instanceof Actor) {
            message += ` ${game.i18n.format("THIRDERA.AuditLog.OnActor", { name: document.parent.name })}`;
        }

        // Send whisper to GMs
        const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
        if (gmIds.length === 0) return;

        try {
            await ChatMessage.create({
                content: `<div class="thirdera audit-log"><strong>Audit Log:</strong> ${message}</div>`,
                whisper: gmIds,
                speaker: { alias: game.i18n.localize("THIRDERA.AuditLog.SpeakerAlias") }
            });
        } catch (error) {
            console.error("Third Era | Failed to create audit log message:", error);
        }
    }

    /**
     * Filter out system-internal changes that aren't meaningful to users.
     * @param {Object} diff    The change diff
     * @returns {string[]}     Array of meaningful field keys
     * @private
     */
    static _filterMeaningfulChanges(diff) {
        const keys = Object.keys(diff).filter(k => {
            // Skip system-internal fields
            if (k.startsWith("_")) return false;
            return true;
        });

        // If only flags changed, check if they're system-internal
        if (keys.length === 1 && keys[0] === "flags") {
            const flagKeys = Object.keys(foundry.utils.flattenObject(diff.flags || {}));
            // If all flags are system-internal (system.* or core.*), filter them out
            if (flagKeys.every(fk => fk.startsWith("system.") || fk.startsWith("core."))) {
                return [];
            }
        }

        return keys;
    }

    /**
     * Get significant field changes for display in audit log.
     * @param {Object} diff        The change diff
     * @param {Document} document The document being updated
     * @returns {string[]}        Array of formatted change strings
     * @private
     */
    static _getSignificantFields(diff, document) {
        const significant = [];
        const isActor = document instanceof Actor;
        const isItem = document instanceof Item;

        if (isActor) {
            // Track level changes
            if (foundry.utils.hasProperty(diff, "system.details.level")) {
                const oldVal = foundry.utils.getProperty(document._source, "system.details.level") ?? "";
                const newVal = foundry.utils.getProperty(diff, "system.details.level");
                significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.Level", {
                    oldValue: oldVal,
                    newValue: newVal
                }));
            }

            // Track ability score changes
            for (const ability of ["str", "dex", "con", "int", "wis", "cha"]) {
                const path = `system.abilities.${ability}.value`;
                if (foundry.utils.hasProperty(diff, path)) {
                    const oldVal = foundry.utils.getProperty(document._source, path) ?? "";
                    const newVal = foundry.utils.getProperty(diff, path);
                    const abilityName = game.i18n.localize(`THIRDERA.AbilityScores.${ability}`);
                    significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.AbilityScore", {
                        ability: abilityName,
                        oldValue: oldVal,
                        newValue: newVal
                    }));
                }
            }

            // Track HP changes
            if (foundry.utils.hasProperty(diff, "system.attributes.hp.value")) {
                const oldVal = foundry.utils.getProperty(document._source, "system.attributes.hp.value") ?? "";
                const newVal = foundry.utils.getProperty(diff, "system.attributes.hp.value");
                significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.HP", {
                    oldValue: oldVal,
                    newValue: newVal
                }));
            }

            // Track Max HP changes
            if (foundry.utils.hasProperty(diff, "system.attributes.hp.max")) {
                const oldVal = foundry.utils.getProperty(document._source, "system.attributes.hp.max") ?? "";
                const newVal = foundry.utils.getProperty(diff, "system.attributes.hp.max");
                significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.MaxHP", {
                    oldValue: oldVal,
                    newValue: newVal
                }));
            }

            // Track alignment changes
            if (foundry.utils.hasProperty(diff, "system.details.alignment")) {
                const oldVal = foundry.utils.getProperty(document._source, "system.details.alignment") ?? "";
                const newVal = foundry.utils.getProperty(diff, "system.details.alignment");
                significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.Alignment", {
                    oldValue: oldVal || "(empty)",
                    newValue: newVal || "(empty)"
                }));
            }

            // Track deity changes
            if (foundry.utils.hasProperty(diff, "system.details.deity")) {
                const oldVal = foundry.utils.getProperty(document._source, "system.details.deity") ?? "";
                const newVal = foundry.utils.getProperty(diff, "system.details.deity");
                significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.Deity", {
                    oldValue: oldVal || "(empty)",
                    newValue: newVal || "(empty)"
                }));
            }
        }

        if (isItem) {
            // Track equipped status for weapons, armor, and equipment
            const equippableTypes = ["weapon", "armor", "equipment"];
            if (equippableTypes.includes(document.type)) {
                if (foundry.utils.hasProperty(diff, "system.equipped")) {
                    const oldVal = foundry.utils.getProperty(document._source, "system.equipped") ?? "";
                    const newVal = foundry.utils.getProperty(diff, "system.equipped");
                    significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.Equipped", {
                        oldValue: oldVal,
                        newValue: newVal
                    }));
                }
            }

            // Track spell level for spells
            if (document.type === "spell" && foundry.utils.hasProperty(diff, "system.level")) {
                const oldVal = foundry.utils.getProperty(document._source, "system.level") ?? "";
                const newVal = foundry.utils.getProperty(diff, "system.level");
                significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.SpellLevel", {
                    oldValue: oldVal,
                    newValue: newVal
                }));
            }
        }

        return significant;
    }
}
