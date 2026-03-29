import { describe, expect, it } from "vitest";
import {
    enrichCgsMergedSenseRowsForProvenance,
    enrichCgsSuppressedSenseRowsForProvenance,
    extractCgsSourceLinkUuid,
    planCgsSourceDisplay
} from "../../../module/logic/cgs-provenance-display.mjs";

describe("extractCgsSourceLinkUuid", () => {
    it("returns trimmed uuid string or null", () => {
        expect(extractCgsSourceLinkUuid({ uuid: "  Actor.x.Item.y  " })).toBe("Actor.x.Item.y");
        expect(extractCgsSourceLinkUuid({})).toBe(null);
        expect(extractCgsSourceLinkUuid(undefined)).toBe(null);
        expect(extractCgsSourceLinkUuid({ uuid: "   " })).toBe(null);
    });
});

describe("planCgsSourceDisplay", () => {
    const observerUser = {};

    it("GM always sees label and keeps link uuid when present", () => {
        const plan = planCgsSourceDisplay(
            { label: "Feat", sourceRef: { kind: "item", uuid: "Item.abc" } },
            {
                isGM: true,
                user: observerUser,
                sheetActor: { uuid: "Actor.1", testUserPermission: () => true },
                resolveUuid: () => null
            }
        );
        expect(plan).toEqual({ showLabel: true, linkUuid: "Item.abc", useLabel: "Feat" });
    });

    it("statBlock is visible to non-GM without document resolution", () => {
        const plan = planCgsSourceDisplay(
            { label: "Stat block", sourceRef: { kind: "statBlock" } },
            {
                isGM: false,
                user: observerUser,
                sheetActor: { uuid: "Actor.1", testUserPermission: () => true },
                resolveUuid: () => null
            }
        );
        expect(plan.showLabel).toBe(true);
        expect(plan.linkUuid).toBe(null);
        expect(plan.useLabel).toBe("Stat block");
    });

    it("actorCgsGrants is visible when user may observe the sheet actor", () => {
        const plan = planCgsSourceDisplay(
            { label: "CGS Mechanics", sourceRef: { kind: "actorCgsGrants", uuid: "Actor.1" } },
            {
                isGM: false,
                user: observerUser,
                sheetActor: { uuid: "Actor.1", testUserPermission: () => true },
                resolveUuid: () => null
            }
        );
        expect(plan).toEqual({ showLabel: true, linkUuid: "Actor.1", useLabel: "CGS Mechanics" });
    });

    it("actorCgsGrants hides when user cannot observe the sheet actor", () => {
        const plan = planCgsSourceDisplay(
            { label: "CGS Mechanics", sourceRef: { kind: "actorCgsGrants", uuid: "Actor.1" } },
            {
                isGM: false,
                user: observerUser,
                sheetActor: { uuid: "Actor.1", testUserPermission: () => false },
                resolveUuid: () => null
            }
        );
        expect(plan.showLabel).toBe(false);
    });

    it("uuid-backed source hides for non-GM when document missing or not observable", () => {
        const hidden = planCgsSourceDisplay(
            { label: "Secret item", sourceRef: { kind: "item", uuid: "Item.hidden" } },
            {
                isGM: false,
                user: observerUser,
                sheetActor: { uuid: "Actor.1", testUserPermission: () => true },
                resolveUuid: () => null
            }
        );
        expect(hidden.showLabel).toBe(false);

        const noPerm = planCgsSourceDisplay(
            { label: "Secret item", sourceRef: { kind: "item", uuid: "Item.hidden" } },
            {
                isGM: false,
                user: observerUser,
                sheetActor: { uuid: "Actor.1", testUserPermission: () => true },
                resolveUuid: () => ({ testUserPermission: () => false, name: "X" })
            }
        );
        expect(noPerm.showLabel).toBe(false);

        const ok = planCgsSourceDisplay(
            { label: "Secret item", sourceRef: { kind: "item", uuid: "Item.ok" } },
            {
                isGM: false,
                user: observerUser,
                sheetActor: { uuid: "Actor.1", testUserPermission: () => true },
                resolveUuid: () => ({ testUserPermission: (u, lvl) => u === observerUser && lvl === "OBSERVER", name: "Ok" })
            }
        );
        expect(ok.showLabel).toBe(true);
        expect(ok.linkUuid).toBe("Item.ok");
        expect(ok.useLabel).toBe("Secret item");
    });

    it("uses document name when label empty and user may observe", () => {
        const plan = planCgsSourceDisplay(
            { label: "", sourceRef: { kind: "item", uuid: "Item.x" } },
            {
                isGM: false,
                user: observerUser,
                sheetActor: { uuid: "Actor.1", testUserPermission: () => true },
                resolveUuid: () => ({
                    testUserPermission: () => true,
                    name: "Resolved name"
                })
            }
        );
        expect(plan.useLabel).toBe("Resolved name");
    });

    it("non-GM without sourceRef shows label only", () => {
        const plan = planCgsSourceDisplay(
            { label: "Bundle label" },
            {
                isGM: false,
                user: observerUser,
                sheetActor: { uuid: "Actor.1", testUserPermission: () => true },
                resolveUuid: () => null
            }
        );
        expect(plan).toEqual({ showLabel: true, linkUuid: null, useLabel: "Bundle label" });
    });

    it("non-GM item ref without uuid shows label without link", () => {
        const plan = planCgsSourceDisplay(
            { label: "Orphan", sourceRef: { kind: "item" } },
            {
                isGM: false,
                user: observerUser,
                sheetActor: { uuid: "Actor.1", testUserPermission: () => true },
                resolveUuid: () => null
            }
        );
        expect(plan.showLabel).toBe(true);
        expect(plan.linkUuid).toBe(null);
        expect(plan.useLabel).toBe("Orphan");
    });
});

describe("enrichCgsMergedSenseRowsForProvenance", () => {
    it("maps merged sense rows to plans per source", () => {
        const rows = [
            {
                label: "Darkvision 60 ft.",
                sources: [
                    { label: "Stat block", sourceRef: { kind: "statBlock" } },
                    { label: "Race", sourceRef: { kind: "item", uuid: "Item.race" } }
                ]
            }
        ];
        const mockDoc = { testUserPermission: () => true, name: "Elf" };
        const out = enrichCgsMergedSenseRowsForProvenance(rows, {
            isGM: false,
            user: {},
            sheetActor: { uuid: "Actor.1", testUserPermission: () => true },
            resolveUuid: (u) => (u === "Item.race" ? mockDoc : null)
        });
        expect(out).toHaveLength(1);
        expect(out[0].senseLabel).toBe("Darkvision 60 ft.");
        expect(out[0].sources).toHaveLength(2);
        expect(out[0].sources[0].showLabel).toBe(true);
        expect(out[0].sources[1].linkUuid).toBe("Item.race");
    });
});

describe("enrichCgsSuppressedSenseRowsForProvenance", () => {
    it("plans sense and suppressing sources", () => {
        const rows = [
            {
                senseLabel: "Darkvision 60 ft.",
                sources: [{ label: "Stat block", sourceRef: { kind: "statBlock" } }],
                suppressingSources: [{ label: "Blinded", sourceRef: { kind: "conditionItem", uuid: "Item.blind" } }]
            }
        ];
        const out = enrichCgsSuppressedSenseRowsForProvenance(rows, {
            isGM: true,
            user: {},
            sheetActor: { uuid: "Actor.1", testUserPermission: () => true },
            resolveUuid: () => null
        });
        expect(out).toHaveLength(1);
        expect(out[0].senseLabel).toBe("Darkvision 60 ft.");
        expect(out[0].senseSources[0].showLabel).toBe(true);
        expect(out[0].suppressingSources[0].linkUuid).toBe("Item.blind");
    });
});
