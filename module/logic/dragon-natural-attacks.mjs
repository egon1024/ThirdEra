/**
 * True dragon natural weapons from the SRD (d20srd dragonTrue.htm table).
 * Secondary attacks use the Multiattack adjustment (−2 relative to the bite bonus), not the default −5.
 *
 * @see https://www.d20srd.org/srd/monsters/dragonTrue.htm
 */

/** @typedef {"T"|"S"|"M"|"L"|"H"|"G"|"C"} DragonSizeCode */

/** Dice by size for each natural weapon (— = not available at that size). */
export const DRAGON_WEAPON_DICE = Object.freeze({
    T: Object.freeze({ bite: "1d4", claw: "1d3", wing: null, tail: null, crush: null, tailSweep: null }),
    S: Object.freeze({ bite: "1d6", claw: "1d4", wing: null, tail: null, crush: null, tailSweep: null }),
    M: Object.freeze({ bite: "1d8", claw: "1d6", wing: "1d4", tail: null, crush: null, tailSweep: null }),
    L: Object.freeze({ bite: "2d6", claw: "1d8", wing: "1d6", tail: "1d8", crush: null, tailSweep: null }),
    H: Object.freeze({ bite: "2d8", claw: "2d6", wing: "1d8", tail: "2d6", crush: "2d8", tailSweep: null }),
    G: Object.freeze({ bite: "4d6", claw: "2d8", wing: "2d6", tail: "2d8", crush: "4d6", tailSweep: "2d6" }),
    C: Object.freeze({ bite: "4d8", claw: "4d6", wing: "2d8", tail: "4d6", crush: "4d8", tailSweep: "2d8" })
});

/** Bite reach (ft): SRD treats bite as one size category larger for reach. */
export const DRAGON_BITE_REACH_FT = Object.freeze({
    T: 5,
    S: 5,
    M: 5,
    L: 10,
    H: 15,
    G: 20,
    C: 30
});

/** Reach (ft) for claws, wings, tail, crush, tail sweep — non-bite weapons. */
export const DRAGON_BODY_REACH_FT = Object.freeze({
    T: 0,
    S: 5,
    M: 5,
    L: 5,
    H: 10,
    G: 15,
    C: 20
});

const MULTIATTACK_PENALTY = 2;

/**
 * @param {object} opts
 * @param {string} opts.sizeCode - Single letter T/S/M/L/H/G/C (from SRD age table).
 * @param {number} opts.biteAttackBonus - Melee attack bonus from the SRD "Attack" column (primary bite).
 * @returns {Array<{ name: string, dice: string, damageType: string, primary: string, reach: string, presetAttackBonus: number }>}
 */
export function buildTrueDragonNaturalAttacks({ sizeCode, biteAttackBonus }) {
    const code = String(sizeCode ?? "").trim().toUpperCase().charAt(0);
    const w = DRAGON_WEAPON_DICE[code];
    if (!w || !Number.isFinite(biteAttackBonus)) {
        return [];
    }
    const bite = Math.trunc(biteAttackBonus);
    const sec = bite - MULTIATTACK_PENALTY;
    const br = DRAGON_BITE_REACH_FT[code];
    const bodyR = DRAGON_BODY_REACH_FT[code];
    const biteReachStr = br != null ? `${br} ft` : "";
    const bodyReachStr = bodyR > 0 ? `${bodyR} ft` : "";

    /** @type {Array<{ name: string, dice: string, damageType: string, primary: string, reach: string, presetAttackBonus: number }>} */
    const out = [];
    out.push({
        name: "Bite",
        dice: w.bite,
        damageType: "piercing",
        primary: "true",
        reach: biteReachStr,
        presetAttackBonus: bite
    });
    out.push({
        name: "Claw",
        dice: w.claw,
        damageType: "slashing",
        primary: "false",
        reach: bodyReachStr,
        presetAttackBonus: sec
    });
    out.push({
        name: "Claw",
        dice: w.claw,
        damageType: "slashing",
        primary: "false",
        reach: bodyReachStr,
        presetAttackBonus: sec
    });
    if (w.wing) {
        out.push({
            name: "Wing",
            dice: w.wing,
            damageType: "bludgeoning",
            primary: "false",
            reach: bodyReachStr,
            presetAttackBonus: sec
        });
        out.push({
            name: "Wing",
            dice: w.wing,
            damageType: "bludgeoning",
            primary: "false",
            reach: bodyReachStr,
            presetAttackBonus: sec
        });
    }
    if (w.tail) {
        out.push({
            name: "Tail slap",
            dice: w.tail,
            damageType: "bludgeoning",
            primary: "false",
            reach: bodyReachStr,
            presetAttackBonus: sec
        });
    }
    if (w.crush) {
        out.push({
            name: "Crush",
            dice: w.crush,
            damageType: "bludgeoning",
            primary: "false",
            reach: bodyReachStr,
            presetAttackBonus: sec
        });
    }
    if (w.tailSweep) {
        out.push({
            name: "Tail sweep",
            dice: w.tailSweep,
            damageType: "bludgeoning",
            primary: "false",
            reach: bodyReachStr,
            presetAttackBonus: sec
        });
    }
    return out;
}

/**
 * @param {ReturnType<typeof buildTrueDragonNaturalAttacks>} attacks
 * @returns {string}
 */
export function summarizeTrueDragonFullAttack(attacks) {
    if (!attacks?.length) return "";
    const parts = [];
    let i = 0;
    while (i < attacks.length) {
        const name = attacks[i].name;
        const bonus = attacks[i].presetAttackBonus;
        let j = i + 1;
        while (j < attacks.length && attacks[j].name === name && attacks[j].presetAttackBonus === bonus) {
            j++;
        }
        const count = j - i;
        const sign = bonus >= 0 ? "+" : "";
        if (count > 1) {
            parts.push(`${count}× ${name} ${sign}${bonus}`);
        } else {
            parts.push(`${name} ${sign}${bonus}`);
        }
        i = j;
    }
    return parts.join(", ");
}
