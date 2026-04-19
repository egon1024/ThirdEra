import { describe, expect, it } from "vitest";
import {
    buildSystemUpdatePatchFromCgsOverrideSnapshot,
    snapshotCgsTemplateOverrideFieldsFromItem
} from "../../../module/logic/cgs-embed-override-sync-preservation.mjs";

describe("snapshotCgsTemplateOverrideFieldsFromItem", () => {
    it("captures only declared keys", () => {
        const snap = snapshotCgsTemplateOverrideFieldsFromItem({
            system: { cgsGrantOverrides: { grants: [], senses: [{ type: "darkvision", range: "5 ft" }] } }
        });
        expect(snap.cgsGrantOverrides?.senses).toHaveLength(1);
        expect("cgsTemplateUuid" in snap).toBe(false);
    });
});

describe("buildSystemUpdatePatchFromCgsOverrideSnapshot", () => {
    it("round-trips template uuid", () => {
        const p = buildSystemUpdatePatchFromCgsOverrideSnapshot({ cgsTemplateUuid: "Compendium.x.Item.y" });
        expect(p.cgsTemplateUuid).toBe("Compendium.x.Item.y");
    });
});
