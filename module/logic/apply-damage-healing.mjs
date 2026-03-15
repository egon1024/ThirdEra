/**
 * Core logic for applying damage or healing to one or more actors.
 * Used by the Apply damage/healing dialog and (later) the attack flow.
 * Callers are responsible for permission checks; this module only updates HP.
 */

/**
 * Apply damage or healing to the given actors.
 *
 * @param {Actor[]} actors - Actors with system.attributes.hp (e.g. ThirdEra character/NPC).
 * @param {number} amount - Non-negative integer. 0 is a no-op.
 * @param {"damage"|"healing"} mode - "damage" reduces HP (temp first, then value); "healing" increases value (capped at max).
 * @param {object} [options={}]
 * @param {boolean} [options.nonlethal] - If true and mode is "damage", add amount to nonlethal damage instead of reducing HP (temp/value).
 * @returns {Promise<{ updated: Actor[], errors: string[] }>} - Actors that were updated and any per-actor errors (e.g. missing hp).
 */
export async function applyDamageOrHealing(actors, amount, mode, options = {}) {
    const errors = [];
    const updated = [];

    const amt = Math.max(0, Math.floor(Number(amount)) || 0);
    if (amt === 0) {
        return { updated: [], errors: [] };
    }

    const nonlethal = Boolean(options.nonlethal);

    for (const actor of actors) {
        const hp = actor.system?.attributes?.hp;
        if (!hp || typeof hp.value !== "number" || typeof hp.max !== "number") {
            errors.push(`${actor.name}: missing or invalid HP data`);
            continue;
        }

        const temp = Math.max(0, Math.floor(Number(hp.temp)) || 0);
        let value = Math.floor(Number(hp.value)) || 0;
        const max = Math.max(1, Math.floor(Number(hp.max)) || 1);
        const currentNonlethal = Math.max(0, Math.floor(Number(hp.nonlethal)) || 0);

        if (mode === "damage") {
            if (nonlethal) {
                const newNonlethal = currentNonlethal + amt;
                await actor.update({
                    "system.attributes.hp.nonlethal": newNonlethal
                });
                updated.push(actor);
            } else {
                let remaining = amt;
                let newTemp = temp;
                let newValue = value;

                if (newTemp > 0 && remaining > 0) {
                    const fromTemp = Math.min(newTemp, remaining);
                    newTemp -= fromTemp;
                    remaining -= fromTemp;
                }
                if (remaining > 0) {
                    newValue -= remaining;
                    // Clamp to dying (-9) or dead (0) per SRD
                    if (newValue < -9) newValue = -9;
                }

                await actor.update({
                    "system.attributes.hp.temp": newTemp,
                    "system.attributes.hp.value": newValue
                });
                updated.push(actor);
            }
        } else if (mode === "healing") {
            // SRD: heal lethal first, remainder heals nonlethal
            let healRemaining = amt;
            const lethalNeeded = max - value;
            const toLethal = Math.min(healRemaining, Math.max(0, lethalNeeded));
            let newValue = value + toLethal;
            healRemaining -= toLethal;
            let newNonlethal = currentNonlethal;
            if (healRemaining > 0 && currentNonlethal > 0) {
                newNonlethal = Math.max(0, currentNonlethal - healRemaining);
            }
            const updates = { "system.attributes.hp.value": newValue };
            if (newNonlethal !== currentNonlethal) {
                updates["system.attributes.hp.nonlethal"] = newNonlethal;
            }
            await actor.update(updates);
            updated.push(actor);
        }
    }

    return { updated, errors };
}
