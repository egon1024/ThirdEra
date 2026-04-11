/**
 * Foundry runtime: refresh typed-defense catalog label maps from world + optional compendium pack.
 *
 * @module
 */

import { buildTypedDefenseCatalogMapsFromPlainDocs, mergeConfigAndTypedDefenseCatalogMaps } from "./cgs-typed-defense-catalog.mjs";

/**
 * @param {Game | undefined} game
 * @param {object | undefined} configThirdera CONFIG.THIRDERA
 */
export function getMergedTypedDefenseLabelMapsForPrepare(game, configThirdera) {
    const cat = game?.thirdera?.typedDefenseCatalogMaps;
    return mergeConfigAndTypedDefenseCatalogMaps(configThirdera, cat);
}

/** @param {Game} game */
export async function refreshTypedDefenseCatalogCache(game) {
    if (!game?.thirdera) return;
    /** @type {Array<{ name?: string, system?: { catalogKey?: string, catalogKind?: string } }>} */
    const plain = [];
    for (const item of game.items?.contents ?? []) {
        if (item.type !== "defenseCatalog") continue;
        plain.push({ name: item.name, system: item.system });
    }
    try {
        const pack = game.packs?.get?.("thirdera.thirdera_defense_catalog");
        if (pack) {
            const docs = await pack.getDocuments();
            for (const d of docs) {
                if (d.type === "defenseCatalog") plain.push({ name: d.name, system: d.system });
            }
        }
    } catch (_) {
        /* optional pack */
    }
    game.thirdera.typedDefenseCatalogMaps = buildTypedDefenseCatalogMapsFromPlainDocs(plain);
}
