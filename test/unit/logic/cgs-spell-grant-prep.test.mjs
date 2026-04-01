import { describe, expect, it } from "vitest";
import {
    buildCgsGrantedSpellsByLevelForKnownTab,
    collectOrphanCgsGrantOnlyEmbedItemIds,
    cgsSpellGrantIsSlaStyle,
    findActorSpellItemMatchingGrantUuid,
    findMergedSpellGrantRowForActorSpell,
    formatCgsSpellGrantUsesHint,
    mapCgsSpellGrantReadySpellIdsByClass,
    resolveSpellGrantCastClassItemId
} from "../../../module/logic/cgs-spell-grant-prep.mjs";

describe("findActorSpellItemMatchingGrantUuid", () => {
    it("matches item.uuid", () => {
        const u = "Compendium.thirdera.spells.Item.abc";
        const it = { type: "spell", id: "x", uuid: u, system: {} };
        expect(findActorSpellItemMatchingGrantUuid([it], u)).toBe(it);
    });

    it("matches sourceId when embedded uuid is actor-scoped", () => {
        const comp = "Compendium.thirdera.spells.Item.abc";
        const it = {
            type: "spell",
            id: "embed1",
            uuid: "Actor.aaa.Item.embed1",
            sourceId: comp,
            system: { level: 6 }
        };
        expect(findActorSpellItemMatchingGrantUuid([it], comp)).toBe(it);
    });

    it("matches flags.core.sourceId", () => {
        const comp = "Compendium.x.Item.y";
        const it = {
            type: "spell",
            id: "z",
            uuid: "Actor.a.Item.z",
            flags: { core: { sourceId: comp } },
            system: {}
        };
        expect(findActorSpellItemMatchingGrantUuid([it], comp)).toBe(it);
    });

    it("matches flags.thirdera.sourceSpellUuid from ThirdEraActor.addSpell", () => {
        const comp = "Compendium.thirdera.spells.Item.abc";
        const it = {
            type: "spell",
            id: "embed",
            uuid: "Actor.x.Item.embed",
            flags: { thirdera: { sourceSpellUuid: comp } },
            system: { level: 6 }
        };
        expect(findActorSpellItemMatchingGrantUuid([it], comp)).toBe(it);
    });
});

describe("findMergedSpellGrantRowForActorSpell", () => {
    const comp = "Compendium.pkg.Item.spellA";
    const spellItem = {
        type: "spell",
        id: "emb",
        uuid: "Actor.x.Item.emb",
        flags: { thirdera: { sourceSpellUuid: comp } },
        system: {}
    };

    it("returns merged row when spellUuid matches embedded spell", () => {
        const rows = [{ spellUuid: comp, atWill: true, sources: [] }];
        expect(findMergedSpellGrantRowForActorSpell(spellItem, rows)).toBe(rows[0]);
    });

    it("returns null when no row matches", () => {
        expect(findMergedSpellGrantRowForActorSpell(spellItem, [{ spellUuid: "Compendium.other.Item.x", sources: [] }])).toBe(
            null
        );
    });
});

describe("cgsSpellGrantIsSlaStyle", () => {
    it("is true for at-will", () => {
        expect(cgsSpellGrantIsSlaStyle({ atWill: true })).toBe(true);
    });

    it("is true for uses per day", () => {
        expect(cgsSpellGrantIsSlaStyle({ usesPerDay: 3 })).toBe(true);
    });

    it("is false for grants that only reference a spell without SLA limits", () => {
        expect(cgsSpellGrantIsSlaStyle({ spellUuid: "x", sources: [] })).toBe(false);
    });
});

describe("mapCgsSpellGrantReadySpellIdsByClass", () => {
    it("uses explicit classItemId when set on merged row", () => {
        const spellItems = [{ type: "spell", id: "s1", uuid: "Compendium.spells.Item.a", system: { level: 1 } }];
        const spellcastingByClass = [
            { classItemId: "cWiz", spellListKey: "sorcererWizard", hasSpellcasting: true },
            { classItemId: "cClr", spellListKey: "cleric", hasSpellcasting: true }
        ];
        const map = mapCgsSpellGrantReadySpellIdsByClass(
            [{ spellUuid: "Compendium.spells.Item.a", classItemId: "cClr" }],
            spellItems,
            spellcastingByClass,
            { hasLevelForClass: () => true }
        );
        expect(map.get("cClr")?.has("s1")).toBe(true);
        expect(map.get("cWiz")?.has("s1")).toBe(false);
    });

    it("assigns to first class whose list includes the spell when no classItemId", () => {
        const spellItems = [{ type: "spell", id: "s1", uuid: "U1", system: { level: 0 } }];
        const spellcastingByClass = [
            { classItemId: "cWiz", spellListKey: "sorcererWizard", hasSpellcasting: true },
            { classItemId: "cClr", spellListKey: "cleric", hasSpellcasting: true }
        ];
        const map = mapCgsSpellGrantReadySpellIdsByClass(
            [{ spellUuid: "U1" }],
            spellItems,
            spellcastingByClass,
            {
                hasLevelForClass: (sys, key) => key === "sorcererWizard"
            }
        );
        expect(map.get("cWiz")?.has("s1")).toBe(true);
        expect(map.get("cClr")?.has("s1")).toBe(false);
    });

    it("falls back to first spellcasting class when no list matches", () => {
        const spellItems = [{ type: "spell", id: "s1", uuid: "U1", system: { level: 2 } }];
        const spellcastingByClass = [
            { classItemId: "first", spellListKey: "bard", hasSpellcasting: true },
            { classItemId: "second", spellListKey: "cleric", hasSpellcasting: true }
        ];
        const map = mapCgsSpellGrantReadySpellIdsByClass(
            [{ spellUuid: "U1" }],
            spellItems,
            spellcastingByClass,
            { hasLevelForClass: () => false }
        );
        expect(map.get("first")?.has("s1")).toBe(true);
    });

    it("resolves spell by sourceId when grant spellUuid is compendium doc but item uuid is actor-scoped", () => {
        const compUuid = "Compendium.thirdera.spells.Item.acidFog";
        const spellItems = [
            {
                type: "spell",
                id: "embedded",
                uuid: "Actor.xxx.Item.embedded",
                sourceId: compUuid,
                system: { level: 6 }
            }
        ];
        const spellcastingByClass = [{ classItemId: "cWiz", spellListKey: "sorcererWizard", hasSpellcasting: true }];
        const map = mapCgsSpellGrantReadySpellIdsByClass([{ spellUuid: compUuid }], spellItems, spellcastingByClass, {
            hasLevelForClass: () => true
        });
        expect(map.get("cWiz")?.has("embedded")).toBe(true);
    });
});

describe("resolveSpellGrantCastClassItemId", () => {
    const deps = { hasLevelForClass: (sys, key) => key === "sorcererWizard" };

    it("uses explicit classItemId when valid", () => {
        const spellItem = { system: { level: 1 } };
        const classes = [
            { classItemId: "cWiz", spellListKey: "sorcererWizard", hasSpellcasting: true },
            { classItemId: "cClr", spellListKey: "cleric", hasSpellcasting: true }
        ];
        expect(resolveSpellGrantCastClassItemId({ classItemId: "cClr" }, spellItem, classes, deps)).toBe("cClr");
    });

    it("assigns first class whose list includes the spell when no explicit id", () => {
        const spellItem = { system: { level: 0 } };
        const classes = [
            { classItemId: "cWiz", spellListKey: "sorcererWizard", hasSpellcasting: true },
            { classItemId: "cClr", spellListKey: "cleric", hasSpellcasting: true }
        ];
        expect(resolveSpellGrantCastClassItemId({}, spellItem, classes, deps)).toBe("cWiz");
    });

    it("falls back to first spellcasting class when no list matches", () => {
        const spellItem = { system: { level: 2 } };
        const classes = [
            { classItemId: "first", spellListKey: "bard", hasSpellcasting: true },
            { classItemId: "second", spellListKey: "cleric", hasSpellcasting: true }
        ];
        expect(resolveSpellGrantCastClassItemId({}, spellItem, classes, { hasLevelForClass: () => false })).toBe("first");
    });

    it("falls back to first spellcasting class when spell item is null", () => {
        expect(resolveSpellGrantCastClassItemId({}, null, [{ classItemId: "x", hasSpellcasting: true }], deps)).toBe("x");
    });

    it("returns empty when spell item is null and there are no spellcasting classes", () => {
        expect(resolveSpellGrantCastClassItemId({}, null, [], deps)).toBe("");
    });

    it("uses explicit classItemId before requiring spell.system", () => {
        expect(
            resolveSpellGrantCastClassItemId({ classItemId: "cClr" }, { system: null }, [{ classItemId: "cClr", spellListKey: "cleric", hasSpellcasting: true }], {
                hasLevelForClass: () => false
            })
        ).toBe("cClr");
    });
});

describe("collectOrphanCgsGrantOnlyEmbedItemIds", () => {
    it("returns ids for CGS-only embeds with no matching merged grant row", () => {
        const comp = "Compendium.pack.Item.doc";
        const ids = collectOrphanCgsGrantOnlyEmbedItemIds(
            [
                {
                    type: "spell",
                    id: "orphan1",
                    uuid: "Actor.a.Item.orphan1",
                    sourceId: comp,
                    flags: { thirdera: { embeddedForCgsGrant: true, sourceSpellUuid: comp } }
                }
            ],
            []
        );
        expect(ids).toEqual(["orphan1"]);
    });

    it("omits items without embeddedForCgsGrant flag", () => {
        const comp = "Compendium.pack.Item.doc";
        const ids = collectOrphanCgsGrantOnlyEmbedItemIds(
            [
                {
                    type: "spell",
                    id: "legacy",
                    flags: { thirdera: { sourceSpellUuid: comp } }
                }
            ],
            []
        );
        expect(ids).toEqual([]);
    });

    it("omits items that still match a grant row", () => {
        const comp = "Compendium.pack.Item.doc";
        const ids = collectOrphanCgsGrantOnlyEmbedItemIds(
            [
                {
                    type: "spell",
                    id: "still",
                    uuid: "Actor.a.Item.still",
                    sourceId: comp,
                    flags: { thirdera: { embeddedForCgsGrant: true } }
                }
            ],
            [{ spellUuid: comp }]
        );
        expect(ids).toEqual([]);
    });
});

describe("buildCgsGrantedSpellsByLevelForKnownTab", () => {
    it("groups embedded spells by level", () => {
        const { byLevel, hasAny } = buildCgsGrantedSpellsByLevelForKnownTab(
            [{ spellUuid: "U1" }],
            [{ type: "spell", id: "x", uuid: "U1", name: "Foo", img: "", system: { level: 3, prepared: 0, cast: 0 } }]
        );
        expect(hasAny).toBe(true);
        expect(byLevel["3"]).toHaveLength(1);
        expect(byLevel["3"][0].spellDisplay.name).toBe("Foo");
        expect(byLevel["3"][0].spellDisplay.id).toBe("x");
    });

    it("sets spellDisplay.id when only sourceId matches grant spellUuid", () => {
        const comp = "Compendium.pack.Item.doc";
        const { byLevel, hasAny } = buildCgsGrantedSpellsByLevelForKnownTab(
            [{ spellUuid: comp }],
            [
                {
                    type: "spell",
                    id: "onActor",
                    uuid: "Actor.a.Item.onActor",
                    sourceId: comp,
                    name: "Acid Fog",
                    img: "",
                    system: { level: 6, prepared: 0, cast: 0 }
                }
            ]
        );
        expect(hasAny).toBe(true);
        expect(byLevel["6"]).toHaveLength(1);
        expect(byLevel["6"][0].spellDisplay.id).toBe("onActor");
        expect(byLevel["6"][0].spellDisplay.system.prepared).toBe(0);
    });
});

describe("formatCgsSpellGrantUsesHint", () => {
    it("formats at-will and per-day hints", () => {
        expect(formatCgsSpellGrantUsesHint({ atWill: true }, (k) => (k === "THIRDERA.CGS.SpellGrantAtWill" ? "At will" : k))).toBe(
            "At will"
        );
        expect(
            formatCgsSpellGrantUsesHint({ usesPerDay: 3 }, (k) =>
                k === "THIRDERA.CGS.SpellGrantUsesPerDay" ? "{n}/day" : k
            )
        ).toBe("3/day");
    });
});
