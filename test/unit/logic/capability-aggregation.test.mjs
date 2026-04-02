import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    applySenseSuppressions,
    CGS_CAPABILITY_CATEGORY_IDS,
    collectCapabilityContributions,
    createEmptyCapabilityGrants,
    formatMergedSenseLabel,
    getActiveCapabilityGrants,
    mergeCapabilityGrantContributions,
    mergeDamageReductionRows,
    mergeEnergyResistanceRows,
    mergeImmunityRows,
    mergeSpellGrantRows,
    mergeSenseRows,
    normalizeSenseRangeKey,
    registerCapabilitySourceProviders
} from "../../../module/logic/capability-aggregation.mjs";

describe("createEmptyCapabilityGrants", () => {
    it("includes every registered category with stable empty shape", () => {
        const empty = createEmptyCapabilityGrants();
        for (const id of CGS_CAPABILITY_CATEGORY_IDS) {
            expect(empty).toHaveProperty(id);
        }
        expect(empty.senses.rows).toEqual([]);
        expect(empty.senses.sensesUnionRows).toEqual([]);
        expect(empty.senses.suppressed).toEqual([]);
        expect(empty.senseSuppressions.grants).toEqual([]);
        expect(empty.spellGrants.rows).toEqual([]);
    });

    it("returns a fresh object each call", () => {
        const a = createEmptyCapabilityGrants();
        const b = createEmptyCapabilityGrants();
        expect(a).not.toBe(b);
        expect(a.senses).not.toBe(b.senses);
    });
});

describe("normalizeSenseRangeKey", () => {
    it("trims and normalizes whitespace case", () => {
        expect(normalizeSenseRangeKey("  60   FT  ")).toBe("60 ft");
        expect(normalizeSenseRangeKey(null)).toBe("");
    });
});

describe("formatMergedSenseLabel", () => {
    it("uses injected labels and appends range", () => {
        expect(formatMergedSenseLabel("darkvision", "60 ft", { senseTypeLabels: { darkvision: "Darkvision" } })).toBe(
            "Darkvision 60 ft"
        );
        expect(formatMergedSenseLabel("darkvision", "", { senseTypeLabels: { darkvision: "Darkvision" } })).toBe(
            "Darkvision"
        );
    });
});

describe("mergeSenseRows", () => {
    it("dedupes by senseType and normalized range and merges sources", () => {
        const rows = mergeSenseRows(
            [
                {
                    senseType: "darkvision",
                    range: "60 ft",
                    _source: { label: "Stat block" }
                },
                {
                    senseType: "darkvision",
                    range: "60 FT",
                    _source: { label: "Capability grants", sourceRef: { kind: "actorCgsGrants" } }
                },
                { senseType: "lowLight", range: "", _source: { label: "Race" } }
            ],
            { senseTypeLabels: { darkvision: "Darkvision", lowLight: "Low-light vision" } }
        );
        expect(rows).toHaveLength(2);
        const dv = rows.find(r => r.senseType === "darkvision");
        expect(dv?.sources).toHaveLength(2);
        expect(dv?.sources.map(s => s.label).sort()).toEqual(["Capability grants", "Stat block"]);
        expect(rows.find(r => r.senseType === "lowLight")?.sources).toEqual([{ label: "Race" }]);
    });

    it("keeps distinct ranges separate", () => {
        const rows = mergeSenseRows(
            [
                { senseType: "darkvision", range: "60 ft", _source: { label: "A" } },
                { senseType: "darkvision", range: "120 ft", _source: { label: "B" } }
            ],
            { senseTypeLabels: { darkvision: "Darkvision" } }
        );
        expect(rows).toHaveLength(2);
    });
});

describe("mergeSpellGrantRows", () => {
    it("dedupes by spellUuid and merges sources", () => {
        const rows = mergeSpellGrantRows([
            {
                spellUuid: "Compendium.x.spells.Item.abc",
                usesPerDay: 1,
                _source: { label: "Feat A" }
            },
            {
                spellUuid: "Compendium.x.spells.Item.abc",
                usesPerDay: 2,
                atWill: false,
                _source: { label: "Feat B", sourceRef: { kind: "item", uuid: "Item.y" } }
            }
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0].spellUuid).toBe("Compendium.x.spells.Item.abc");
        expect(rows[0].sources.map((s) => s.label).sort()).toEqual(["Feat A", "Feat B"]);
        expect(rows[0].usesPerDay).toBe(3);
    });

    it("accepts string usesPerDay from item JSON", () => {
        const rows = mergeSpellGrantRows([
            { spellUuid: "Compendium.x.spells.Item.abc", usesPerDay: "2", _source: { label: "Ring" } }
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0].usesPerDay).toBe(2);
    });
});

describe("mergeImmunityRows (Phase 5e)", () => {
    it("dedupes by tag and merges sources", () => {
        const rows = mergeImmunityRows([
            { tag: "fire", _source: { label: "Red dragon" } },
            { tag: "fire", _source: { label: "Ring of fire immunity", sourceRef: { kind: "item", uuid: "Item.ring1" } } },
            { tag: "poison", _source: { label: "Construct type" } }
        ], { immunityTagLabels: { fire: "Fire", poison: "Poison" } });
        expect(rows).toHaveLength(2);
        const fire = rows.find(r => r.tag === "fire");
        expect(fire).toBeDefined();
        expect(fire?.sources).toHaveLength(2);
        expect(fire?.sources.map(s => s.label).sort()).toEqual(["Red dragon", "Ring of fire immunity"]);
        expect(fire?.label).toBe("Fire");
        const poison = rows.find(r => r.tag === "poison");
        expect(poison?.label).toBe("Poison");
    });

    it("uses tag as label fallback when no labels provided", () => {
        const rows = mergeImmunityRows([
            { tag: "customImmunity", _source: { label: "Mystery" } }
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0].tag).toBe("customImmunity");
        expect(rows[0].label).toBe("customImmunity");
    });

    it("returns empty array for empty input", () => {
        expect(mergeImmunityRows([])).toEqual([]);
        expect(mergeImmunityRows(null)).toEqual([]);
    });

    it("skips invalid atoms", () => {
        const rows = mergeImmunityRows([
            null,
            { tag: "", _source: { label: "Empty tag" } },
            { tag: "sleep", _source: { label: "Elf racial" } }
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0].tag).toBe("sleep");
    });
});

describe("mergeEnergyResistanceRows (Phase 5e)", () => {
    it("dedupes by energyType and takes MAX value", () => {
        const rows = mergeEnergyResistanceRows([
            { energyType: "fire", amount: 10, _source: { label: "Armor" } },
            { energyType: "fire", amount: 20, _source: { label: "Ring", sourceRef: { kind: "item", uuid: "Item.ring2" } } },
            { energyType: "cold", amount: 5, _source: { label: "Racial" } }
        ], { energyTypeLabels: { fire: "Fire", cold: "Cold" } });
        expect(rows).toHaveLength(2);
        const fire = rows.find(r => r.energyType === "fire");
        expect(fire).toBeDefined();
        expect(fire?.amount).toBe(20);
        expect(fire?.sources).toHaveLength(2);
        expect(fire?.label).toBe("Fire 20");
        const cold = rows.find(r => r.energyType === "cold");
        expect(cold?.amount).toBe(5);
        expect(cold?.label).toBe("Cold 5");
    });

    it("accumulates sources even when lower amount", () => {
        const rows = mergeEnergyResistanceRows([
            { energyType: "acid", amount: 30, _source: { label: "High" } },
            { energyType: "acid", amount: 10, _source: { label: "Low" } }
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0].amount).toBe(30);
        expect(rows[0].sources).toHaveLength(2);
    });

    it("returns empty array for empty input", () => {
        expect(mergeEnergyResistanceRows([])).toEqual([]);
    });

    it("skips invalid atoms", () => {
        const rows = mergeEnergyResistanceRows([
            null,
            { energyType: "", amount: 10, _source: { label: "No type" } },
            { energyType: "sonic", amount: 15, _source: { label: "Valid" } }
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0].energyType).toBe("sonic");
    });
});

describe("mergeDamageReductionRows (Phase 5e)", () => {
    it("keeps all DR rows with distinct value+bypass combinations", () => {
        const rows = mergeDamageReductionRows([
            { value: 10, bypass: "magic", _source: { label: "Stoneskin" } },
            { value: 5, bypass: "silver", _source: { label: "Lycanthrope" } },
            { value: 10, bypass: "adamantine", _source: { label: "Golem" } }
        ], { drBypassLabels: { magic: "Magic", silver: "Silver", adamantine: "Adamantine" } });
        expect(rows).toHaveLength(3);
        expect(rows.map(r => `${r.value}/${r.bypass}`).sort()).toEqual(["10/adamantine", "10/magic", "5/silver"]);
    });

    it("merges sources for same value+bypass (case-insensitive key, preserves first bypass)", () => {
        const rows = mergeDamageReductionRows([
            { value: 10, bypass: "magic", _source: { label: "Spell A" } },
            { value: 10, bypass: "MAGIC", _source: { label: "Spell B" } }
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0].sources).toHaveLength(2);
        expect(rows[0].label).toBe("10/magic");
    });

    it("uses bypass as label when not in drBypassLabels", () => {
        const rows = mergeDamageReductionRows([
            { value: 15, bypass: "epic", _source: { label: "Epic DR" } }
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0].label).toBe("15/epic");
    });

    it("handles empty bypass as '—'", () => {
        const rows = mergeDamageReductionRows([
            { value: 5, bypass: "", _source: { label: "Universal DR" } }
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0].bypass).toBe("");
        expect(rows[0].label).toBe("5/—");
    });

    it("skips zero or negative values", () => {
        const rows = mergeDamageReductionRows([
            { value: 0, bypass: "magic", _source: { label: "Zero" } },
            { value: -5, bypass: "silver", _source: { label: "Negative" } },
            { value: 10, bypass: "cold iron", _source: { label: "Valid" } }
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0].value).toBe(10);
    });

    it("returns empty array for empty input", () => {
        expect(mergeDamageReductionRows([])).toEqual([]);
    });
});

describe("mergeCapabilityGrantContributions", () => {
    it("merges spellGrant category into spellGrants.rows", () => {
        const merged = mergeCapabilityGrantContributions([
            {
                label: "Magic trick",
                sourceRef: { kind: "item", uuid: "Item.feat1" },
                grants: [
                    {
                        category: "spellGrant",
                        spellUuid: "Compendium.pack.spells.Item.zzz",
                        usesPerDay: 1,
                        atWill: true
                    }
                ]
            }
        ]);
        expect(merged.spellGrants.rows).toHaveLength(1);
        const r = merged.spellGrants.rows[0];
        expect(r.spellUuid).toBe("Compendium.pack.spells.Item.zzz");
        expect(r.atWill).toBe(true);
        expect(r.usesPerDay).toBe(1);
        expect(r.sources[0].label).toBe("Magic trick");
    });

    it("merges string usesPerDay from grants into numeric row", () => {
        const merged = mergeCapabilityGrantContributions([
            {
                label: "Wand",
                grants: [{ category: "spellGrant", spellUuid: "Compendium.pack.spells.Item.w", usesPerDay: "3" }]
            }
        ]);
        expect(merged.spellGrants.rows).toHaveLength(1);
        expect(merged.spellGrants.rows[0].usesPerDay).toBe(3);
    });

    it("Stage B: allVision suppression removes senses from effective rows; union + raw grants kept", () => {
        const merged = mergeCapabilityGrantContributions(
            [
                {
                    label: "Blindness",
                    grants: [{ category: "senseSuppression", scope: "allVision" }]
                },
                {
                    label: "Block",
                    grants: [{ category: "sense", senseType: "darkvision", range: "60" }]
                }
            ],
            { senseTypeLabels: { darkvision: "Darkvision" } }
        );
        expect(merged.senses.rows).toHaveLength(0);
        expect(merged.senses.sensesUnionRows).toHaveLength(1);
        expect(merged.senses.sensesUnionRows[0].senseType).toBe("darkvision");
        expect(merged.senses.suppressed).toHaveLength(1);
        expect(merged.senses.suppressed[0].senseType).toBe("darkvision");
        expect(merged.senses.suppressed[0].suppressingSources.map(s => s.label)).toEqual(["Blindness"]);
        expect(merged.senseSuppressions.grants).toHaveLength(1);
        expect(merged.senseSuppressions.grants[0].scope).toBe("allVision");
    });

    it("merges immunity grants into immunities.rows (Phase 5e)", () => {
        const merged = mergeCapabilityGrantContributions([
            {
                label: "Construct traits",
                grants: [
                    { category: "immunity", tag: "poison" },
                    { category: "immunity", tag: "sleep" },
                    { category: "immunity", tag: "paralysis" }
                ]
            },
            {
                label: "Ring of poison immunity",
                grants: [{ category: "immunity", tag: "poison" }]
            }
        ], { immunityTagLabels: { poison: "Poison", sleep: "Sleep effects", paralysis: "Paralysis" } });
        expect(merged.immunities.rows).toHaveLength(3);
        const poison = merged.immunities.rows.find(r => r.tag === "poison");
        expect(poison).toBeDefined();
        expect(poison?.sources).toHaveLength(2);
        expect(poison?.label).toBe("Poison");
    });

    it("merges energyResistance grants into energyResistance.rows with MAX (Phase 5e)", () => {
        const merged = mergeCapabilityGrantContributions([
            {
                label: "Dragon heritage",
                grants: [{ category: "energyResistance", energyType: "fire", amount: 10 }]
            },
            {
                label: "Greater ring",
                grants: [{ category: "energyResistance", energyType: "fire", amount: 30 }]
            }
        ], { energyTypeLabels: { fire: "Fire" } });
        expect(merged.energyResistance.rows).toHaveLength(1);
        expect(merged.energyResistance.rows[0].energyType).toBe("fire");
        expect(merged.energyResistance.rows[0].amount).toBe(30);
        expect(merged.energyResistance.rows[0].sources).toHaveLength(2);
    });

    it("merges damageReduction grants into damageReduction.rows (Phase 5e)", () => {
        const merged = mergeCapabilityGrantContributions([
            {
                label: "Stoneskin spell",
                grants: [{ category: "damageReduction", value: 10, bypass: "adamantine" }]
            },
            {
                label: "Barbarian DR",
                grants: [{ category: "damageReduction", value: 5, bypass: "" }]
            }
        ]);
        expect(merged.damageReduction.rows).toHaveLength(2);
        const stone = merged.damageReduction.rows.find(r => r.bypass === "adamantine");
        expect(stone?.value).toBe(10);
        const barb = merged.damageReduction.rows.find(r => r.bypass === "");
        expect(barb?.value).toBe(5);
    });

    it("handles mixed grant categories in one contribution", () => {
        const merged = mergeCapabilityGrantContributions([
            {
                label: "Fire elemental",
                grants: [
                    { category: "immunity", tag: "fire" },
                    { category: "energyResistance", energyType: "cold", amount: 0 },
                    { category: "sense", senseType: "darkvision", range: "60 ft" }
                ]
            }
        ]);
        expect(merged.immunities.rows).toHaveLength(1);
        expect(merged.immunities.rows[0].tag).toBe("fire");
        expect(merged.energyResistance.rows).toHaveLength(0);
        expect(merged.senses.rows).toHaveLength(1);
    });
});

describe("applySenseSuppressions", () => {
    it("partial scope only suppresses listed sense types", () => {
        const stageA = mergeSenseRows(
            [
                { senseType: "darkvision", range: "60 ft", _source: { label: "Race" } },
                { senseType: "scent", range: "", _source: { label: "Monster" } }
            ],
            { senseTypeLabels: { darkvision: "Darkvision", scent: "Scent" } }
        );
        const grants = [
            {
                category: "senseSuppression",
                scope: { senseTypes: ["darkvision"] },
                _suppressingSource: { label: "Gloom" }
            }
        ];
        const { effectiveRows, suppressedSenseRows } = applySenseSuppressions(stageA, grants, {
            senseTypeLabels: { darkvision: "Darkvision", scent: "Scent" }
        });
        expect(effectiveRows).toHaveLength(1);
        expect(effectiveRows[0].senseType).toBe("scent");
        expect(suppressedSenseRows).toHaveLength(1);
        expect(suppressedSenseRows[0].senseType).toBe("darkvision");
    });
});

describe("collectCapabilityContributions", () => {
    it("concatenates provider results in registration order", () => {
        const providers = [
            () => [{ label: "A", grants: [{ category: "sense", senseType: "darkvision" }] }],
            () => [{ label: "B", grants: [] }]
        ];
        const out = collectCapabilityContributions({}, providers);
        expect(out.map(c => c.label)).toEqual(["A", "B"]);
        expect(out[0].grants).toHaveLength(1);
    });

    it("accepts { contributions } wrapper shape", () => {
        const providers = [
            () => ({
                contributions: [{ label: "Pack", grants: [{ category: "immunity", tag: "fire" }] }]
            })
        ];
        const out = collectCapabilityContributions({}, providers);
        expect(out).toHaveLength(1);
        expect(out[0].label).toBe("Pack");
        expect(out[0].grants[0].tag).toBe("fire");
    });

    it("continues after a provider throws", () => {
        const warn = vi.fn();
        const providers = [
            () => {
                throw new Error("boom");
            },
            () => [{ label: "OK", grants: [{ category: "sense", senseType: "lowLight" }] }]
        ];
        const out = collectCapabilityContributions({}, providers, { warn });
        expect(out).toHaveLength(1);
        expect(out[0].label).toBe("OK");
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it("skips invalid contribution entries", () => {
        const providers = [
            () => [null, { grants: [] }, { label: "X", grants: [{ category: "featGrant", featUuid: "u1" }] }]
        ];
        const out = collectCapabilityContributions({}, providers);
        expect(out.map(c => c.label)).toEqual(["X"]);
    });
});

describe("getActiveCapabilityGrants", () => {
    let prevConfig;

    beforeEach(() => {
        prevConfig = globalThis.CONFIG;
        globalThis.CONFIG = { THIRDERA: { capabilitySourceProviders: [] } };
    });

    afterEach(() => {
        globalThis.CONFIG = prevConfig;
        vi.restoreAllMocks();
    });

    it("returns stable empty categories for empty actor and no providers", () => {
        const cgs = getActiveCapabilityGrants({});
        expect(cgs.senses.rows).toEqual([]);
        expect(cgs.skillGrants.rows).toEqual([]);
        for (const id of CGS_CAPABILITY_CATEGORY_IDS) {
            expect(cgs).toHaveProperty(id);
        }
    });

    it("uses injected providers and merges sense contributions", () => {
        const cgs = getActiveCapabilityGrants(
            {},
            {
                providers: [
                    () => [{ label: "P", grants: [{ category: "sense", senseType: "darkvision", range: "60" }] }]
                ],
                senseTypeLabels: { darkvision: "Darkvision" }
            }
        );
        expect(cgs.senses.rows).toHaveLength(1);
        expect(cgs.senses.rows[0].senseType).toBe("darkvision");
        expect(cgs.senses.rows[0].sources[0].label).toBe("P");
    });

    it("isolates provider errors when using CONFIG registry", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        CONFIG.THIRDERA.capabilitySourceProviders = [
            () => {
                throw new Error("fail");
            },
            () => [{ label: "Fine", grants: [] }]
        ];
        expect(() => getActiveCapabilityGrants({})).not.toThrow();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});

describe("mergeCapabilityGrantContributions senseSuppression cloning", () => {
    it("does not throw when senseSuppression payload is not structuredCloneable (circular)", () => {
        const g = { category: "senseSuppression", scope: { senseTypes: ["darkvision"] } };
        g.self = g;
        expect(() =>
            mergeCapabilityGrantContributions([{ label: "Cond", grants: [g] }], {
                senseTypeLabels: { darkvision: "Darkvision" },
                allVisionSenseTypeKeys: ["darkvision"]
            })
        ).not.toThrow();
    });
});

describe("registerCapabilitySourceProviders", () => {
    let prevConfig;

    beforeEach(() => {
        prevConfig = globalThis.CONFIG;
    });

    afterEach(() => {
        globalThis.CONFIG = prevConfig;
    });

    it("sets frozen capabilityGrantCategoryIds and ensures provider array", () => {
        globalThis.CONFIG = {
            THIRDERA: {
                capabilitySourceProviders: []
            }
        };
        registerCapabilitySourceProviders();
        expect(CONFIG.THIRDERA.capabilityGrantCategoryIds).toEqual(CGS_CAPABILITY_CATEGORY_IDS);
        expect(Object.isFrozen(CONFIG.THIRDERA.capabilityGrantCategoryIds)).toBe(true);
        expect(Array.isArray(CONFIG.THIRDERA.capabilitySourceProviders)).toBe(true);
    });

    it("no-ops when CONFIG.THIRDERA is missing", () => {
        globalThis.CONFIG = {};
        expect(() => registerCapabilitySourceProviders()).not.toThrow();
    });

    it("replaces non-array capabilitySourceProviders with an empty array", () => {
        globalThis.CONFIG = {
            THIRDERA: {
                capabilitySourceProviders: null
            }
        };
        registerCapabilitySourceProviders();
        expect(CONFIG.THIRDERA.capabilitySourceProviders).toEqual([]);
    });
});
