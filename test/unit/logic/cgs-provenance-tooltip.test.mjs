import { describe, expect, it } from "vitest";
import {
    formatCgsProvenanceLinkTooltip,
    resolveThirdEraActorTypeDisplayName,
    resolveThirdEraItemTypeDisplayName
} from "../../../module/logic/cgs-provenance-tooltip.mjs";

describe("resolveThirdEraItemTypeDisplayName", () => {
    it("uses localized string when key resolves", () => {
        expect(
            resolveThirdEraItemTypeDisplayName("feat", {
                localize: () => "Feat",
                itemTypeLabels: { feat: "THIRDERA.TYPES.Item.feat" }
            })
        ).toBe("Feat");
    });

    it("uses English fallback when localize returns the key unchanged", () => {
        const echo = (k) => k;
        expect(
            resolveThirdEraItemTypeDisplayName("feat", {
                localize: echo,
                itemTypeLabels: { feat: "THIRDERA.TYPES.Item.feat" }
            })
        ).toBe("Feat");
        expect(
            resolveThirdEraItemTypeDisplayName("skill", {
                localize: echo,
                itemTypeLabels: { skill: "THIRDERA.TYPES.Item.skill" }
            })
        ).toBe("Skill");
    });
});

describe("resolveThirdEraActorTypeDisplayName", () => {
    it("falls back when localize echoes key", () => {
        const echo = (k) => k;
        expect(resolveThirdEraActorTypeDisplayName("character", echo)).toBe("Character");
        expect(resolveThirdEraActorTypeDisplayName("npc", echo)).toBe("NPC");
    });
});

describe("formatCgsProvenanceLinkTooltip", () => {
    const localize = (k) =>
        ({
            "THIRDERA.CGS.ProvenanceUnknownSource": "Unknown source",
            "THIRDERA.TYPES.Item.feat": "Feat",
            "THIRDERA.TYPES.Item.armor": "Armor",
            "DOCUMENT.Actor": "Actor",
            "DOCUMENT.Item": "Item"
        })[k] ?? k;

    it("formats Item as type label plus display name", () => {
        const doc = { documentName: "Item", type: "feat", name: "Power Attack" };
        expect(
            formatCgsProvenanceLinkTooltip(doc, "Power Attack", {
                localize,
                itemTypeLabels: { feat: "THIRDERA.TYPES.Item.feat" }
            })
        ).toBe("Feat: Power Attack");
    });

    it("prefers displayName over doc.name", () => {
        const doc = { documentName: "Item", type: "armor", name: "Old" };
        expect(
            formatCgsProvenanceLinkTooltip(doc, "Full plate", {
                localize,
                itemTypeLabels: { armor: "THIRDERA.TYPES.Item.armor" }
            })
        ).toBe("Armor: Full plate");
    });

    it("uses English fallback when i18n echoes the type key", () => {
        const echo = (k) => k;
        const doc = { documentName: "Item", type: "feat", name: "X" };
        expect(
            formatCgsProvenanceLinkTooltip(doc, "X", {
                localize: echo,
                itemTypeLabels: { feat: "THIRDERA.TYPES.Item.feat" }
            })
        ).toBe("Feat: X");
    });

    it("uses DOCUMENT.* plus name for non-Item documents", () => {
        const doc = { documentName: "Actor", name: "Hero" };
        expect(
            formatCgsProvenanceLinkTooltip(doc, "Capability grants", {
                localize,
                itemTypeLabels: {}
            })
        ).toBe("Actor: Capability grants");
    });

    it("uses Actor subtype label when document is Actor with type", () => {
        const doc = { documentName: "Actor", type: "character", name: "Bob" };
        expect(
            formatCgsProvenanceLinkTooltip(doc, "Sheet", {
                localize: (k) =>
                    k === "THIRDERA.TYPES.Actor.character" ? "Character" : k === "THIRDERA.CGS.ProvenanceUnknownSource" ? "Unknown source" : k,
                itemTypeLabels: {}
            })
        ).toBe("Character: Sheet");
    });

    it("returns unknown when doc missing and no display name", () => {
        expect(
            formatCgsProvenanceLinkTooltip(null, "", {
                localize,
                itemTypeLabels: {}
            })
        ).toBe("Unknown source");
    });

    it("uses plain unknown when ProvenanceUnknownSource key is missing", () => {
        expect(
            formatCgsProvenanceLinkTooltip(null, "", {
                localize: (k) => k,
                itemTypeLabels: {}
            })
        ).toBe("Unknown source");
    });
});
