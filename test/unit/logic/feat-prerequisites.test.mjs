import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    actorHasFeatByUuid,
    meetsFeatPrerequisites
} from "../../../module/logic/feat-prerequisites.mjs";

const featUuid = "Compendium.world.feats.Item.abc123";

describe("meetsFeatPrerequisites", () => {
    let prevConfig;
    let fromUuid;

    beforeEach(() => {
        prevConfig = globalThis.CONFIG;
        globalThis.CONFIG = {
            THIRDERA: {
                AbilityScores: { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" }
            }
        };
        fromUuid = vi.fn();
        globalThis.foundry = { utils: { fromUuid } };
        globalThis.game = {
            i18n: {
                format: (key, data) => `[${key}]${JSON.stringify(data)}`,
                localize: (key) => key
            }
        };
    });

    afterEach(() => {
        globalThis.CONFIG = prevConfig;
        delete globalThis.foundry;
        delete globalThis.game;
        vi.restoreAllMocks();
    });

    it("returns met when there are no structured prerequisites", async () => {
        const actor = { system: { combat: { bab: 0 }, abilities: { str: { value: 8 } } } };
        const r = await meetsFeatPrerequisites(actor, { system: {} });
        expect(r.met).toBe(true);
        expect(r.reasons).toEqual([]);
    });

    it("fails BAB when actor BAB is below prerequisite", async () => {
        const actor = { system: { combat: { bab: 3 }, abilities: {} } };
        const r = await meetsFeatPrerequisites(actor, {
            system: { prerequisiteBAB: 5 }
        });
        expect(r.met).toBe(false);
        expect(r.reasons.some((x) => x.includes("RequiresBAB"))).toBe(true);
    });

    it("ignores non-positive BAB requirement", async () => {
        const actor = { system: { combat: { bab: 0 }, abilities: {} } };
        const r = await meetsFeatPrerequisites(actor, {
            system: { prerequisiteBAB: -2 }
        });
        expect(r.met).toBe(true);
    });

    it("uses effective ability score when present", async () => {
        const actor = {
            system: {
                combat: { bab: 0 },
                abilities: { str: { effective: 12, value: 8 } }
            }
        };
        const r = await meetsFeatPrerequisites(actor, {
            system: { prerequisiteAbilityScores: { str: 13 } }
        });
        expect(r.met).toBe(false);
        expect(r.reasons.some((x) => x.includes("RequiresAbility"))).toBe(true);
    });

    it("passes ability gate when score meets minimum", async () => {
        const actor = {
            system: {
                combat: { bab: 0 },
                abilities: { dex: { value: 14 } }
            }
        };
        const r = await meetsFeatPrerequisites(actor, {
            system: { prerequisiteAbilityScores: { dex: 14 } }
        });
        expect(r.met).toBe(true);
    });

    it("skips ability entries with non-positive minimum", async () => {
        const actor = {
            system: {
                combat: { bab: 0 },
                abilities: { str: { value: 3 } }
            }
        };
        const r = await meetsFeatPrerequisites(actor, {
            system: { prerequisiteAbilityScores: { str: 0 } }
        });
        expect(r.met).toBe(true);
    });

    it("adds missing-feat reason when UUID resolves but actor lacks feat", async () => {
        fromUuid.mockResolvedValue({ name: "Dodge" });
        const actor = { items: [], system: { combat: { bab: 10 }, abilities: {} } };
        const r = await meetsFeatPrerequisites(actor, {
            system: { prerequisiteFeatUuids: [featUuid] }
        });
        expect(r.met).toBe(false);
        expect(fromUuid).toHaveBeenCalledWith(featUuid);
        expect(r.reasons.some((x) => x.includes("RequiresFeatMissing"))).toBe(true);
    });

    it("is met when prerequisite feat UUID is satisfied", async () => {
        fromUuid.mockResolvedValue({ name: "Dodge" });
        const actor = {
            items: [
                {
                    type: "feat",
                    flags: { core: { sourceId: featUuid } }
                }
            ],
            system: { combat: { bab: 10 }, abilities: {} }
        };
        const r = await meetsFeatPrerequisites(actor, {
            system: { prerequisiteFeatUuids: [featUuid] }
        });
        expect(r.met).toBe(true);
        expect(r.reasons).toEqual([]);
    });

    it("adds unknown-feat reason when fromUuid returns null", async () => {
        fromUuid.mockResolvedValue(null);
        const actor = { items: [], system: { combat: { bab: 10 }, abilities: {} } };
        const r = await meetsFeatPrerequisites(actor, {
            system: { prerequisiteFeatUuids: ["Compendium.missing.Item.x"] }
        });
        expect(r.met).toBe(false);
        expect(r.reasons.some((x) => x.includes("RequiresFeatUnknown"))).toBe(true);
    });

    it("adds unknown-feat reason when fromUuid throws", async () => {
        fromUuid.mockRejectedValue(new Error("no access"));
        const actor = { items: [], system: { combat: { bab: 10 }, abilities: {} } };
        const r = await meetsFeatPrerequisites(actor, {
            system: { prerequisiteFeatUuids: ["Compendium.x.Item.y"] }
        });
        expect(r.met).toBe(false);
        expect(r.reasons.some((x) => x.includes("RequiresFeatUnknown"))).toBe(true);
    });
});

describe("actorHasFeatByUuid", () => {
    it("returns false for missing inputs", () => {
        expect(actorHasFeatByUuid(null, featUuid)).toBe(false);
        expect(actorHasFeatByUuid({ items: [] }, "")).toBe(false);
        expect(actorHasFeatByUuid({ items: [] }, "   ")).toBe(false);
    });

    it("matches flags.core.sourceId", () => {
        const actor = {
            items: [
                {
                    type: "feat",
                    flags: { core: { sourceId: featUuid } }
                }
            ]
        };
        expect(actorHasFeatByUuid(actor, featUuid)).toBe(true);
    });

    it("matches flags.thirdera.sourceFeatUuid", () => {
        const actor = {
            items: [
                {
                    type: "feat",
                    flags: { thirdera: { sourceFeatUuid: featUuid } }
                }
            ]
        };
        expect(actorHasFeatByUuid(actor, featUuid)).toBe(true);
    });

    it("ignores non-feat items", () => {
        const actor = {
            items: [
                { type: "spell", flags: { core: { sourceId: featUuid } } }
            ]
        };
        expect(actorHasFeatByUuid(actor, featUuid)).toBe(false);
    });

    it("requires exact UUID string match on trimmed feat", () => {
        const actor = {
            items: [
                {
                    type: "feat",
                    flags: { core: { sourceId: `${featUuid} ` } }
                }
            ]
        };
        expect(actorHasFeatByUuid(actor, featUuid)).toBe(false);
    });
});
