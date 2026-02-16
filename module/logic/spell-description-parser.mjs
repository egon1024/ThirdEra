/**
 * Parse spell description (and optional canonical data) to suggest Range, Target/Area, Duration, Saving Throw.
 * Used when importing spells so we don't default to "See text" when the description or SRD data has the info.
 */

/** Strip HTML tags and common entities; return plain text (single spaces, trimmed). */
function stripHtml(html) {
    if (!html || typeof html !== "string") return "";
    let text = html
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
    return text;
}

/** Extract value after a label (e.g. "Range: Long (400 ft."). Case-insensitive label. */
function extractLabeled(text, label) {
    const re = new RegExp(`${label}\\s*:?\\s*([^\\n]+?)(?=\\n[A-Za-z]|$|\\n\\s*\\n)`, "gi");
    const m = re.exec(text);
    return m ? m[1].trim().replace(/\s+/g, " ") : null;
}

/** Heuristic hints from prose (no labeled block). Returns partial { range, target, duration, savingThrow }. */
function heuristicFromText(text) {
    const t = text.toLowerCase();
    const out = {};
    // Range
    if (/\b(touch|touched)\b/.test(t) && !/range\s*:/.test(t)) out.range = "Touch";
    else if (/\bpersonal\b/.test(t)) out.range = "Personal";
    else if (/\bclose\s*\(\s*25\s*ft/.test(t)) out.range = "Close (25 ft. + 5 ft./2 levels)";
    else if (/\bmedium\s*\(\s*100\s*ft/.test(t)) out.range = "Medium (100 ft. + 10 ft./level)";
    else if (/\blong\s*\(\s*400\s*ft/.test(t)) out.range = "Long (400 ft. + 40 ft./level)";
    else {
        const ftMatch = t.match(/(\d+)\s*(?:ft\.?|feet)(?:\s|,|\.|$)/);
        if (ftMatch) out.range = `${ftMatch[1]} ft.`;
    }
    // Target/Area
    if (/\bcone\b/.test(t) && !/target\s*:/.test(t)) out.target = "Cone-shaped burst";
    else if (/\bcreature\s+touched\b/.test(t)) out.target = "Creature touched";
    else if (/\b(20\s*[- ]?ft\.?\s*radius|radius\s*of\s*20)/.test(t)) out.target = "20-ft.-radius spread";
    else if (/\b(10\s*[- ]?ft\.?\s*radius)/.test(t)) out.target = "10-ft.-radius spread";
    else if (/\bline\b/.test(t) && /\d+\s*ft/.test(t)) {
        const lineMatch = t.match(/(\d+)\s*ft\.?\s*line/);
        if (lineMatch) out.target = `${lineMatch[1]}-ft. line`;
    }
    // Duration
    if (/\binstantaneous\b/.test(t) || /\binstant\b/.test(t)) out.duration = "Instantaneous";
    else if (/\bconcentration\b.*\b(?:1\s*min\.?\/level|min\/level)/.test(t)) out.duration = "Concentration, up to 1 min./level (D)";
    else if (/\b1\s*round\s*\/\s*level\b/.test(t)) out.duration = "1 round/level (D)";
    else if (/\b1\s*min(?:ute)?\.?\s*\/\s*level\b/.test(t)) out.duration = "1 min./level (D)";
    else if (/\b1\s*hour\s*\/\s*level\b/.test(t)) out.duration = "1 hour/level (D)";
    else if (/\b(?:permanent|permanent until)/.test(t)) out.duration = "Permanent";
    // Saving Throw
    if (/\breflex\s*half\b/.test(t)) out.savingThrow = "Reflex half";
    else if (/\breflex\s*negates\b/.test(t)) out.savingThrow = "Reflex negates";
    else if (/\bwill\s*negates\b/.test(t)) out.savingThrow = "Will negates";
    else if (/\bwill\s*half\b/.test(t)) out.savingThrow = "Will half";
    else if (/\bwill\s*(?:harmless|half\s*\(harmless\))/.test(t)) out.savingThrow = "Will half (harmless)";
    else if (/\bfortitude\s*negates\b/.test(t)) out.savingThrow = "Fortitude negates";
    else if (/\bfortitude\s*half\b/.test(t)) out.savingThrow = "Fortitude half";
    else if (/\bnone\b/.test(t) && (/\bharmless\b/.test(t) || /\b(bonus|protection|grant|fills)\b/.test(t))) out.savingThrow = "None";
    return out;
}

/** Canonical SRD stats for spells (name lowercase key). Source: d20 SRD. */
const CANONICAL_SRD = {
    "fireball": { range: "Long (400 ft. + 40 ft./level)", target: "20-ft.-radius spread", duration: "Instantaneous", savingThrow: "Reflex half" },
    "lightning bolt": { range: "120 ft.", target: "120-ft. line", duration: "Instantaneous", savingThrow: "Reflex half" },
    "mirror image": { range: "Personal", target: "You", duration: "1 min./level (D)", savingThrow: "None" },
    "wind wall": { range: "Medium (100 ft. + 10 ft./level)", target: "Wall up to 10 ft./level long and 5 ft./level high (S)", duration: "1 round/level (D)", savingThrow: "None" },
    "heat metal": { range: "Medium (100 ft. + 10 ft./level)", target: "Metal equipment of one creature; or 25 lb. of metal/level", duration: "7 rounds (D)", savingThrow: "None" },
    "cure moderate wounds": { range: "Touch", target: "Creature touched", duration: "Instantaneous", savingThrow: "Will half (harmless)" },
    "tiny hut": { range: "20 ft.", target: "20-ft.-radius sphere centered on your location", duration: "2 hours/level (D)", savingThrow: "None" },
    "suggestion": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One living creature", duration: "1 hour/level (D)", savingThrow: "Will negates" },
    "water walk": { range: "Touch", target: "One touched creature/level", duration: "1 hour/level (D)", savingThrow: "Will negates (harmless)" },
    "scrying": { range: "See text", target: "Magical sensor", duration: "1 min./level (D)", savingThrow: "Will negates" },
    "obscure object": { range: "Touch", target: "One object touched", duration: "8 hours (D)", savingThrow: "Will negates (object)" },
    "shrink item": { range: "Touch", target: "One object of up to 2 cu. ft./level", duration: "1 day/level (D)", savingThrow: "Will negates (object)" },
    "vampiric touch": { range: "Touch", target: "Living creature touched", duration: "Instantaneous/1 hour; see text", savingThrow: "None" },
    "slow": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One creature/level, no two of which can be more than 30 ft. apart", duration: "1 round/level (D)", savingThrow: "Will negates" },
    "water breathing": { range: "Touch", target: "Living creatures touched", duration: "2 hours/level (D)", savingThrow: "Will negates (harmless)" },
    "stinking cloud": { range: "Medium (100 ft. + 10 ft./level)", target: "Cloud spreads in 20-ft. radius, 20 ft. high", duration: "1 round/level (D)", savingThrow: "Fortitude negates; see text" },
    "sepia snake sigil": { range: "Touch", target: "One book or written document", duration: "Permanent until discharged (D)", savingThrow: "Reflex negates" },
    "stone shape": { range: "Touch", target: "Stone or stone object touched, up to 10 cu. ft. + 1 cu. ft./level", duration: "Instantaneous", savingThrow: "None" },
    "speak with dead": { range: "10 ft.", target: "One dead creature", duration: "1 min./level", savingThrow: "Will negates" },
    "secret page": { range: "Touch", target: "Page touched, up to 3 sq. ft. in size", duration: "Permanent", savingThrow: "None" },
    "sculpt sound": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One creature or object/level", duration: "1 hour/level (D)", savingThrow: "Will negates (object)" },
    "sleet storm": { range: "Long (400 ft. + 40 ft./level)", target: "Cylinder (40-ft. radius, 20 ft. high)", duration: "1 round/level (D)", savingThrow: "None" },
    "speak with plants": { range: "Personal", target: "You", duration: "1 min./level", savingThrow: "None" },
    "darkvision": { range: "Touch", target: "Creature touched", duration: "1 hour/level (D)", savingThrow: "Will negates (harmless)" },
    "tongues": { range: "Touch", target: "Creature touched", duration: "10 min./level", savingThrow: "Will negates (harmless)" },
    "inflict serious wounds": { range: "Touch", target: "Creature touched", duration: "Instantaneous", savingThrow: "Will half" },
    "meld into stone": { range: "Personal", target: "You", duration: "1 hour/level (D)", savingThrow: "None" },
    "nondetection": { range: "Touch", target: "Creature or object touched", duration: "1 hour/level (D)", savingThrow: "None" },
    "plant growth": { range: "See text", target: "See text", duration: "Instantaneous", savingThrow: "None" },
    "phantom steed": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One quasi-real, horselike creature", duration: "1 hour/level (D)", savingThrow: "None" },
    "remove disease": { range: "Touch", target: "Creature touched", duration: "Instantaneous", savingThrow: "Fortitude negates (harmless)" },
    "repel vermin": { range: "10 ft.", target: "10-ft.-radius emanation from you", duration: "10 min./level (D)", savingThrow: "None" },
    "magic fang, greater": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One living creature", duration: "1 hour/level", savingThrow: "Will negates (harmless)" },
    "greater magic fang": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One living creature", duration: "1 hour/level", savingThrow: "Will negates (harmless)" },
    "geas, lesser": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One living creature", duration: "One day/level or until discharged (D)", savingThrow: "None" },
    "lesser geas": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One living creature", duration: "One day/level or until discharged (D)", savingThrow: "None" },
    "restoration, lesser": { range: "Touch", target: "Creature touched", duration: "Instantaneous", savingThrow: "Will negates (harmless)" },
    "lesser restoration": { range: "Touch", target: "Creature touched", duration: "Instantaneous", savingThrow: "Will negates (harmless)" },
    "locate object": { range: "Long (400 ft. + 40 ft./level)", target: "Circle, centered on you, with a radius of 400 ft. + 40 ft./level", duration: "1 min./level (D)", savingThrow: "None" },
    "poison": { range: "Touch", target: "Living creature touched", duration: "Instantaneous; see text", savingThrow: "Fortitude negates" },
    "remove curse": { range: "Touch", target: "Creature or item touched", duration: "Instantaneous", savingThrow: "Will negates (harmless)" },
    "magic circle against chaos": { range: "Touch", target: "10-ft.-radius emanation from touched creature", duration: "10 min./level (D)", savingThrow: "Will negates (harmless)" },
    "magic circle against evil": { range: "Touch", target: "10-ft.-radius emanation from touched creature", duration: "10 min./level (D)", savingThrow: "Will negates (harmless)" },
    "magic circle against good": { range: "Touch", target: "10-ft.-radius emanation from touched creature", duration: "10 min./level (D)", savingThrow: "Will negates (harmless)" },
    "magic circle against law": { range: "Touch", target: "10-ft.-radius emanation from touched creature", duration: "10 min./level (D)", savingThrow: "Will negates (harmless)" },
    "rage": { range: "Touch", target: "One willing creature", duration: "1 round/level (D)", savingThrow: "None" },
    "invisibility sphere": { range: "Personal", target: "You and any items carried", duration: "1 min./level (D)", savingThrow: "Will negates (harmless)" },
    "invisibility purge": { range: "Personal", target: "You", duration: "1 min./level (D)", savingThrow: "None" },
    "protection from energy": { range: "Touch", target: "Creature touched", duration: "10 min./level (D) or until discharged", savingThrow: "Fortitude negates (harmless)" },
    "remove blindness/deafness": { range: "Touch", target: "Creature touched", duration: "Instantaneous", savingThrow: "Fortitude negates (harmless)" },
    "quench": { range: "Medium (100 ft. + 10 ft./level)", target: "One 20-ft. cube/level", duration: "Instantaneous", savingThrow: "None" },
    "crushing despair": { range: "30 ft.", target: "One creature", duration: "1 min./level", savingThrow: "Will negates" },
    "displacement": { range: "Touch", target: "Creature touched", duration: "1 round/level (D)", savingThrow: "Will negates (harmless)" },
    "deep slumber": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One or more living creatures within a 10-ft.-radius burst", duration: "1 min./level", savingThrow: "Will negates" },
    "good hope": { range: "Medium (100 ft. + 10 ft./level)", target: "One living creature/level, no two of which may be more than 30 ft. apart", duration: "1 min./level", savingThrow: "Will negates (harmless)" },
    "fly": { range: "Touch", target: "Creature touched", duration: "1 min./level (D)", savingThrow: "Will negates (harmless)" },
    "contagion": { range: "Touch", target: "Living creature touched", duration: "Instantaneous", savingThrow: "Fortitude negates" },
    "confusion": { range: "Medium (100 ft. + 10 ft./level)", target: "One living creature", duration: "1 round/level (D)", savingThrow: "Will negates" },
    "cure serious wounds": { range: "Touch", target: "Creature touched", duration: "Instantaneous", savingThrow: "Will half (harmless)" },
    "geas, lesser": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One living creature", duration: "One day/level or until discharged (D)", savingThrow: "None" },
    "helping hand": { range: "5 miles", target: "Hand moves at 60 ft./round", duration: "1 hour/level (D)", savingThrow: "None" },
    "deeper darkness": { range: "Touch", target: "Object touched", duration: "One day/level (D)", savingThrow: "None" },
    "dominate animal": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One animal", duration: "1 round/level (D)", savingThrow: "Will negates" },
    "gentle repose": { range: "Touch", target: "Corpse touched", duration: "One day/level", savingThrow: "Will negates (object)" },
    "glyph of warding": { range: "Touch", target: "Object touched", duration: "Permanent until discharged (D)", savingThrow: "See text" },
    "discern lies": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One creature/level, no two of which can be more than 30 ft. apart", duration: "Concentration, up to 1 round/level", savingThrow: "Will negates" },
    "diminish plants": { range: "See text", target: "See text", duration: "Instantaneous", savingThrow: "None" },
    "halt undead": { range: "Medium (100 ft. + 10 ft./level)", target: "One undead creature", duration: "1 round/level (D)", savingThrow: "Will negates" },
    "heal mount": { range: "Touch", target: "Your mount or another creature's mount touched", duration: "Instantaneous", savingThrow: "Will half (harmless)" },
    "gaseous form": { range: "Touch", target: "Willing corporeal creature touched", duration: "2 min./level (D)", savingThrow: "None" },
    "fear": { range: "30 ft.", target: "One creature/level, no two of which can be more than 30 ft. apart", duration: "1 round/level or 1 round; see text", savingThrow: "Will partial" },
    "blink": { range: "Personal", target: "You", duration: "1 round/level (D)", savingThrow: "None" },
    "clairaudience/clairvoyance": { range: "Long (400 ft. + 40 ft./level)", target: "Magical sensor", duration: "1 min./level (D)", savingThrow: "None" },
    "call lightning": { range: "Outdoors: 360 ft.; indoors: 120 ft.", target: "One or more 30-ft. vertical cylinders below a cloud", duration: "1 min./level (D)", savingThrow: "Reflex half" },
    "charm monster": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One living creature", duration: "1 hour/level (D)", savingThrow: "Will negates" },
    "bestow curse": { range: "Touch", target: "Creature touched", duration: "Permanent", savingThrow: "Will negates" },
    "animate dead": { range: "Touch", target: "Corpses touched", duration: "Instantaneous", savingThrow: "None" },
    "minor image": { range: "Long (400 ft. + 40 ft./level)", target: "One 4-ft. cube/level (S)", duration: "Concentration + 2 rounds", savingThrow: "Will disbelief (if interacted with)" },
    "magic mouth": { range: "Touch", target: "Object touched", duration: "Permanent until discharged", savingThrow: "None" },
    "desecrate": { range: "Close (25 ft. + 5 ft./2 levels)", target: "20-ft.-radius emanation", duration: "2 hours/level (D)", savingThrow: "None" },
    "consecrate": { range: "Close (25 ft. + 5 ft./2 levels)", target: "20-ft.-radius emanation", duration: "2 hours/level (D)", savingThrow: "None" },
    "hypnotic pattern": { range: "Medium (100 ft. + 10 ft./level)", target: "A 10-ft. cube/level (S)", duration: "Concentration + 2 rounds", savingThrow: "Will negates" },
    "phantom trap": { range: "Touch", target: "Object touched", duration: "Permanent (D)", savingThrow: "None" },
    "see invisibility": { range: "Personal", target: "You", duration: "1 min./level (D)", savingThrow: "None" },
    "shield other": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One creature", duration: "1 hour/level (D)", savingThrow: "Will negates (harmless)" },
    "continual flame": { range: "Touch", target: "Object touched", duration: "Permanent", savingThrow: "None" },
    "arcane lock": { range: "Touch", target: "The door, chest, or portal touched", duration: "Permanent", savingThrow: "None" },
    "augury": { range: "Personal", target: "You", duration: "Instantaneous", savingThrow: "None" },
    "zone of truth": { range: "Close (25 ft. + 5 ft./2 levels)", target: "20-ft.-radius emanation", duration: "1 min./level", savingThrow: "Will negates" },
    "misdirection": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One creature or object", duration: "1 hour/level (D)", savingThrow: "None" },
    "protection from arrows": { range: "Touch", target: "Creature touched", duration: "1 hour/level (D)", savingThrow: "Will negates (harmless)" },
    "whispering wind": { range: "1 mile/level", target: "10-ft.-radius spread", duration: "No more than 1 hour/level", savingThrow: "None" },
    "pyrotechnics": { range: "Long (400 ft. + 40 ft./level)", target: "One fire source, up to 20 ft. cube", duration: "1d4+1 rounds, or 1d4+1 rounds after creatures leave the smoke cloud; see text", savingThrow: "Will negates or Fortitude negates; see text" },
    "undetectable alignment": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One creature or object", duration: "24 hours (D)", savingThrow: "None" },
    "soften earth and stone": { range: "Close (25 ft. + 5 ft./2 levels)", target: "3-ft. cube/level (S)", duration: "Instantaneous", savingThrow: "None" },
    "spike growth": { range: "Medium (100 ft. + 10 ft./level)", target: "One 20-ft. square/level", duration: "1 hour/level (D)", savingThrow: "None" },
    "status": { range: "Touch", target: "Creature touched", duration: "1 hour/level (D)", savingThrow: "Will negates (harmless)" },
    "inflict moderate wounds": { range: "Touch", target: "Creature touched", duration: "Instantaneous", savingThrow: "Will half" },
    "summon monster ii": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One summoned creature", duration: "1 round/level (D)", savingThrow: "None" },
    "summon monster iii": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One summoned creature", duration: "1 round/level (D)", savingThrow: "None" },
    "summon nature's ally ii": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One summoned creature", duration: "1 round/level (D)", savingThrow: "None" },
    "summon nature's ally iii": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One summoned creature", duration: "1 round/level (D)", savingThrow: "None" },
    "silence": { range: "Long (400 ft. + 40 ft./level)", target: "20-ft.-radius emanation centered on a creature, object, or point in space", duration: "1 min./level (D)", savingThrow: "Will negates" },
    "sound burst": { range: "Close (25 ft. + 5 ft./2 levels)", target: "10-ft.-radius spread", duration: "Instantaneous", savingThrow: "Fortitude partial" },
    "scorching ray": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One or more rays", duration: "Instantaneous", savingThrow: "None" },
    "spider climb": { range: "Touch", target: "Creature touched", duration: "10 min./level (D)", savingThrow: "Will negates (harmless)" },
    "remove paralysis": { range: "Touch", target: "Up to four creatures touched", duration: "Instantaneous", savingThrow: "Will negates (harmless)" },
    "summon swarm": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One swarm of bats, rats, or spiders", duration: "1 round/level (D)", savingThrow: "None" },
    "web": { range: "Medium (100 ft. + 10 ft./level)", target: "Webs in a 20-ft.-radius spread", duration: "10 min./level (D)", savingThrow: "Reflex negates" },
    "glitterdust": { range: "Close (25 ft. + 5 ft./2 levels)", target: "Creatures and objects within 10-ft.-radius spread", duration: "1 round/level", savingThrow: "Will negates (blinding only)" },
    "touch of idiocy": { range: "Touch", target: "Living creature touched", duration: "1d6 minutes", savingThrow: "None" },
    "gust of wind": { range: "60 ft.", target: "Line from you to the extreme of the range", duration: "1 round", savingThrow: "Fortitude negates" },
    "scare": { range: "Medium (100 ft. + 10 ft./level)", target: "One living creature", duration: "1 round/level or 1 round; see text", savingThrow: "Will partial" },
    "levitate": { range: "Personal or Close (25 ft. + 5 ft./2 levels)", target: "You or one willing creature or one object (total weight up to 100 lb./level)", duration: "1 min./level (D)", savingThrow: "None" },
    "daze monster": { range: "Medium (100 ft. + 10 ft./level)", target: "One creature of 6 HD or less", duration: "1 round", savingThrow: "Will negates" },
    "find traps": { range: "Personal", target: "You", duration: "1 min./level", savingThrow: "None" },
    "flaming sphere": { range: "Medium (100 ft. + 10 ft./level)", target: "5-ft.-diameter sphere", duration: "1 round/level (D)", savingThrow: "Reflex negates" },
    "darkness": { range: "Touch", target: "Object touched", duration: "10 min./level (D)", savingThrow: "None" },
    "command undead": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One undead creature", duration: "1 day/level (D)", savingThrow: "Will negates" },
    "align weapon": { range: "Touch", target: "Weapon touched or 50 projectiles (all of which must be in contact with each other)", duration: "1 min./level (D)", savingThrow: "Will negates (harmless)" },
    "alter self": { range: "Personal", target: "You", duration: "10 min./level (D)", savingThrow: "None" },
    "calm emotions": { range: "Medium (100 ft. + 10 ft./level)", target: "Creatures in a 20-ft.-radius spread", duration: "Concentration, up to 1 round/level (D)", savingThrow: "Will negates" },
    "death knell": { range: "Touch", target: "Living creature touched", duration: "Instantaneous", savingThrow: "Will negates" },
    "blur": { range: "Touch", target: "Creature touched", duration: "1 min./level (D)", savingThrow: "Will negates (harmless)" },
    "false life": { range: "Personal", target: "You", duration: "1 hour/level (D) or until discharged", savingThrow: "None" },
    "acid arrow": { range: "Long (400 ft. + 40 ft./level)", target: "One arrow", duration: "1 round + 1 round per three levels", savingThrow: "None" },
    "true strike": { range: "Personal", target: "You", duration: "See text", savingThrow: "None" },
    "grease": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One 10-ft. square or one object", duration: "1 round/level (D)", savingThrow: "See text" },
    "erase": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One scroll or two pages", duration: "Instantaneous", savingThrow: "See text" },
    "prestidigitation": { range: "10 ft.", target: "See text", duration: "1 hour", savingThrow: "See text" },
    "explosive runes": { range: "Touch", target: "Object touched", duration: "Permanent until discharged (D)", savingThrow: "Reflex half" },
    "dispel magic": { range: "Medium (100 ft. + 10 ft./level)", target: "One spellcaster, creature, or object", duration: "Instantaneous", savingThrow: "None" },
    "haste": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One creature/level, no two of which can be more than 30 ft. apart", duration: "1 round/level (D)", savingThrow: "Fortitude negates (harmless)" },
    "illusory script": { range: "Touch", target: "One touched object weighing no more than 10 lb.", duration: "One day/level (D)", savingThrow: "Will negates (object)" },
    "flame arrow": { range: "Close (25 ft. + 5 ft./2 levels)", target: "Fifty projectiles, all of which must be in contact with each other at the time of casting", duration: "10 min./level (D)", savingThrow: "None" },
    "create food and water": { range: "Close (25 ft. + 5 ft./2 levels)", target: "Food and water to sustain three humans or one horse/level for 24 hours", duration: "24 hours; see text", savingThrow: "None" },
    "ray of exhaustion": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One ray", duration: "1 min./level (D)", savingThrow: "Fortitude partial" },
    "reduce animal": { range: "Touch", target: "One willing animal of Small, Medium, Large, or Huge size", duration: "1 hour/level (D)", savingThrow: "None" },
    "magic vestment": { range: "Touch", target: "Armor or shield touched", duration: "1 hour/level (D)", savingThrow: "Will negates (harmless)" },
    "major image": { range: "Long (400 ft. + 40 ft./level)", target: "Visual figment that cannot extend beyond a 20-ft. cube + one 10-ft. cube/level (S)", duration: "Concentration + 3 rounds", savingThrow: "Will disbelief (if interacted with)" },
    "prayer": { range: "40 ft.", target: "All allies and foes within a 40-ft.-radius burst centered on you", duration: "1 round/level", savingThrow: "None" },
    "keen edge": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One weapon or fifty projectiles, all of which must be in contact with each other", duration: "10 min./level", savingThrow: "None" },
    "neutralize poison": { range: "Touch", target: "Creature or object touched", duration: "Instantaneous", savingThrow: "Will negates (harmless)" },
    "rope trick": { range: "Touch", target: "One piece of rope from 5 ft. to 30 ft. long", duration: "1 hour/level (D)", savingThrow: "None" },
    "ghoul touch": { range: "Touch", target: "Living humanoid touched", duration: "1d6+2 rounds", savingThrow: "Fortitude negates" },
    "restoration, lesser": { range: "Touch", target: "Creature touched", duration: "Instantaneous", savingThrow: "Will negates (harmless)" },
    "knock": { range: "Medium (100 ft. + 10 ft./level)", target: "One door, box, or chest with an area of up to 10 sq. ft./level", duration: "Instantaneous", savingThrow: "None" },
    "make whole": { range: "Close (25 ft. + 5 ft./2 levels)", target: "One object of up to 10 cu. ft./level", duration: "Instantaneous", savingThrow: "None" },
    "touch of idiocy": { range: "Touch", target: "Living creature touched", duration: "1d6 minutes", savingThrow: "None" },
    "enthrall": { range: "Medium (100 ft. + 10 ft./level)", target: "Any number of creatures", duration: "1 hour or less", savingThrow: "Will negates" },
    "fog cloud": { range: "Medium (100 ft. + 10 ft./level)", target: "Fog spreads in 20-ft. radius, 20 ft. high", duration: "10 min./level (D)", savingThrow: "None" },
    "snare": { range: "Touch", target: "Touched rope or cord", duration: "Until triggered or broken", savingThrow: "None" },
    "tree shape": { range: "Personal", target: "You", duration: "1 hour/level (D)", savingThrow: "None" },
};

function isBlankOrSeeText(val) {
    if (val == null) return true;
    const s = String(val).trim().toLowerCase();
    return s === "" || s === "see text";
}

/**
 * Parse description (and optional canonical data) to suggest Range, Target, Duration, Saving Throw.
 * Only returns a field if we have a value and the current value is empty or "See text".
 * @param {string} descriptionHtml - Spell description (may contain HTML)
 * @param {string} spellName - Spell name (for canonical lookup)
 * @param {{ range?: string, target?: string, duration?: string, savingThrow?: string }} current - Current field values
 * @returns {{ range?: string, target?: string, duration?: string, savingThrow?: string }}
 */
export function parseSpellFields(descriptionHtml, spellName, current = {}) {
    const text = stripHtml(descriptionHtml);
    const nameKey = (spellName || "").trim().toLowerCase();
    const out = {};

    // 1) Canonical SRD lookup
    const canonical = CANONICAL_SRD[nameKey];
    if (canonical) {
        if (isBlankOrSeeText(current.range) && canonical.range) out.range = canonical.range;
        if (isBlankOrSeeText(current.target) && canonical.target) out.target = canonical.target;
        if (isBlankOrSeeText(current.duration) && canonical.duration) out.duration = canonical.duration;
        if (isBlankOrSeeText(current.savingThrow) && canonical.savingThrow) out.savingThrow = canonical.savingThrow;
    }

    // 2) Labeled lines in description (e.g. "Range: Long (400 ft.)")
    const rangeLabeled = extractLabeled(text, "Range");
    const targetLabeled = extractLabeled(text, "Target") || extractLabeled(text, "Area");
    const durationLabeled = extractLabeled(text, "Duration");
    const saveLabeled = extractLabeled(text, "Saving Throw");
    if (rangeLabeled && isBlankOrSeeText(current.range) && !out.range) out.range = rangeLabeled;
    if (targetLabeled && isBlankOrSeeText(current.target) && !out.target) out.target = targetLabeled;
    if (durationLabeled && isBlankOrSeeText(current.duration) && !out.duration) out.duration = durationLabeled;
    if (saveLabeled && isBlankOrSeeText(current.savingThrow) && !out.savingThrow) out.savingThrow = saveLabeled;

    // 3) Heuristics from prose
    const heur = heuristicFromText(text);
    if (heur.range && isBlankOrSeeText(current.range) && !out.range) out.range = heur.range;
    if (heur.target && isBlankOrSeeText(current.target) && !out.target) out.target = heur.target;
    if (heur.duration && isBlankOrSeeText(current.duration) && !out.duration) out.duration = heur.duration;
    if (heur.savingThrow && isBlankOrSeeText(current.savingThrow) && !out.savingThrow) out.savingThrow = heur.savingThrow;

    return out;
}

/**
 * Apply parsed fields to a spell system object. Only overwrites range, target, duration, savingThrow
 * when the current value is blank or "See text" and we have a parsed value.
 * @param {object} system - spell system object (mutated)
 * @param {object} parsed - result of parseSpellFields()
 */
export function applyParsedSpellFields(system, parsed) {
    if (!system || !parsed) return;
    if (parsed.range != null) system.range = parsed.range;
    if (parsed.target != null) system.target = parsed.target;
    if (parsed.duration != null) system.duration = parsed.duration;
    if (parsed.savingThrow != null) system.savingThrow = parsed.savingThrow;
}
