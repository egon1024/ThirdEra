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
 * @param {object} [options={}] - Reserved for future use (e.g. nonlethal).
 * @returns {Promise<{ updated: Actor[], errors: string[] }>} - Actors that were updated and any per-actor errors (e.g. missing hp).
 */
export async function applyDamageOrHealing(actors, amount, mode, options = {}) {
    const errors = [];
    const updated = [];

    const amt = Math.max(0, Math.floor(Number(amount)) || 0);
    if (amt === 0) {
        return { updated: [], errors: [] };
    }

    for (const actor of actors) {
        const hp = actor.system?.attributes?.hp;
        if (!hp || typeof hp.value !== "number" || typeof hp.max !== "number") {
            errors.push(`${actor.name}: missing or invalid HP data`);
            continue;
        }

        const temp = Math.max(0, Math.floor(Number(hp.temp)) || 0);
        let value = Math.floor(Number(hp.value)) || 0;
        const max = Math.max(1, Math.floor(Number(hp.max)) || 1);

        if (mode === "damage") {
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
        } else if (mode === "healing") {
            const newValue = Math.min(max, value + amt);
            await actor.update({
                "system.attributes.hp.value": newValue
            });
            updated.push(actor);
        }
    }

    return { updated, errors };
}
