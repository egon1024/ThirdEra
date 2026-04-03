import { describe, expect, it } from "vitest";
import { buildCgsOverlayItemLabelMaps } from "../../../module/logic/cgs-overlay-labels.mjs";

describe("buildCgsOverlayItemLabelMaps", () => {
    it("returns empty maps when fromUuidSync is missing", () => {
        const out = buildCgsOverlayItemLabelMaps(
            {
                creatureTypeOverlays: { rows: [{ typeUuid: "a" }] },
                subtypeOverlays: { rows: [{ subtypeUuid: "b" }] }
            },
            { fromUuidSync: undefined }
        );
        expect(out.creatureTypeItemLabels).toEqual({});
        expect(out.subtypeItemLabels).toEqual({});
    });

    it("fills labels from resolved creatureType and subtype items", () => {
        const fromUuidSync = (uuid) => {
            if (uuid === "ct1") return { type: "creatureType", name: "Magical Beast" };
            if (uuid === "st1") return { type: "subtype", name: "Aquatic" };
            return null;
        };
        const out = buildCgsOverlayItemLabelMaps(
            {
                creatureTypeOverlays: { rows: [{ typeUuid: "ct1" }] },
                subtypeOverlays: { rows: [{ subtypeUuid: "st1" }] }
            },
            { fromUuidSync }
        );
        expect(out.creatureTypeItemLabels).toEqual({ ct1: "Magical Beast" });
        expect(out.subtypeItemLabels).toEqual({ st1: "Aquatic" });
    });

    it("ignores wrong document types", () => {
        const fromUuidSync = () => ({ type: "spell", name: "Nope" });
        const out = buildCgsOverlayItemLabelMaps(
            {
                creatureTypeOverlays: { rows: [{ typeUuid: "x" }] },
                subtypeOverlays: { rows: [{ subtypeUuid: "y" }] }
            },
            { fromUuidSync }
        );
        expect(out.creatureTypeItemLabels).toEqual({});
        expect(out.subtypeItemLabels).toEqual({});
    });
});
