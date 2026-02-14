/**
 * Simple audit log that whispers document changes to GMs via chat.
 */
export class AuditLog {
    // Track recent messages to prevent duplicates
    static _recentMessages = new Map();
    static _dedupeTimeout = 100; // 100ms window for deduplication
    
    // Store old values before updates to track changes accurately
    static _oldValues = new Map();
    
    // Track if hooks are already registered to prevent duplicates
    static _hooksRegistered = false;

    /**
     * Initialize the audit log by registering hooks.
     */
    static init() {
        // Prevent duplicate hook registrations
        if (this._hooksRegistered) {
            console.warn("Third Era | AuditLog.init() called multiple times, skipping duplicate registration");
            return;
        }
        this._hooksRegistered = true;
        
        // Document create hooks
        Hooks.on("createActor", (document, options, userId) => this._onDocumentEvent("Created", document, userId));
        Hooks.on("createItem", (document, options, userId) => this._onDocumentEvent("Created", document, userId));

        // Pre-update hooks to capture old values
        Hooks.on("preUpdateActor", (document, changes, options, userId) => {
            this._captureOldValues(document, "Actor");
        });
        Hooks.on("preUpdateItem", (document, changes, options, userId) => {
            this._captureOldValues(document, "Item");
        });

        // Document update hooks
        Hooks.on("updateActor", (document, diff, options, userId) => {
            // EARLY FILTER: Check for expandedContainers flag BEFORE calling _onDocumentEvent
            // This prevents any processing if it's just a UI state change
            if (diff?.flags?.thirdera && "expandedContainers" in diff.flags.thirdera) {
                // Check if ONLY expandedContainers changed (no other meaningful changes)
                const diffKeys = Object.keys(diff).filter(k => !k.startsWith("_"));
                const hasOtherChanges = diffKeys.some(k => k !== "flags");
                
                if (!hasOtherChanges) {
                    // Only flags changed, check if it's only expandedContainers
                    const flattened = foundry.utils.flattenObject(diff.flags);
                    const flattenedKeys = Object.keys(flattened);
                    const nonSystemFlags = flattenedKeys.filter(fk => 
                        !fk.startsWith("system.") && 
                        !fk.startsWith("core.") && 
                        !fk.includes("expandedContainers")
                    );
                    
                    if (nonSystemFlags.length === 0) {
                        // Only expandedContainers changed, skip entirely
                        return;
                    }
                }
            }
            
            // Also check flattened structure as fallback
            if (diff?.flags) {
                const flattened = foundry.utils.flattenObject(diff.flags);
                const flattenedKeys = Object.keys(flattened);
                const hasExpandedContainers = flattenedKeys.some(fk => fk.includes("expandedContainers"));
                
                if (hasExpandedContainers) {
                    // Check if ONLY expandedContainers (or system/core flags) changed
                    const diffKeys = Object.keys(diff).filter(k => !k.startsWith("_"));
                    const hasOtherChanges = diffKeys.some(k => k !== "flags");
                    
                    if (!hasOtherChanges) {
                        const nonSystemFlags = flattenedKeys.filter(fk => 
                            !fk.startsWith("system.") && 
                            !fk.startsWith("core.") && 
                            !fk.includes("expandedContainers")
                        );
                        if (nonSystemFlags.length === 0) {
                            return;
                        }
                    }
                }
            }
            
            return this._onDocumentEvent("Updated", document, userId, diff);
        });
        Hooks.on("updateItem", (document, diff, options, userId) => this._onDocumentEvent("Updated", document, userId, diff));

        // Document delete hooks
        Hooks.on("deleteActor", (document, options, userId) => this._onDocumentEvent("Deleted", document, userId));
        Hooks.on("deleteItem", (document, options, userId) => this._onDocumentEvent("Deleted", document, userId));
    }

    /**
     * Capture old values from a document before it's updated.
     * Uses both _source (raw data) and system (prepared data) to get accurate values.
     * @param {Document} document  The document about to be updated
     * @param {string} type        The document type ("Actor" or "Item")
     * @private
     */
    static _captureOldValues(document, type) {
        const key = `${type}-${document.id}`;
        const oldValues = {};
        
        // Capture significant fields we care about
        // For embedded items, use system data which reflects the actual current state
        const paths = [
            // Actor fields
            "system.details.level",
            "system.abilities.str.value",
            "system.abilities.dex.value",
            "system.abilities.con.value",
            "system.abilities.int.value",
            "system.abilities.wis.value",
            "system.abilities.cha.value",
            "system.attributes.hp.value",
            "system.attributes.hp.max",
            "system.details.alignment",
            "system.details.deity",
            "system.currency.pp",
            "system.currency.gp",
            "system.currency.sp",
            "system.currency.cp",
            // Item fields - general
            "system.equipped",
            "system.containerId",
            "system.weight",
            "system.cost",
            "system.quantity",
            // Item fields - armor
            "system.armor.bonus",
            "system.armor.maxDex",
            "system.armor.checkPenalty",
            "system.armor.spellFailure",
            // Item fields - weapon
            "system.damage.dice",
            "system.damage.type",
            "system.critical.range",
            "system.critical.multiplier",
            "system.range",
            // Item fields - spell
            "system.level"
        ];
        
        for (const path of paths) {
            // Try system first (prepared data, more accurate for embedded items)
            let value = foundry.utils.getProperty(document.system, path.replace("system.", ""));
            // Fall back to _source if not found in system
            if (value === undefined) {
                value = foundry.utils.getProperty(document._source, path);
            }
            if (value !== undefined) {
                oldValues[path] = value;
            }
        }
        
        this._oldValues.set(key, oldValues);
        
        // Clean up after a delay (in case update hook doesn't fire)
        setTimeout(() => {
            this._oldValues.delete(key);
        }, 5000);
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
        
        // EARLY CHECK: If this is an update with only expandedContainers flag change, skip it immediately
        // This must happen BEFORE any other checks to prevent UI state changes from being logged
        if (action === "Updated" && diff) {
            // Check if flags exist and contain expandedContainers
            if (diff.flags) {
                const flattened = foundry.utils.flattenObject(diff.flags);
                const flattenedKeys = Object.keys(flattened);
                const hasExpandedContainers = flattenedKeys.some(fk => fk.includes("expandedContainers"));
                
                if (hasExpandedContainers) {
                    const nonSystemFlags = flattenedKeys.filter(fk => 
                        !fk.startsWith("system.") && 
                        !fk.startsWith("core.") && 
                        !fk.includes("expandedContainers")
                    );
                    // If only expandedContainers (or system/core flags) changed, skip entirely
                    if (nonSystemFlags.length === 0) {
                        return;
                    }
                }
            }
            
            // Also check if the only meaningful change is flags with expandedContainers
            const diffKeys = Object.keys(diff).filter(k => !k.startsWith("_"));
            if (diffKeys.length === 1 && diffKeys[0] === "flags" && diff.flags) {
                const flattened = foundry.utils.flattenObject(diff.flags);
                const flattenedKeys = Object.keys(flattened);
                if (flattenedKeys.some(fk => fk.includes("expandedContainers"))) {
                    const nonSystemFlags = flattenedKeys.filter(fk => 
                        !fk.startsWith("system.") && 
                        !fk.startsWith("core.") && 
                        !fk.includes("expandedContainers")
                    );
                    if (nonSystemFlags.length === 0) {
                        return;
                    }
                }
            }
        }
        
        // Check if audit log is enabled
        if (!game.settings.get("thirdera", "auditLogEnabled")) return;

        const user = game.users.get(userId);
        const userName = user?.name || "Unknown User";
        
        // Filter GM actions if setting is enabled
        if (game.settings.get("thirdera", "auditLogFilterGM") && user?.isGM) {
            return;
        }
        
        const type = game.i18n.localize(`DOCUMENT.${document.documentName}`);
        const name = document.name;

        // If it's an update, check if it's actually meaningful (not just internal flags)
        if (action === "Updated" && diff) {
            const keys = this._filterMeaningfulChanges(diff);
            if (keys.length === 0) return;
        }

        // SECOND CHECK: Double-check for expandedContainers before building message
        // This catches any cases that might have slipped through the first check
        if (action === "Updated" && diff && diff.flags) {
            const flattened = foundry.utils.flattenObject(diff.flags);
            const flattenedKeys = Object.keys(flattened);
            if (flattenedKeys.some(fk => fk.includes("expandedContainers"))) {
                const nonSystemFlags = flattenedKeys.filter(fk => 
                    !fk.startsWith("system.") && 
                    !fk.startsWith("core.") && 
                    !fk.includes("expandedContainers")
                );
                if (nonSystemFlags.length === 0) {
                    return;
                }
            }
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
            // FINAL CHECK: Before building the message, check one more time for expandedContainers
            if (diff.flags) {
                const flattened = foundry.utils.flattenObject(diff.flags);
                const flattenedKeys = Object.keys(flattened);
                if (flattenedKeys.some(fk => fk.includes("expandedContainers"))) {
                    const nonSystemFlags = flattenedKeys.filter(fk => 
                        !fk.startsWith("system.") && 
                        !fk.startsWith("core.") && 
                        !fk.includes("expandedContainers")
                    );
                if (nonSystemFlags.length === 0) {
                    return;
                }
                }
            }
            
            // Check for container operations (containerId changes)
            if (foundry.utils.hasProperty(diff, "system.containerId") && document.parent instanceof Actor) {
                const oldContainerId = this._getOldValue(document, diff, "system.containerId");
                const newContainerId = foundry.utils.getProperty(diff, "system.containerId") || "";
                
                // Use the captured old value directly - if it wasn't captured, it will be undefined/null
                // Don't use document.system.containerId as fallback because document is already updated
                // Empty string is a valid old value (item wasn't in a container)
                let actualOldContainerId = oldContainerId;
                if (actualOldContainerId === undefined || actualOldContainerId === null) {
                    // Value wasn't captured - this shouldn't happen if preUpdate hook fired
                    // But if it did, we can't reliably get the old value since document is already updated
                    actualOldContainerId = "";
                }
                
                // Only process if containerId actually changed
                if (actualOldContainerId !== newContainerId) {
                    const actor = document.parent;
                    let containerMessage = null;
                    
                    // Check if equipped status changed
                    let equippedChanged = false;
                    let wasEquipped = false;
                    let isEquipped = false;
                    
                    if (document.type === "weapon") {
                        const oldEquipped = this._getOldValue(document, diff, "system.equipped") || "none";
                        const newEquipped = foundry.utils.getProperty(diff, "system.equipped");
                        if (newEquipped !== undefined && oldEquipped !== newEquipped) {
                            equippedChanged = true;
                            wasEquipped = oldEquipped !== "none";
                            isEquipped = newEquipped !== "none";
                        }
                    } else if (document.type === "armor" || document.type === "equipment") {
                        const oldEquipped = this._getOldValue(document, diff, "system.equipped") || "false";
                        const newEquipped = foundry.utils.getProperty(diff, "system.equipped");
                        if (newEquipped !== undefined && oldEquipped !== newEquipped) {
                            equippedChanged = true;
                            wasEquipped = oldEquipped === "true";
                            isEquipped = newEquipped === "true";
                        }
                    }
                    
                    // Item placed in container
                    if (newContainerId && !actualOldContainerId) {
                        const container = actor.items.get(newContainerId);
                        const containerName = container?.name || "container";
                        if (equippedChanged && wasEquipped && !isEquipped) {
                            containerMessage = game.i18n.format("THIRDERA.AuditLog.ContainerPlacedUnequipped", {
                                user: userName,
                                itemName: document.name,
                                containerName: containerName
                            });
                        } else {
                            containerMessage = game.i18n.format("THIRDERA.AuditLog.ContainerPlaced", {
                                user: userName,
                                itemName: document.name,
                                containerName: containerName
                            });
                        }
                    }
                    // Item removed from container
                    else if (!newContainerId && actualOldContainerId) {
                        const container = actor.items.get(actualOldContainerId);
                        const containerName = container?.name || "container";
                        if (equippedChanged && !wasEquipped && isEquipped) {
                            containerMessage = game.i18n.format("THIRDERA.AuditLog.ContainerRemovedEquipped", {
                                user: userName,
                                itemName: document.name,
                                containerName: containerName
                            });
                        } else {
                            containerMessage = game.i18n.format("THIRDERA.AuditLog.ContainerRemoved", {
                                user: userName,
                                itemName: document.name,
                                containerName: containerName
                            });
                        }
                    }
                    // Item moved between containers
                    else if (newContainerId && actualOldContainerId && newContainerId !== actualOldContainerId) {
                        const oldContainer = actor.items.get(actualOldContainerId);
                        const newContainer = actor.items.get(newContainerId);
                        const oldContainerName = oldContainer?.name || "container";
                        const newContainerName = newContainer?.name || "container";
                        if (equippedChanged && wasEquipped && !isEquipped) {
                            containerMessage = game.i18n.format("THIRDERA.AuditLog.ContainerPlacedUnequipped", {
                                user: userName,
                                itemName: document.name,
                                containerName: newContainerName
                            }) + ` (moved from ${oldContainerName})`;
                        } else {
                            containerMessage = game.i18n.format("THIRDERA.AuditLog.ContainerPlaced", {
                                user: userName,
                                itemName: document.name,
                                containerName: newContainerName
                            }) + ` (moved from ${oldContainerName})`;
                        }
                    }
                    
                    if (containerMessage) {
                        // Replace the standard message with container-specific message
                        message = containerMessage;
                        // Skip the standard significant fields processing for container operations
                        // Actor context will be added in the normal flow below
                    } else {
                        // Not a container operation, continue with normal processing
                        const significantFields = this._getSignificantFields(diff, document);
                        // Only add if there are actual changes (filters out "old → old" cases)
                        if (significantFields.length > 0) {
                            message += ` (${significantFields.join(", ")})`;
                        }
                    }
                } else {
                    // containerId didn't change, process normally
                    const significantFields = this._getSignificantFields(diff, document);
                    // Only add if there are actual changes (filters out "old → old" cases)
                    if (significantFields.length > 0) {
                        message += ` (${significantFields.join(", ")})`;
                    }
                }
            } else {
                // No containerId change, process normally
                const significantFields = this._getSignificantFields(diff, document);
                // Only add if there are actual changes (filters out "old → old" cases)
                if (significantFields.length > 0) {
                    message += ` (${significantFields.join(", ")})`;
                }
            }
        }

        // Add context for items (which actor they belong to)
        if (document.parent && document.parent instanceof Actor) {
            message += ` ${game.i18n.format("THIRDERA.AuditLog.OnActor", { name: document.parent.name })}`;
        }

        // Deduplicate: Check if we've sent this exact message recently
        const messageKey = `${document.id}-${action}-${message}`;
        const now = Date.now();
        const recent = this._recentMessages.get(messageKey);
        
        if (recent && (now - recent) < this._dedupeTimeout) {
            // Duplicate message within dedupe window, skip it
            return;
        }
        
        // Record this message
        this._recentMessages.set(messageKey, now);
        
        // Clean up old entries (older than 1 second)
        for (const [key, timestamp] of this._recentMessages.entries()) {
            if (now - timestamp > 1000) {
                this._recentMessages.delete(key);
            }
        }

        // FINAL CHECK: One last check right before sending the message
        // This is a safety net in case anything slipped through
        if (action === "Updated" && diff && diff.flags) {
            const flattened = foundry.utils.flattenObject(diff.flags);
            const flattenedKeys = Object.keys(flattened);
            if (flattenedKeys.some(fk => fk.includes("expandedContainers"))) {
                const nonSystemFlags = flattenedKeys.filter(fk => 
                    !fk.startsWith("system.") && 
                    !fk.startsWith("core.") && 
                    !fk.includes("expandedContainers")
                );
                if (nonSystemFlags.length === 0) {
                    // Only expandedContainers changed, don't send message
                    return;
                }
            }
        }

        // ABSOLUTE FINAL CHECK: Check the diff one more time right before sending
        // Sometimes the diff structure can be different at this point
        if (action === "Updated" && diff && diff.flags) {
            const flattened = foundry.utils.flattenObject(diff.flags);
            const flattenedKeys = Object.keys(flattened);
            if (flattenedKeys.some(fk => fk.includes("expandedContainers"))) {
                const nonSystemFlags = flattenedKeys.filter(fk => 
                    !fk.startsWith("system.") && 
                    !fk.startsWith("core.") && 
                    !fk.includes("expandedContainers")
                );
                if (nonSystemFlags.length === 0) {
                    return;
                }
            }
        }

        // Send whisper to GMs
        const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
        if (gmIds.length === 0) return;

        // Format timestamp
        const timestamp = new Date().toLocaleTimeString(game.i18n.lang || "en", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });

        // Get icon and color for action type
        const actionConfig = this._getActionConfig(action);
        
        // FINAL CHECK: One last check right before creating the message
        // This is a safety net in case anything slipped through
        if (action === "Updated" && diff && diff.flags) {
            const flattened = foundry.utils.flattenObject(diff.flags);
            const flattenedKeys = Object.keys(flattened);
            if (flattenedKeys.some(fk => fk.includes("expandedContainers"))) {
                const nonSystemFlags = flattenedKeys.filter(fk => 
                    !fk.startsWith("system.") && 
                    !fk.startsWith("core.") && 
                    !fk.includes("expandedContainers")
                );
                if (nonSystemFlags.length === 0) {
                    console.log("Third Era | Audit Log - BLOCKED at final check before ChatMessage.create");
                    return;
                }
            }
        }
        
        try {
            await ChatMessage.create({
                content: `<div class="thirdera audit-log audit-log-${action.toLowerCase()}" style="border-left-color: ${actionConfig.color};">
                    <div class="audit-log-header">
                        <i class="${actionConfig.icon}"></i>
                        <strong>Audit Log:</strong>
                        <span class="audit-log-timestamp">${timestamp}</span>
                    </div>
                    <div class="audit-log-message">${message}</div>
                </div>`,
                whisper: gmIds,
                speaker: { alias: game.i18n.localize("THIRDERA.AuditLog.SpeakerAlias") }
            });
        } catch (error) {
            console.error("Third Era | Failed to create audit log message:", error);
        }
    }

    /**
     * Get icon and color configuration for an action type.
     * @param {string} action  The action type (Created, Updated, Deleted)
     * @returns {Object}       Object with icon and color properties
     * @private
     */
    static _getActionConfig(action) {
        const configs = {
            "Created": {
                icon: "fa-solid fa-plus-circle",
                color: "#4caf50" // Green
            },
            "Updated": {
                icon: "fa-solid fa-pencil",
                color: "#ff9800" // Orange
            },
            "Deleted": {
                icon: "fa-solid fa-trash",
                color: "#f44336" // Red
            }
        };
        return configs[action] || { icon: "fa-solid fa-info-circle", color: "#2196f3" };
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

        // If only flags changed, check if they're system-internal or UI state
        if (keys.length === 1 && keys[0] === "flags") {
            const flagKeys = Object.keys(foundry.utils.flattenObject(diff.flags || {}));
            
            // Check if only expandedContainers changed (UI state) - exact match
            if (flagKeys.length === 1 && flagKeys[0] === "thirdera.expandedContainers") {
                return [];
            }
            
            // Check if any flag contains expandedContainers and all are system/core/UI state
            const hasExpandedContainers = flagKeys.some(fk => fk.includes("expandedContainers"));
            if (hasExpandedContainers) {
                // If all flags are system/core or expandedContainers, filter them out
                const allSystemOrUI = flagKeys.every(fk => 
                    fk.startsWith("system.") || 
                    fk.startsWith("core.") || 
                    fk.includes("expandedContainers")
                );
                if (allSystemOrUI) {
                    return [];
                }
            }
            
            // Filter out system-internal flags (system.*, core.*)
            if (flagKeys.length > 0 && flagKeys.every(fk => 
                fk.startsWith("system.") || 
                fk.startsWith("core.")
            )) {
                return [];
            }
        }

        return keys;
    }

    /**
     * Get the old value of a field before an update.
     * Uses values captured in preUpdate hook.
     * @param {Document} document  The document (already updated)
     * @param {Object} diff        The change diff
     * @param {string} path        The field path (e.g., "system.currency.pp")
     * @returns {*}                The old value
     * @private
     */
    static _getOldValue(document, diff, path) {
        const docType = document instanceof Actor ? "Actor" : "Item";
        const key = `${docType}-${document.id}`;
        const oldValues = this._oldValues.get(key);
        
        if (oldValues && path in oldValues) {
            return oldValues[path];
        }
        
        // Fallback: try to get from _source (might already be updated)
        const currentVal = foundry.utils.getProperty(document._source, path);
        return currentVal ?? "";
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
                const newVal = foundry.utils.getProperty(diff, "system.details.level");
                const oldVal = this._getOldValue(document, diff, "system.details.level");
                // Only show if values actually changed
                if (oldVal !== newVal) {
                    significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.Level", {
                        oldValue: oldVal,
                        newValue: newVal
                    }));
                }
            }

            // Track ability score changes
            for (const ability of ["str", "dex", "con", "int", "wis", "cha"]) {
                const path = `system.abilities.${ability}.value`;
                if (foundry.utils.hasProperty(diff, path)) {
                    const newVal = foundry.utils.getProperty(diff, path);
                    const oldVal = this._getOldValue(document, diff, path);
                    // Only show if values actually changed
                    if (oldVal !== newVal) {
                        const abilityName = game.i18n.localize(`THIRDERA.AbilityScores.${ability}`);
                        significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.AbilityScore", {
                            ability: abilityName,
                            oldValue: oldVal,
                            newValue: newVal
                        }));
                    }
                }
            }

            // Track HP changes
            if (foundry.utils.hasProperty(diff, "system.attributes.hp.value")) {
                const newVal = foundry.utils.getProperty(diff, "system.attributes.hp.value");
                const oldVal = this._getOldValue(document, diff, "system.attributes.hp.value");
                // Only show if values actually changed
                if (oldVal !== newVal) {
                    significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.HP", {
                        oldValue: oldVal,
                        newValue: newVal
                    }));
                }
            }

            // Track Max HP changes
            if (foundry.utils.hasProperty(diff, "system.attributes.hp.max")) {
                const newVal = foundry.utils.getProperty(diff, "system.attributes.hp.max");
                const oldVal = this._getOldValue(document, diff, "system.attributes.hp.max");
                // Only show if values actually changed
                if (oldVal !== newVal) {
                    significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.MaxHP", {
                        oldValue: oldVal,
                        newValue: newVal
                    }));
                }
            }

            // Track alignment changes
            if (foundry.utils.hasProperty(diff, "system.details.alignment")) {
                const newVal = foundry.utils.getProperty(diff, "system.details.alignment");
                const oldVal = this._getOldValue(document, diff, "system.details.alignment");
                // Only show if values actually changed
                if (oldVal !== newVal) {
                    significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.Alignment", {
                        oldValue: oldVal || "(empty)",
                        newValue: newVal || "(empty)"
                    }));
                }
            }

            // Track deity changes
            if (foundry.utils.hasProperty(diff, "system.details.deity")) {
                const newVal = foundry.utils.getProperty(diff, "system.details.deity");
                const oldVal = this._getOldValue(document, diff, "system.details.deity");
                // Only show if values actually changed
                if (oldVal !== newVal) {
                    significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.Deity", {
                        oldValue: oldVal || "(empty)",
                        newValue: newVal || "(empty)"
                    }));
                }
            }

            // Track currency changes
            for (const coinType of ["pp", "gp", "sp", "cp"]) {
                const path = `system.currency.${coinType}`;
                if (foundry.utils.hasProperty(diff, path)) {
                    const newVal = foundry.utils.getProperty(diff, path);
                    const oldVal = this._getOldValue(document, diff, path);
                    // Only show if values actually changed
                    if (oldVal !== newVal) {
                        const coinLabel = game.i18n.localize(`THIRDERA.Currency.${coinType}Abbr`);
                        significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.Currency", {
                            coinType: coinLabel,
                            oldValue: oldVal,
                            newValue: newVal
                        }));
                    }
                }
            }
        }

        if (isItem) {
            // Track equipped status for weapons, armor, and equipment
            const equippableTypes = ["weapon", "armor", "equipment"];
            if (equippableTypes.includes(document.type)) {
                if (foundry.utils.hasProperty(diff, "system.equipped")) {
                    const newVal = foundry.utils.getProperty(diff, "system.equipped");
                    const oldVal = this._getOldValue(document, diff, "system.equipped");
                    // Only show if values actually changed
                    if (oldVal !== newVal) {
                        significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.Equipped", {
                            oldValue: oldVal,
                            newValue: newVal
                        }));
                    }
                }
            }

            // Track armor-specific fields
            if (document.type === "armor") {
                if (foundry.utils.hasProperty(diff, "system.armor.bonus")) {
                    const newVal = foundry.utils.getProperty(diff, "system.armor.bonus");
                    const oldVal = this._getOldValue(document, diff, "system.armor.bonus");
                    if (oldVal !== newVal) {
                        significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.ArmorBonus", {
                            oldValue: oldVal,
                            newValue: newVal
                        }));
                    }
                }
                if (foundry.utils.hasProperty(diff, "system.armor.maxDex")) {
                    const newVal = foundry.utils.getProperty(diff, "system.armor.maxDex");
                    const oldVal = this._getOldValue(document, diff, "system.armor.maxDex");
                    if (oldVal !== newVal) {
                        const oldDisplay = oldVal === null ? "unlimited" : oldVal;
                        const newDisplay = newVal === null ? "unlimited" : newVal;
                        significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.ArmorMaxDex", {
                            oldValue: oldDisplay,
                            newValue: newDisplay
                        }));
                    }
                }
                if (foundry.utils.hasProperty(diff, "system.armor.checkPenalty")) {
                    const newVal = foundry.utils.getProperty(diff, "system.armor.checkPenalty");
                    const oldVal = this._getOldValue(document, diff, "system.armor.checkPenalty");
                    if (oldVal !== newVal) {
                        significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.ArmorCheckPenalty", {
                            oldValue: oldVal,
                            newValue: newVal
                        }));
                    }
                }
                if (foundry.utils.hasProperty(diff, "system.armor.spellFailure")) {
                    const newVal = foundry.utils.getProperty(diff, "system.armor.spellFailure");
                    const oldVal = this._getOldValue(document, diff, "system.armor.spellFailure");
                    if (oldVal !== newVal) {
                        significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.ArmorSpellFailure", {
                            oldValue: oldVal,
                            newValue: newVal
                        }));
                    }
                }
            }

            // Track weapon-specific fields
            if (document.type === "weapon") {
                if (foundry.utils.hasProperty(diff, "system.damage.dice")) {
                    const newVal = foundry.utils.getProperty(diff, "system.damage.dice");
                    const oldVal = this._getOldValue(document, diff, "system.damage.dice");
                    if (oldVal !== newVal) {
                        significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.WeaponDamage", {
                            oldValue: oldVal,
                            newValue: newVal
                        }));
                    }
                }
                if (foundry.utils.hasProperty(diff, "system.damage.type")) {
                    const newVal = foundry.utils.getProperty(diff, "system.damage.type");
                    const oldVal = this._getOldValue(document, diff, "system.damage.type");
                    if (oldVal !== newVal) {
                        significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.WeaponDamageType", {
                            oldValue: oldVal || "(empty)",
                            newValue: newVal || "(empty)"
                        }));
                    }
                }
                if (foundry.utils.hasProperty(diff, "system.critical.range")) {
                    const newVal = foundry.utils.getProperty(diff, "system.critical.range");
                    const oldVal = this._getOldValue(document, diff, "system.critical.range");
                    if (oldVal !== newVal) {
                        significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.WeaponCriticalRange", {
                            oldValue: oldVal,
                            newValue: newVal
                        }));
                    }
                }
                if (foundry.utils.hasProperty(diff, "system.critical.multiplier")) {
                    const newVal = foundry.utils.getProperty(diff, "system.critical.multiplier");
                    const oldVal = this._getOldValue(document, diff, "system.critical.multiplier");
                    if (oldVal !== newVal) {
                        significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.WeaponCriticalMultiplier", {
                            oldValue: oldVal,
                            newValue: newVal
                        }));
                    }
                }
                if (foundry.utils.hasProperty(diff, "system.range")) {
                    const newVal = foundry.utils.getProperty(diff, "system.range");
                    const oldVal = this._getOldValue(document, diff, "system.range");
                    if (oldVal !== newVal) {
                        significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.WeaponRange", {
                            oldValue: oldVal,
                            newValue: newVal
                        }));
                    }
                }
            }

            // Track general item fields (weight, cost, quantity)
            if (foundry.utils.hasProperty(diff, "system.weight")) {
                const newVal = foundry.utils.getProperty(diff, "system.weight");
                const oldVal = this._getOldValue(document, diff, "system.weight");
                if (oldVal !== newVal) {
                    significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.Weight", {
                        oldValue: oldVal,
                        newValue: newVal
                    }));
                }
            }
            if (foundry.utils.hasProperty(diff, "system.cost")) {
                const newVal = foundry.utils.getProperty(diff, "system.cost");
                const oldVal = this._getOldValue(document, diff, "system.cost");
                if (oldVal !== newVal) {
                    significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.Cost", {
                        oldValue: oldVal,
                        newValue: newVal
                    }));
                }
            }
            if (foundry.utils.hasProperty(diff, "system.quantity")) {
                const newVal = foundry.utils.getProperty(diff, "system.quantity");
                const oldVal = this._getOldValue(document, diff, "system.quantity");
                if (oldVal !== newVal) {
                    significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.Quantity", {
                        oldValue: oldVal,
                        newValue: newVal
                    }));
                }
            }

            // Track spell level for spells
            if (document.type === "spell" && foundry.utils.hasProperty(diff, "system.level")) {
                const newVal = foundry.utils.getProperty(diff, "system.level");
                const oldVal = this._getOldValue(document, diff, "system.level");
                // Only show if values actually changed
                if (oldVal !== newVal) {
                    significant.push(game.i18n.format("THIRDERA.AuditLog.FieldChange.SpellLevel", {
                        oldValue: oldVal,
                        newValue: newVal
                    }));
                }
            }
        }

        return significant;
    }
}
