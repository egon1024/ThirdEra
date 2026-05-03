/**
 * Maintainer + world migration: map legacy creatureFeature `system.key` values to
 * canonical compendium keys with `system.cgsGrantOverrides` for parametrized CGS.
 *
 * @see docs-site/compendium-guide.md
 */

/** @typedef {{ grants?: unknown[], senses?: unknown[] }} CgsOverrideShape */

/**
 * Each rule maps one legacy `system.key` to the post-consolidation item shape.
 * @typedef {{
 *   legacyKey: string,
 *   result: {
 *     name: string,
 *     systemKey: string,
 *     abilityKind: string,
 *     img: string,
 *     description: string,
 *     cgsGrants: { grants: unknown[], senses: unknown[] },
 *     cgsGrantOverrides: CgsOverrideShape
 *   }
 * }} CreatureFeatureConsolidationRule
 */

/** @type {readonly CreatureFeatureConsolidationRule[]} */
const CONSOLIDATION_RULES = Object.freeze([
    {
        legacyKey: "creatureDarkvision60",
        result: {
            name: "Darkvision",
            systemKey: "creatureDarkvision",
            abilityKind: "Ex",
            img: "icons/svg/explosion.svg",
            description:
                "<p><strong>What it does (SRD):</strong> The creature can see in <strong>total darkness</strong> out to the distance set on this copy (default from the stat block). Darkvision is <strong>black and white</strong> only unless another rule says otherwise.</p><p><strong>ThirdEra:</strong> Distance is under <strong>CGS parameters and overrides</strong> on this item (merged over the canonical template). The stat block’s distance is preserved when migrating from older packs.</p>",
            cgsGrants: { grants: [], senses: [{ type: "darkvision", range: "" }] },
            cgsGrantOverrides: { grants: [], senses: [{ type: "darkvision", range: "60 ft" }] }
        }
    },
    {
        legacyKey: "creatureDarkvision90",
        result: {
            name: "Darkvision",
            systemKey: "creatureDarkvision",
            abilityKind: "Ex",
            img: "icons/svg/explosion.svg",
            description:
                "<p><strong>What it does (SRD):</strong> The creature can see in <strong>total darkness</strong> out to the distance set on this copy (default from the stat block). Darkvision is <strong>black and white</strong> only unless another rule says otherwise.</p><p><strong>ThirdEra:</strong> Distance is under <strong>CGS parameters and overrides</strong> on this item (merged over the canonical template). The stat block’s distance is preserved when migrating from older packs.</p>",
            cgsGrants: { grants: [], senses: [{ type: "darkvision", range: "" }] },
            cgsGrantOverrides: { grants: [], senses: [{ type: "darkvision", range: "90 ft" }] }
        }
    },
    {
        legacyKey: "creatureDarkvision120",
        result: {
            name: "Darkvision",
            systemKey: "creatureDarkvision",
            abilityKind: "Ex",
            img: "icons/svg/explosion.svg",
            description:
                "<p><strong>What it does (SRD):</strong> The creature can see in <strong>total darkness</strong> out to the distance set on this copy (default from the stat block). Darkvision is <strong>black and white</strong> only unless another rule says otherwise.</p><p><strong>ThirdEra:</strong> Distance is under <strong>CGS parameters and overrides</strong> on this item (merged over the canonical template). The stat block’s distance is preserved when migrating from older packs.</p>",
            cgsGrants: { grants: [], senses: [{ type: "darkvision", range: "" }] },
            cgsGrantOverrides: { grants: [], senses: [{ type: "darkvision", range: "120 ft" }] }
        }
    },
    {
        legacyKey: "creatureBlindsight60",
        result: {
            name: "Blindsight",
            systemKey: "creatureBlindsight",
            abilityKind: "Ex",
            img: "icons/svg/eye.svg",
            description:
                "<p><strong>What it does (SRD):</strong> The creature perceives its surroundings out to the distance on this copy without vision, ignoring darkness and invisibility, within the limits of the SRD blindsight rules.</p><p><strong>ThirdEra:</strong> Set distance under <strong>CGS parameters and overrides</strong>.</p>",
            cgsGrants: { grants: [], senses: [{ type: "blindsight", range: "" }] },
            cgsGrantOverrides: { grants: [], senses: [{ type: "blindsight", range: "60 ft" }] }
        }
    },
    {
        legacyKey: "creatureBlindsense30",
        result: {
            name: "Blindsense",
            systemKey: "creatureBlindsense",
            abilityKind: "Ex",
            img: "icons/svg/eye.svg",
            description:
                "<p><strong>What it does (SRD):</strong> The creature notices and locates creatures and objects within the distance on this copy using nonvisual senses.</p><p><strong>ThirdEra:</strong> Set distance under <strong>CGS parameters and overrides</strong>.</p>",
            cgsGrants: { grants: [], senses: [{ type: "blindsense", range: "" }] },
            cgsGrantOverrides: { grants: [], senses: [{ type: "blindsense", range: "30 ft" }] }
        }
    },
    {
        legacyKey: "creatureTremorsense20",
        result: {
            name: "Tremorsense",
            systemKey: "creatureTremorsense",
            abilityKind: "Ex",
            img: "icons/svg/eye.svg",
            description:
                "<p><strong>What it does (SRD):</strong> The creature can automatically sense the location of anything within the distance on this copy that is in contact with the ground.</p><p><strong>ThirdEra:</strong> Set distance under <strong>CGS parameters and overrides</strong>.</p>",
            cgsGrants: { grants: [], senses: [{ type: "tremorsense", range: "" }] },
            cgsGrantOverrides: { grants: [], senses: [{ type: "tremorsense", range: "20 ft" }] }
        }
    },
    {
        legacyKey: "creatureThickHideDr2",
        result: {
            name: "Thick Hide",
            systemKey: "creatureDamageReductionNone",
            abilityKind: "Ex",
            img: "icons/svg/shield.svg",
            description:
                "<p><strong>What it does (SRD):</strong> Thick hide or similar quality gives <strong>damage reduction</strong> with <strong>no bypass</strong> listed in the stat block (e.g. DR 2/—).</p><p><strong>ThirdEra:</strong> The numeric value is under <strong>CGS parameters and overrides</strong>; the base grant uses DR with an empty bypass.</p>",
            cgsGrants: {
                grants: [
                    {
                        category: "damageReduction",
                        value: 0,
                        bypass: "",
                        label: "Damage reduction (no bypass); value from overrides."
                    }
                ],
                senses: []
            },
            cgsGrantOverrides: {
                grants: [
                    {
                        category: "damageReduction",
                        value: 2,
                        bypass: "",
                        label: "Damage reduction 2/— (SRD-style thick hide)."
                    }
                ],
                senses: []
            }
        }
    },
    {
        legacyKey: "creatureDamageReduction5Magic",
        result: {
            name: "Damage Reduction (magic)",
            systemKey: "creatureDamageReductionMagic",
            abilityKind: "Su",
            img: "icons/svg/shield.svg",
            description:
                "<p><strong>What it does (SRD):</strong> The creature ignores weapon damage unless the attack overcomes the listed DR (commonly <strong>magic</strong>).</p><p><strong>ThirdEra:</strong> Bypass stays <strong>magic</strong>; set the numeric value under <strong>CGS parameters and overrides</strong>.</p>",
            cgsGrants: {
                grants: [
                    {
                        category: "damageReduction",
                        value: 0,
                        bypass: "magic",
                        label: "Damage reduction /magic; value from overrides."
                    }
                ],
                senses: []
            },
            cgsGrantOverrides: {
                grants: [
                    {
                        category: "damageReduction",
                        value: 5,
                        bypass: "magic",
                        label: "Damage reduction 5/magic (SRD)."
                    }
                ],
                senses: []
            }
        }
    },
    {
        legacyKey: "creatureDamageReduction10Magic",
        result: {
            name: "Damage Reduction (magic)",
            systemKey: "creatureDamageReductionMagic",
            abilityKind: "Su",
            img: "icons/svg/shield.svg",
            description:
                "<p><strong>What it does (SRD):</strong> The creature ignores weapon damage unless the attack overcomes the listed DR (commonly <strong>magic</strong>).</p><p><strong>ThirdEra:</strong> Bypass stays <strong>magic</strong>; set the numeric value under <strong>CGS parameters and overrides</strong>.</p>",
            cgsGrants: {
                grants: [
                    {
                        category: "damageReduction",
                        value: 0,
                        bypass: "magic",
                        label: "Damage reduction /magic; value from overrides."
                    }
                ],
                senses: []
            },
            cgsGrantOverrides: {
                grants: [
                    {
                        category: "damageReduction",
                        value: 10,
                        bypass: "magic",
                        label: "Damage reduction 10/magic (SRD)."
                    }
                ],
                senses: []
            }
        }
    },
    {
        legacyKey: "creatureResistanceAcid10",
        result: {
            name: "Energy Resistance",
            systemKey: "creatureEnergyResistance",
            abilityKind: "Ex",
            img: "icons/svg/acid.svg",
            description:
                "<p><strong>What it does (SRD):</strong> The creature ignores the first <strong>N</strong> points of damage from each attack or effect of the listed energy type.</p><p><strong>ThirdEra:</strong> Type and amount are set under <strong>CGS parameters and overrides</strong> (merged over an empty template grant list).</p>",
            cgsGrants: { grants: [], senses: [] },
            cgsGrantOverrides: {
                grants: [
                    {
                        category: "energyResistance",
                        energyType: "acid",
                        amount: 10,
                        label: "Resist acid 10 (SRD-style innate resistance)."
                    }
                ],
                senses: []
            }
        }
    },
    {
        legacyKey: "creatureResistanceCold10",
        result: {
            name: "Energy Resistance",
            systemKey: "creatureEnergyResistance",
            abilityKind: "Ex",
            img: "icons/svg/frozen.svg",
            description:
                "<p><strong>What it does (SRD):</strong> The creature ignores the first <strong>N</strong> points of damage from each attack or effect of the listed energy type.</p><p><strong>ThirdEra:</strong> Type and amount are set under <strong>CGS parameters and overrides</strong>.</p>",
            cgsGrants: { grants: [], senses: [] },
            cgsGrantOverrides: {
                grants: [
                    {
                        category: "energyResistance",
                        energyType: "cold",
                        amount: 10,
                        label: "Resist cold 10 (SRD-style innate resistance)."
                    }
                ],
                senses: []
            }
        }
    },
    {
        legacyKey: "creatureResistanceElectricity10",
        result: {
            name: "Energy Resistance",
            systemKey: "creatureEnergyResistance",
            abilityKind: "Ex",
            img: "icons/svg/lightning.svg",
            description:
                "<p><strong>What it does (SRD):</strong> The creature ignores the first <strong>N</strong> points of damage from each attack or effect of the listed energy type.</p><p><strong>ThirdEra:</strong> Type and amount are set under <strong>CGS parameters and overrides</strong>.</p>",
            cgsGrants: { grants: [], senses: [] },
            cgsGrantOverrides: {
                grants: [
                    {
                        category: "energyResistance",
                        energyType: "electricity",
                        amount: 10,
                        label: "Resist electricity 10 (SRD-style innate resistance)."
                    }
                ],
                senses: []
            }
        }
    },
    {
        legacyKey: "creatureResistanceFire10",
        result: {
            name: "Energy Resistance",
            systemKey: "creatureEnergyResistance",
            abilityKind: "Ex",
            img: "icons/svg/fire.svg",
            description:
                "<p><strong>What it does (SRD):</strong> The creature ignores the first <strong>N</strong> points of damage from each attack or effect of the listed energy type.</p><p><strong>ThirdEra:</strong> Type and amount are set under <strong>CGS parameters and overrides</strong>.</p>",
            cgsGrants: { grants: [], senses: [] },
            cgsGrantOverrides: {
                grants: [
                    {
                        category: "energyResistance",
                        energyType: "fire",
                        amount: 10,
                        label: "Resist fire 10 (SRD-style innate resistance)."
                    }
                ],
                senses: []
            }
        }
    },
    {
        legacyKey: "creatureFastHealing1",
        result: {
            name: "Fast Healing",
            systemKey: "creatureFastHealing",
            abilityKind: "Su",
            img: "icons/svg/heal.svg",
            description:
                "<p><strong>What it does (SRD):</strong> The creature regains hit points each round at the rate given in the stat block (unless the rules say otherwise).</p><p><strong>ThirdEra:</strong> There is no separate fast-healing numeric CGS row yet; track rounds at the table. Future variants can use overrides when a CGS category is added.</p>",
            cgsGrants: { grants: [], senses: [] },
            cgsGrantOverrides: { grants: [], senses: [] }
        }
    }
]);

/** @type {Map<string, CreatureFeatureConsolidationRule> | null} */
let _legacyKeyRuleMap = null;

/**
 * @returns {Map<string, CreatureFeatureConsolidationRule>}
 */
export function getCreatureFeatureConsolidationRuleMap() {
    if (!_legacyKeyRuleMap) {
        /** @type {Map<string, CreatureFeatureConsolidationRule>} */
        const m = new Map();
        for (const r of CONSOLIDATION_RULES) m.set(r.legacyKey, r);
        _legacyKeyRuleMap = m;
    }
    return _legacyKeyRuleMap;
}

/**
 * @returns {readonly string[]}
 */
export function getLegacyCreatureFeatureKeysForConsolidation() {
    return CONSOLIDATION_RULES.map((r) => r.legacyKey);
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function deepEqualJson(a, b) {
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return false;
    }
}

/**
 * @param {unknown} item - Item-like JSON or Foundry Item
 * @returns {{ changed: boolean, item: unknown } | null} Null when not a creatureFeature or no rule.
 */
export function transformCreatureFeatureItemIfLegacy(item) {
    if (!item || typeof item !== "object") return null;
    const t = /** @type {{ type?: string }} */ (item).type;
    if (t !== "creatureFeature") return null;
    const sys = /** @type {{ system?: Record<string, unknown> }} */ (item).system;
    if (!sys || typeof sys !== "object") return null;
    const key = typeof sys.key === "string" ? sys.key.trim() : "";
    if (!key) return null;
    const rule = getCreatureFeatureConsolidationRuleMap().get(key);
    if (!rule) return null;

    const { name, systemKey, abilityKind, img, description, cgsGrants, cgsGrantOverrides } = rule.result;
    const next = {
        ...item,
        name,
        img,
        system: {
            ...sys,
            key: systemKey,
            abilityKind,
            description,
            changes: Array.isArray(sys.changes) ? sys.changes : [],
            cgsGrants: JSON.parse(JSON.stringify(cgsGrants)),
            cgsGrantOverrides: JSON.parse(JSON.stringify(cgsGrantOverrides))
        }
    };
    if ("cgsTemplateUuid" in next.system) {
        delete /** @type {Record<string, unknown>} */ (next.system).cgsTemplateUuid;
    }

    const changed =
        item.name !== next.name ||
        /** @type {{ system?: { key?: string } }} */ (item).system?.key !== systemKey ||
        !deepEqualJson(
            /** @type {{ system?: { cgsGrants?: unknown, cgsGrantOverrides?: unknown } }} */ (item).system?.cgsGrants,
            cgsGrants
        ) ||
        !deepEqualJson(
            /** @type {{ system?: { cgsGrantOverrides?: unknown } }} */ (item).system?.cgsGrantOverrides,
            cgsGrantOverrides
        );

    return { changed, item: next };
}
