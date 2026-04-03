import { describe, expect, it } from "vitest";
import {
    buildCreatureTypeOverlaySheetRowsFromGrants,
    buildSubtypeOverlaySheetRowsFromGrants
} from "../../../module/logic/cgs-type-overlay-item-sheet.mjs";

describe("cgs-type-overlay-item-sheet", () => {
    it("builds sheet rows with grant indices for overlay categories only", () => {
        const grants = [
            { category: "immunity", tag: "fire" },
            { category: "creatureTypeOverlay", typeUuid: "ct.A" },
            { category: "spellGrant", spellUuid: "s1" },
            { category: "subtypeOverlay", subtypeUuid: "st.B" }
        ];
        expect(buildCreatureTypeOverlaySheetRowsFromGrants(grants)).toEqual([{ grantIndex: 1, typeUuid: "ct.A" }]);
        expect(buildSubtypeOverlaySheetRowsFromGrants(grants)).toEqual([{ grantIndex: 3, subtypeUuid: "st.B" }]);
    });
});
