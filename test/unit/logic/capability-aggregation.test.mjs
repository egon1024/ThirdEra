import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    applySenseSuppressions,
    CGS_CAPABILITY_CATEGORY_IDS,
    collectCapabilityContributions,
    createEmptyCapabilityGrants,
    formatMergedSenseLabel,
    getActiveCapabilityGrants,
    mergeCapabilityGrantContributions,
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

describe("mergeCapabilityGrantContributions", () => {
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
