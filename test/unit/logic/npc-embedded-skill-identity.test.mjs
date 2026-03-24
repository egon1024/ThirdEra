import { describe, expect, it } from "vitest";
import {
    dedupeNpcEmbeddedSkillItemsForDisplay,
    filterNpcSkillItemDataForCreate,
    npcActorWouldDuplicateSkillEmbed,
    npcEmbeddedSkillIdentity,
    npcEmbeddedSkillIdentitySet
} from "../../../module/logic/npc-embedded-skill-identity.mjs";

describe("npcEmbeddedSkillIdentity", () => {
    it("uses key only for standard skills", () => {
        expect(
            npcEmbeddedSkillIdentity({
                type: "skill",
                name: "Hide",
                system: { key: "hide" }
            })
        ).toBe("hide");
    });

    it("uses key plus name for profession", () => {
        const a = npcEmbeddedSkillIdentity({
            type: "skill",
            name: "Profession (miner)",
            system: { key: "profession" }
        });
        const b = npcEmbeddedSkillIdentity({
            type: "skill",
            name: "Profession (sailor)",
            system: { key: "profession" }
        });
        expect(a).not.toBe(b);
        expect(a).toContain("profession");
        expect(b).toContain("profession");
    });

    it("returns empty for non-skill", () => {
        expect(npcEmbeddedSkillIdentity({ type: "feat", name: "Alertness", system: { key: "alertness" } })).toBe("");
    });
});

describe("dedupeNpcEmbeddedSkillItemsForDisplay", () => {
    it("keeps one Hide when many share key hide", () => {
        const rows = [
            { type: "skill", name: "Hide", system: { key: "hide" }, sort: 103, id: "z" },
            { type: "skill", name: "Hide", system: { key: "hide" }, sort: 101, id: "a" },
            { type: "skill", name: "Hide", system: { key: "hide" }, sort: 102, id: "m" }
        ];
        const out = dedupeNpcEmbeddedSkillItemsForDisplay(rows);
        expect(out).toHaveLength(1);
        expect(out[0].id).toBe("a");
    });

    it("keeps two professions with different names", () => {
        const rows = [
            { type: "skill", name: "Profession (miner)", system: { key: "profession" }, sort: 10 },
            { type: "skill", name: "Profession (sailor)", system: { key: "profession" }, sort: 11 }
        ];
        const out = dedupeNpcEmbeddedSkillItemsForDisplay(rows);
        expect(out).toHaveLength(2);
    });

    it("collapses duplicate profession same name", () => {
        const rows = [
            { type: "skill", name: "Profession (miner)", system: { key: "profession" }, id: "1" },
            { type: "skill", name: "Profession (miner)", system: { key: "profession" }, id: "2" }
        ];
        const out = dedupeNpcEmbeddedSkillItemsForDisplay(rows);
        expect(out).toHaveLength(1);
    });
});

describe("filterNpcSkillItemDataForCreate", () => {
    const existingWithHide = [{ type: "skill", name: "Hide", system: { key: "hide" } }];

    it("keeps first hide when batch repeats same key", () => {
        const batch = [
            { type: "skill", name: "Hide", system: { key: "hide", ranks: 0 } },
            { type: "skill", name: "Hide", system: { key: "hide", ranks: 1 } }
        ];
        const out = filterNpcSkillItemDataForCreate([], batch);
        expect(out).toHaveLength(1);
        expect(out[0].system.ranks).toBe(0);
    });

    it("drops hide when actor already has that skill identity", () => {
        const batch = [{ type: "skill", name: "Hide", system: { key: "hide", ranks: 1 } }];
        expect(filterNpcSkillItemDataForCreate(existingWithHide, batch)).toHaveLength(0);
    });

    it("passes through non-skill items", () => {
        const batch = [{ type: "feat", name: "Alertness", system: { key: "alertness" } }];
        expect(filterNpcSkillItemDataForCreate(existingWithHide, batch)).toEqual(batch);
    });

    it("allows listen after hide", () => {
        const batch = [
            { type: "skill", name: "Listen", system: { key: "listen" } }
        ];
        expect(filterNpcSkillItemDataForCreate(existingWithHide, batch)).toHaveLength(1);
    });
});

describe("npcActorWouldDuplicateSkillEmbed", () => {
    it("detects existing hide", () => {
        const items = [{ type: "skill", name: "Hide", system: { key: "hide" } }];
        expect(
            npcActorWouldDuplicateSkillEmbed(items, {
                type: "skill",
                name: "Hide",
                system: { key: "hide" }
            })
        ).toBe(true);
    });

    it("allows new key", () => {
        const items = [{ type: "skill", name: "Hide", system: { key: "hide" } }];
        expect(
            npcActorWouldDuplicateSkillEmbed(items, {
                type: "skill",
                name: "Listen",
                system: { key: "listen" }
            })
        ).toBe(false);
    });
});

describe("npcEmbeddedSkillIdentitySet", () => {
    it("collects identities from mixed items", () => {
        const set = npcEmbeddedSkillIdentitySet([
            { type: "armor", name: "Leather" },
            { type: "skill", name: "Hide", system: { key: "hide" } }
        ]);
        expect(set.has("hide")).toBe(true);
        expect(set.size).toBe(1);
    });
});
