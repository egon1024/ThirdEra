import { describe, it, expect } from "vitest";
import {
    prepareNpcSkillItems,
    buildModifierOnlySkills,
    getTotalArmorCheckPenaltyFromItems,
    acpBreakdownLabel,
    skillMiscBreakdownLabel,
    resolvedSkillMiscLineLabel
} from "../../../module/logic/npc-skill-prep.mjs";

function mockActor({ abilities, items }) {
    return {
        system: { abilities },
        items
    };
}

describe("getTotalArmorCheckPenaltyFromItems", () => {
    it("sums equipped armor check penalties", () => {
        const actor = mockActor({
            abilities: {},
            items: [
                { type: "armor", system: { equipped: "true", armor: { checkPenalty: -1 } } },
                { type: "armor", system: { equipped: "false", armor: { checkPenalty: -99 } } },
                { type: "weapon", system: {} }
            ]
        });
        expect(getTotalArmorCheckPenaltyFromItems(actor)).toBe(-1);
    });
});

describe("skillMiscBreakdownLabel", () => {
    it("uses custom miscLabel when set", () => {
        expect(skillMiscBreakdownLabel({ miscLabel: "  Large Hide  " }, "Misc")).toBe("Large Hide");
    });
    it("falls back when miscLabel blank", () => {
        expect(skillMiscBreakdownLabel({ miscLabel: "" }, "Misc")).toBe("Misc");
        expect(skillMiscBreakdownLabel({}, "Misc")).toBe("Misc");
    });
});

describe("resolvedSkillMiscLineLabel", () => {
    it("uses explicit miscLabel over i18n fallback", () => {
        expect(resolvedSkillMiscLineLabel({ miscLabel: "Synergy" })).toBe("Synergy");
    });
});

describe("acpBreakdownLabel", () => {
    it("returns Load ACP when load is worse than armor", () => {
        expect(acpBreakdownLabel({ acp: -6 }, -2, -6)).toBe("Load ACP");
    });
    it("returns Armor & Load when equal nonzero", () => {
        expect(acpBreakdownLabel({ acp: -3 }, -3, -3)).toBe("Armor & Load ACP");
    });
});

describe("prepareNpcSkillItems", () => {
    it("computes total with ability, ranks, misc, GMS skill key, and no ACP when skill ignores armor", () => {
        const hideSkill = {
            type: "skill",
            system: {
                key: "hide",
                ability: "dex",
                ranks: 4,
                armorCheckPenalty: "false",
                trainedOnly: "false",
                modifier: { misc: 2, total: 0 }
            }
        };
        const actor = mockActor({
            abilities: { dex: { mod: 3 } },
            items: [hideSkill]
        });
        const mods = {
            totals: { "skill.hide": 4 },
            breakdown: { "skill.hide": [{ label: "Feat", value: 4 }] }
        };
        prepareNpcSkillItems(actor, mods, { acp: 0 });
        expect(hideSkill.system.modifier.total).toBe(3 + 4 + 2 + 0 + 4);
        expect(hideSkill.system.isClassSkill).toBe(true);
        expect(hideSkill.system.maxRanks).toBe(999);
        expect(hideSkill.system.modifier.breakdown_formatted).toContain("Feat");
    });

    it("uses modifier.miscLabel in breakdown instead of generic Misc", () => {
        const skill = {
            type: "skill",
            system: {
                key: "hide",
                ability: "dex",
                ranks: 0,
                armorCheckPenalty: "false",
                npcClassSkill: true,
                modifier: { misc: 8, total: 0, miscLabel: "Large (Hide) + MM" }
            }
        };
        const actor = mockActor({
            abilities: { dex: { mod: -1 } },
            items: [skill]
        });
        prepareNpcSkillItems(actor, { totals: {}, breakdown: {} }, { acp: 0 });
        expect(skill.system.modifier.total).toBe(7);
        const miscLine = skill.system.breakdown.find((b) => b.value === 8);
        expect(miscLine?.label).toBe("Large (Hide) + MM");
        expect(skill.system.modifier.breakdown_formatted).toContain("Large (Hide) + MM");
    });

    it("defaults to class skill when npcClassSkill is omitted (e.g. newly added / compendium skill before first toggle)", () => {
        const skill = {
            type: "skill",
            system: {
                key: "spot",
                ability: "wis",
                ranks: 0,
                armorCheckPenalty: "false",
                modifier: { misc: 0, total: 0 }
            }
        };
        const actor = mockActor({
            abilities: { wis: { mod: 0 } },
            items: [skill]
        });
        prepareNpcSkillItems(actor, { totals: {}, breakdown: {} }, { acp: 0 });
        expect(skill.system.npcClassSkill).toBeUndefined();
        expect(skill.system.isClassSkill).toBe(true);
    });

    it("sets isClassSkill false when npcClassSkill is false", () => {
        const skill = {
            type: "skill",
            system: {
                key: "listen",
                ability: "wis",
                ranks: 2,
                npcClassSkill: false,
                armorCheckPenalty: "false",
                modifier: { misc: 0, total: 0 }
            }
        };
        const actor = mockActor({
            abilities: { wis: { mod: 1 } },
            items: [skill]
        });
        prepareNpcSkillItems(actor, { totals: {}, breakdown: {} }, { acp: 0 });
        expect(skill.system.isClassSkill).toBe(false);
    });

    it("applies ACP when armorCheckPenalty is true", () => {
        const skill = {
            type: "skill",
            system: {
                key: "tumble",
                ability: "dex",
                ranks: 1,
                armorCheckPenalty: "true",
                modifier: { misc: 0, total: 0 }
            }
        };
        const actor = mockActor({
            abilities: { dex: { mod: 2 } },
            items: [
                { type: "armor", system: { equipped: "true", armor: { checkPenalty: -2 } } },
                skill
            ]
        });
        const mods = { totals: {}, breakdown: {} };
        prepareNpcSkillItems(actor, mods, { acp: -3 });
        expect(skill.system.armorPenalty).toBe(-3);
        expect(skill.system.modifier.total).toBe(2 + 1 + 0 - 3);
    });
});

describe("buildModifierOnlySkills", () => {
    it("lists skill.* keys not covered by embedded items", () => {
        const mods = {
            totals: { "skill.hide": 2, "skill.listen": 1 },
            breakdown: { "skill.hide": [{ label: "X", value: 2 }] }
        };
        const items = [{ system: { key: "hide" } }];
        const out = buildModifierOnlySkills(mods, items);
        expect(out).toHaveLength(1);
        expect(out[0].key).toBe("listen");
        expect(out[0].total).toBe(1);
    });
});
