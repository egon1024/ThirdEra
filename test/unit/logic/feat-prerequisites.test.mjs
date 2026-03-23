import { describe, expect, it } from "vitest";
import { actorHasFeatByUuid } from "../../../module/logic/feat-prerequisites.mjs";

const featUuid = "Compendium.world.feats.Item.abc123";

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
