import { describe, expect, it } from "vitest";
import {
    FEATS_COMPENDIUM_COLLECTION_SEGMENT,
    isFeatLinkedToBundledFeatsCompendium
} from "../../../module/logic/feat-embed-display.mjs";

describe("feat-embed-display", () => {
    it("exports stable compendium path segment", () => {
        expect(FEATS_COMPENDIUM_COLLECTION_SEGMENT).toBe(".thirdera_feats.");
    });

    it("returns true for Compendium feats pack sourceId", () => {
        expect(
            isFeatLinkedToBundledFeatsCompendium({
                type: "feat",
                sourceId: "Compendium.thirdera.thirdera_feats.Item.abcdefghij123456"
            })
        ).toBe(true);
    });

    it("returns false without feats pack segment", () => {
        expect(
            isFeatLinkedToBundledFeatsCompendium({
                type: "feat",
                sourceId: "Compendium.thirdera.thirdera_spells.Item.abcdefghij123456"
            })
        ).toBe(false);
    });

    it("returns false for world Item UUID", () => {
        expect(
            isFeatLinkedToBundledFeatsCompendium({
                type: "feat",
                sourceId: "Item.abcdefghij123456"
            })
        ).toBe(false);
    });

    it("returns false when sourceId missing", () => {
        expect(isFeatLinkedToBundledFeatsCompendium({ type: "feat" })).toBe(false);
    });

    it("returns false for non-feat", () => {
        expect(
            isFeatLinkedToBundledFeatsCompendium({
                type: "spell",
                sourceId: "Compendium.thirdera.thirdera_feats.Item.abcdefghij123456"
            })
        ).toBe(false);
    });
});
