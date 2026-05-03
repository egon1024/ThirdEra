import { describe, expect, it } from "vitest";
import { describeCgsTemplateLink } from "../../../module/logic/cgs-template-link-display.mjs";

describe("describeCgsTemplateLink", () => {
    it("returns none when no uuids", () => {
        const d = describeCgsTemplateLink({ system: {} }, { fromUuidSync: () => null });
        expect(d).toMatchObject({
            effectiveUuid: "",
            explicitUuid: "",
            sourceIdUuid: "",
            mode: "none",
            conflict: false,
            isResolvable: false
        });
    });

    it("uses explicit template UUID when set", () => {
        const item = {
            system: { cgsTemplateUuid: "  Compendium.x.Item.a  " },
            sourceId: "Compendium.x.Item.b"
        };
        const d = describeCgsTemplateLink(item, {
            fromUuidSync: (u) => (u === "Compendium.x.Item.a" ? { documentName: "Item", system: { cgsGrants: { grants: [], senses: [] } } } : null)
        });
        expect(d.effectiveUuid).toBe("Compendium.x.Item.a");
        expect(d.explicitUuid).toBe("Compendium.x.Item.a");
        expect(d.sourceIdUuid).toBe("Compendium.x.Item.b");
        expect(d.mode).toBe("explicit");
        expect(d.conflict).toBe(true);
        expect(d.isResolvable).toBe(true);
    });

    it("uses sourceId when explicit empty", () => {
        const item = {
            system: {},
            sourceId: "Compendium.thirdera.thirdera_feats.Item.abc123"
        };
        const d = describeCgsTemplateLink(item, {
            fromUuidSync: (u) =>
                u === "Compendium.thirdera.thirdera_feats.Item.abc123"
                    ? { documentName: "Item", system: { cgsGrants: { grants: [{ category: "immunity", tag: "sleep" }], senses: [] } } }
                    : null
        });
        expect(d.effectiveUuid).toBe("Compendium.thirdera.thirdera_feats.Item.abc123");
        expect(d.mode).toBe("sourceId");
        expect(d.conflict).toBe(false);
        expect(d.isResolvable).toBe(true);
    });

    it("reads sourceId from flags.core when top-level missing", () => {
        const item = {
            system: {},
            flags: { core: { sourceId: "Compendium.p.Item.q" } }
        };
        const d = describeCgsTemplateLink(item, {
            fromUuidSync: (u) =>
                u === "Compendium.p.Item.q"
                    ? { documentName: "Item", system: { cgsGrants: { grants: [], senses: [{ type: "darkvision", range: "" }] } } }
                    : null
        });
        expect(d.sourceIdUuid).toBe("Compendium.p.Item.q");
        expect(d.mode).toBe("sourceId");
        expect(d.isResolvable).toBe(true);
    });

    it("marks not resolvable when UUID does not resolve to Item with cgsGrants", () => {
        const item = { system: {}, sourceId: "Compendium.x.Item.z" };
        const d = describeCgsTemplateLink(item, { fromUuidSync: () => null });
        expect(d.effectiveUuid).toBe("Compendium.x.Item.z");
        expect(d.isResolvable).toBe(false);
    });

    it("marks not resolvable when document is not an Item shape", () => {
        const item = { system: { cgsTemplateUuid: "Scene.x.y" } };
        const d = describeCgsTemplateLink(item, {
            fromUuidSync: () => ({ documentName: "Scene", system: {} })
        });
        expect(d.isResolvable).toBe(false);
    });

    it("fromUuidSync throwing yields not resolvable", () => {
        const item = { system: { cgsTemplateUuid: "Compendium.x.Item.bad" } };
        const d = describeCgsTemplateLink(item, {
            fromUuidSync: () => {
                throw new Error("sync fail");
            }
        });
        expect(d.isResolvable).toBe(false);
    });
});
