import { yieldToMain } from "./client-main-thread-cooperation.mjs";

const RACE_QUAL_MIGRATION_YIELD_EVERY = 8;

/**
 * Default qualitative racial traits (vision, immunities, familiarity, languages, etc.) for stock ThirdEra races.
 * Ability adjustments and unconditional skill/save rows belong in `system.changes` instead of duplicating here.
 *
 * Used by: (1) GM `ready` migration when `system.otherRacialTraits` is empty or matches retired bundled wording;
 * (2) must stay in sync with `packs/races/*.json` `otherRacialTraits` for new compendium imports.
 *
 * Bump RACE_QUALITATIVE_TRAITS_REV when stock HTML changes; optionally extend `isStaleBundledQualitativeTraitsHtml`
 * if old bundled prose must be rewritten in existing worlds.
 */

/** Increment when editing stock HTML or stale-detection for bundled prose refresh. */
export const RACE_QUALITATIVE_TRAITS_REV = 2;

const STOCK_OTHER_RACIAL_TRAITS_BY_NAME = Object.freeze({
    Human: `<ul>
<li><strong>Extra feat:</strong> one bonus feat at 1st level.</li>
<li><strong>Skill points:</strong> +4 at 1st level and +1 per level thereafter (before Intelligence).</li>
<li><strong>Favored class:</strong> any class.</li>
<li><strong>Languages:</strong> Common; bonus languages may include any non-secret language.</li>
</ul>`,

    Dwarf: `<ul>
<li><strong>Darkvision</strong> 60 ft.</li>
<li><strong>Stonecunning:</strong> +2 racial bonus on checks to notice unusual stonework; automatic Search check within 10 ft. as if actively searching.</li>
<li><strong>Stability:</strong> +4 on checks to resist bull rush or trip when standing on the ground.</li>
<li><strong>Saves:</strong> +2 racial bonus on saving throws against poison, spells, and spell-like abilities.</li>
<li><strong>Combat:</strong> +1 racial bonus on attack rolls against orcs, half-orcs, and goblinoids; +4 dodge bonus to AC against giants.</li>
<li><strong>Skills:</strong> +2 racial bonus on Appraise checks related to stone or metal; +2 on Craft checks related to stone or metal.</li>
<li><strong>Weapon familiarity:</strong> treat dwarven waraxes and dwarven urgroshes as martial weapons, not exotic.</li>
<li><strong>Speed in armor/load:</strong> base speed is not reduced when wearing medium or heavy armor or carrying a medium or heavy load (when it would otherwise apply).</li>
<li><strong>Languages:</strong> Common and Dwarven; bonus: Giant, Gnome, Goblin, Orc, Terran, Undercommon.</li>
</ul>`,

    Elf: `<ul>
<li><strong>Immunity</strong> to magic sleep effects.</li>
<li><strong>Saves:</strong> +2 racial bonus on saving throws vs enchantment spells and effects.</li>
<li><strong>Low-light vision.</strong></li>
<li><strong>Weapon proficiency:</strong> longswords, rapiers, longbows (including composite), and shortbows (including composite).</li>
<li><strong>Languages:</strong> Common and Elven; bonus: Draconic, Gnoll, Gnome, Goblin, Orc, Sylvan.</li>
</ul>`,

    Gnome: `<ul>
<li><strong>Low-light vision.</strong></li>
<li><strong>Saves:</strong> +2 racial bonus on saving throws against illusions.</li>
<li><strong>Illusions you cast:</strong> +1 to the DC for saves against your illusion spells.</li>
<li><strong>Weapon familiarity:</strong> treat gnome hooked hammers as martial weapons.</li>
<li><strong>Combat:</strong> +4 dodge bonus to AC against giants.</li>
<li><strong>Spell-like ability:</strong> 1/day—<em>speak with animals</em> (burrowing mammal only, duration 1 minute; caster level 1st, save DC 10 + Cha mod).</li>
<li><strong>Languages:</strong> Common, Gnome, and Sylvan; bonus: Draconic, Dwarven, Elven, Giant, Goblin, Orc.</li>
</ul>`,

    "Half-Elf": `<ul>
<li><strong>Immunity</strong> to magic sleep effects.</li>
<li><strong>Saves:</strong> +2 racial bonus on saving throws vs enchantment spells and effects.</li>
<li><strong>Low-light vision.</strong></li>
<li><strong>Elven blood:</strong> counted as both elf and human for effects related to race.</li>
<li><strong>Languages:</strong> Common and Elven; bonus: any (except secret languages), as for high Intelligence.</li>
<li><strong>Favored class:</strong> any class.</li>
</ul>`,

    "Half-Orc": `<ul>
<li><strong>Darkvision</strong> 60 ft.</li>
<li><strong>Orc blood:</strong> counted as both human and orc for effects related to race.</li>
<li><strong>Languages:</strong> Common and Orc; bonus: Draconic, Giant, Gnoll, Goblin, Abyssal.</li>
</ul>`,

    Halfling: `<ul>
<li><strong>Saves:</strong> +2 morale bonus on saving throws against fear.</li>
<li><strong>Thrown weapons &amp; slings:</strong> +1 racial bonus on attack rolls; stones and sling bullets are treated as one size larger for range increments and wind effects.</li>
<li><strong>Size in combat:</strong> +1 size bonus to AC against larger opponents; +1 size bonus on attack rolls against larger opponents.</li>
<li><strong>Languages:</strong> Common and Halfling; bonus: Dwarven, Elven, Gnome, Goblin, Orc.</li>
</ul>`
});

/**
 * @param {string|undefined} name - Race item name
 * @returns {string}
 */
export function getStockOtherRacialTraitsHtmlForName(name) {
    const n = (name ?? "").trim();
    return STOCK_OTHER_RACIAL_TRAITS_BY_NAME[n] ?? "";
}

/**
 * True when HTML is non-empty and matches retired bundled wording (e.g. in-world migration refresh).
 *
 * @param {unknown} html
 * @returns {boolean}
 */
export function isStaleBundledQualitativeTraitsHtml(html) {
    const h = String(html ?? "");
    if (!h.trim()) return false;
    return /mechanical table|per SRD Small rules/i.test(h);
}

/**
 * Pure decision helper for tests and documentation.
 *
 * @param {number} docRev - flags.thirdera.raceQualitativeTraitsRev
 * @param {unknown} currentHtml - system.otherRacialTraits
 * @param {string} itemName - doc.name
 * @returns {{ action: "skip" } | { action: "bump-flag-only" } | { action: "set-html-and-flag", html: string }}
 */
export function decideRaceQualitativeTraitsUpdate(docRev, currentHtml, itemName) {
    const rev = Number(docRev);
    const r = Number.isFinite(rev) && rev >= 0 ? rev : 0;
    if (r >= RACE_QUALITATIVE_TRAITS_REV) return { action: "skip" };
    const trimmed = String(currentHtml ?? "").trim();
    const stock = getStockOtherRacialTraitsHtmlForName(itemName);

    if (trimmed !== "") {
        if (stock && isStaleBundledQualitativeTraitsHtml(trimmed)) {
            return { action: "set-html-and-flag", html: stock };
        }
        return { action: "bump-flag-only" };
    }
    if (stock) return { action: "set-html-and-flag", html: stock };
    return { action: "bump-flag-only" };
}

/**
 * @param {object} doc - Item document (race)
 * @param {typeof foundry.utils} [utils]
 * @returns {number}
 */
export function getRaceQualitativeTraitsRevOnDoc(doc, utils = foundry?.utils) {
    const rev = utils?.getProperty?.(doc?.flags, "thirdera.raceQualitativeTraitsRev");
    const n = Number(rev);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * @param {Item} doc - Foundry Item (race)
 * @param {object} [opts]
 * @param {typeof foundry.utils} [opts.utils]
 * @returns {Promise<"skipped" | "unchanged" | "updated">}
 */
export async function applyRaceQualitativeTraitsToDocument(doc, opts = {}) {
    const utils = opts.utils ?? foundry?.utils;
    if (!doc || doc.type !== "race") return "skipped";

    const decision = decideRaceQualitativeTraitsUpdate(
        getRaceQualitativeTraitsRevOnDoc(doc, utils),
        doc.system?.otherRacialTraits,
        doc.name
    );

    if (decision.action === "skip") return "skipped";

    try {
        if (decision.action === "set-html-and-flag") {
            await doc.update({
                system: { otherRacialTraits: decision.html },
                flags: { thirdera: { raceQualitativeTraitsRev: RACE_QUALITATIVE_TRAITS_REV } }
            });
            return "updated";
        }
        await doc.update({
            flags: { thirdera: { raceQualitativeTraitsRev: RACE_QUALITATIVE_TRAITS_REV } }
        });
        return "unchanged";
    } catch (e) {
        console.warn(`Third Era | Race qualitative traits migration failed for "${doc.name}":`, e);
        return "skipped";
    }
}

/**
 * GM only: fill empty `otherRacialTraits` on stock-named races in compendium, world items, and embedded actor races.
 *
 * @param {object} deps
 * @param {Game} deps.game
 * @returns {Promise<{ compendiumUpdated: number, compendiumUnchanged: number, worldUpdated: number, worldUnchanged: number, actorsUpdated: number, actorsUnchanged: number, skipped: boolean, reason?: string }>}
 */
export async function migrateAllRaceQualitativeTraits(deps) {
    const game = deps?.game;
    const user = game?.user;
    if (!user?.isGM) {
        return {
            skipped: true,
            reason: "not-gm",
            compendiumUpdated: 0,
            compendiumUnchanged: 0,
            worldUpdated: 0,
            worldUnchanged: 0,
            actorsUpdated: 0,
            actorsUnchanged: 0
        };
    }

    let compendiumUpdated = 0;
    let compendiumUnchanged = 0;
    const pack = game.packs?.get?.("thirdera.thirdera_races");
    if (pack) {
        const docs = await pack.getDocuments();
        let docIdx = 0;
        for (const doc of docs) {
            if (++docIdx % RACE_QUAL_MIGRATION_YIELD_EVERY === 0) await yieldToMain();
            if (doc.type !== "race") continue;
            if (getRaceQualitativeTraitsRevOnDoc(doc) >= RACE_QUALITATIVE_TRAITS_REV) continue;
            const result = await applyRaceQualitativeTraitsToDocument(doc);
            if (result === "updated") compendiumUpdated++;
            else if (result === "unchanged") compendiumUnchanged++;
        }
    }

    let worldUpdated = 0;
    let worldUnchanged = 0;
    let worldPass = 0;
    for (const item of game.items?.filter?.((i) => i.type === "race") ?? []) {
        if (getRaceQualitativeTraitsRevOnDoc(item) >= RACE_QUALITATIVE_TRAITS_REV) continue;
        if (++worldPass % RACE_QUAL_MIGRATION_YIELD_EVERY === 0) await yieldToMain();
        const result = await applyRaceQualitativeTraitsToDocument(item);
        if (result === "updated") worldUpdated++;
        else if (result === "unchanged") worldUnchanged++;
    }

    let actorsUpdated = 0;
    let actorsUnchanged = 0;
    let actorRacePass = 0;
    for (const actor of game.actors ?? []) {
        const races = actor.items?.filter?.((i) => i.type === "race") ?? [];
        for (const item of races) {
            if (getRaceQualitativeTraitsRevOnDoc(item) >= RACE_QUALITATIVE_TRAITS_REV) continue;
            if (++actorRacePass % RACE_QUAL_MIGRATION_YIELD_EVERY === 0) await yieldToMain();
            const result = await applyRaceQualitativeTraitsToDocument(item);
            if (result === "updated") actorsUpdated++;
            else if (result === "unchanged") actorsUnchanged++;
        }
    }

    return {
        skipped: false,
        compendiumUpdated,
        compendiumUnchanged,
        worldUpdated,
        worldUnchanged,
        actorsUpdated,
        actorsUnchanged
    };
}
