import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    getDerivedFrom,
    getDerivedHpConditionId,
    isFlatFootedFromCombat,
    removeDerivedFlatFooted,
    syncDerivedFlatFootedCondition,
    syncDerivedHpCondition,
    syncFlatFootedForCombat
} from "../../../module/logic/derived-conditions.mjs";

describe("getDerivedHpConditionId", () => {
    it("returns null when hp missing or positive", () => {
        expect(getDerivedHpConditionId({})).toBe(null);
        expect(getDerivedHpConditionId({ system: {} })).toBe(null);
        expect(getDerivedHpConditionId({ system: { attributes: { hp: { value: 5 } } } })).toBe(null);
    });

    it("returns disabled at 0 HP", () => {
        expect(
            getDerivedHpConditionId({
                system: { attributes: { hp: { value: 0, stable: false } } }
            })
        ).toBe("disabled");
    });

    it("returns dying when negative and not stable", () => {
        expect(
            getDerivedHpConditionId({
                system: { attributes: { hp: { value: -5, stable: false } } }
            })
        ).toBe("dying");
    });

    it("returns stable when negative and stable", () => {
        expect(
            getDerivedHpConditionId({
                system: { attributes: { hp: { value: -1, stable: true } } }
            })
        ).toBe("stable");
    });

    it("returns dead at -10 or below", () => {
        expect(
            getDerivedHpConditionId({
                system: { attributes: { hp: { value: -10, stable: false } } }
            })
        ).toBe("dead");
        expect(
            getDerivedHpConditionId({
                system: { attributes: { hp: { value: -15, stable: true } } }
            })
        ).toBe("dead");
    });

    it("returns null when hp.value is non-numeric", () => {
        expect(
            getDerivedHpConditionId({
                system: { attributes: { hp: { value: undefined, stable: false } } }
            })
        ).toBe(null);
    });
});

describe("getDerivedFrom", () => {
    it("reads thirdera.derivedFrom flag", () => {
        const effect = {
            getFlag(ns, key) {
                if (ns === "thirdera" && key === "derivedFrom") return "hp";
                return null;
            }
        };
        expect(getDerivedFrom(effect)).toBe("hp");
    });

    it("returns null when flag missing", () => {
        expect(getDerivedFrom({})).toBe(null);
        expect(getDerivedFrom({ getFlag: () => null })).toBe(null);
    });
});

describe("isFlatFootedFromCombat", () => {
    let prevGame;

    beforeEach(() => {
        prevGame = globalThis.game;
    });

    afterEach(() => {
        globalThis.game = prevGame;
    });

    it("returns false when there is no combat or turn is unset", () => {
        globalThis.game = {};
        expect(isFlatFootedFromCombat({ id: "a1" })).toBe(false);
        globalThis.game = { combat: null };
        expect(isFlatFootedFromCombat({ id: "a1" })).toBe(false);
        globalThis.game = { combat: { turn: null, turns: [{ actorId: "a1" }] } };
        expect(isFlatFootedFromCombat({ id: "a1" })).toBe(false);
    });

    it("returns false when actor is not in the turn order", () => {
        globalThis.game = {
            combat: {
                turn: 0,
                turns: [{ actorId: "other" }]
            }
        };
        expect(isFlatFootedFromCombat({ id: "a1" })).toBe(false);
    });

    it("returns true when current turn index is before this actor", () => {
        globalThis.game = {
            combat: {
                turn: 0,
                turns: [{ actorId: "a1" }, { actorId: "a2" }]
            }
        };
        expect(isFlatFootedFromCombat({ id: "a2" })).toBe(true);
        expect(isFlatFootedFromCombat({ id: "a1" })).toBe(false);
    });

    it("uses combat.combatants when turns array is empty", () => {
        globalThis.game = {
            combat: {
                turn: 0,
                turns: [],
                combatants: [{ actor: { id: "first" } }, { actor: { id: "late" } }]
            }
        };
        expect(isFlatFootedFromCombat({ id: "late" })).toBe(true);
        expect(isFlatFootedFromCombat({ id: "first" })).toBe(false);
    });
});

describe("syncDerivedHpCondition", () => {
    let prevGame;
    let prevConfig;

    beforeEach(() => {
        prevGame = globalThis.game;
        prevConfig = globalThis.CONFIG;
        globalThis.CONFIG = {
            statusEffects: [
                { id: "disabled", name: "Disabled", img: "icons/disabled.svg" },
                { id: "dying", name: "Dying", img: "icons/dying.svg" },
                { id: "stable", name: "Stable", img: "icons/stable.svg" },
                { id: "dead", name: "Dead", img: "icons/dead.svg" }
            ],
            THIRDERA: { conditionItemsById: new Map() }
        };
    });

    afterEach(() => {
        globalThis.game = prevGame;
        globalThis.CONFIG = prevConfig;
    });

    it("returns early when actor has no HP object", async () => {
        globalThis.game = {};
        const actor = { system: {} };
        await syncDerivedHpCondition(actor);
        expect(actor).toEqual({ system: {} });
    });

    it("removes HP-derived effect and clears stable when HP is positive", async () => {
        globalThis.game = { actors: { get: vi.fn() } };
        const hpEffect = {
            id: "eff-hp",
            statuses: new Set(["disabled"]),
            getFlag(ns, key) {
                return ns === "thirdera" && key === "derivedFrom" ? "hp" : null;
            }
        };
        const actor = {
            isToken: false,
            id: "a1",
            system: { attributes: { hp: { value: 3, stable: true } } },
            effects: [hpEffect],
            deleteEmbeddedDocuments: vi.fn().mockResolvedValue(undefined),
            update: vi.fn().mockResolvedValue(undefined)
        };
        await syncDerivedHpCondition(actor);
        expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", ["eff-hp"]);
        expect(actor.update).toHaveBeenCalledWith({ "system.attributes.hp.stable": false });
    });

    it("creates HP-derived ActiveEffect when disabled at 0 HP and none exists", async () => {
        globalThis.game = { actors: { get: vi.fn() } };
        const actor = {
            isToken: false,
            id: "a1",
            system: { attributes: { hp: { value: 0, stable: false } } },
            effects: [],
            createEmbeddedDocuments: vi.fn().mockResolvedValue(undefined)
        };
        await syncDerivedHpCondition(actor);
        expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
        const [type, docs] = actor.createEmbeddedDocuments.mock.calls[0];
        expect(type).toBe("ActiveEffect");
        expect(docs[0].statuses).toEqual(["disabled"]);
        expect(docs[0].flags.thirdera.derivedFrom).toBe("hp");
    });

    it("does nothing when existing effect already has the sole correct status", async () => {
        globalThis.game = { actors: { get: vi.fn() } };
        const hpEffect = {
            id: "eff-hp",
            statuses: new Set(["disabled"]),
            getFlag(ns, key) {
                return ns === "thirdera" && key === "derivedFrom" ? "hp" : null;
            }
        };
        const actor = {
            isToken: false,
            system: { attributes: { hp: { value: 0, stable: false } } },
            effects: [hpEffect],
            updateEmbeddedDocuments: vi.fn(),
            createEmbeddedDocuments: vi.fn()
        };
        await syncDerivedHpCondition(actor);
        expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
        expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
    });

    it("updates embedded effect when status should change", async () => {
        globalThis.game = { actors: { get: vi.fn() } };
        const hpEffect = {
            id: "eff-hp",
            statuses: new Set(["dying"]),
            getFlag(ns, key) {
                return ns === "thirdera" && key === "derivedFrom" ? "hp" : null;
            }
        };
        const actor = {
            isToken: false,
            system: { attributes: { hp: { value: 0, stable: false } } },
            effects: [hpEffect],
            updateEmbeddedDocuments: vi.fn().mockResolvedValue(undefined)
        };
        await syncDerivedHpCondition(actor);
        expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", [
            expect.objectContaining({
                _id: "eff-hp",
                statuses: ["disabled"]
            })
        ]);
    });

    it("uses world actor from game.actors when passed a token actor", async () => {
        const worldActor = {
            isToken: false,
            id: "world1",
            system: { attributes: { hp: { value: 0, stable: false } } },
            effects: [],
            createEmbeddedDocuments: vi.fn().mockResolvedValue(undefined)
        };
        const tokenActor = {
            isToken: true,
            id: "world1",
            system: { attributes: { hp: { value: 0, stable: false } } },
            effects: []
        };
        globalThis.game = { actors: { get: vi.fn().mockReturnValue(worldActor) } };
        await syncDerivedHpCondition(tokenActor);
        expect(globalThis.game.actors.get).toHaveBeenCalledWith("world1");
        expect(worldActor.createEmbeddedDocuments).toHaveBeenCalled();
    });
});

describe("syncDerivedFlatFootedCondition and helpers", () => {
    let prevGame;
    let prevConfig;

    beforeEach(() => {
        prevGame = globalThis.game;
        prevConfig = globalThis.CONFIG;
        globalThis.CONFIG = {
            statusEffects: [{ id: "flat-footed", name: "Flat-Footed", img: "icons/flat.svg" }],
            THIRDERA: { conditionItemsById: new Map() }
        };
    });

    afterEach(() => {
        globalThis.game = prevGame;
        globalThis.CONFIG = prevConfig;
    });

    it("syncDerivedFlatFootedCondition removes combat-derived effect when not flat-footed", async () => {
        globalThis.game = {
            combat: { turn: 0, turns: [{ actorId: "a1" }] },
            actors: { get: vi.fn() }
        };
        const combatEffect = {
            id: "eff-ff",
            getFlag(ns, key) {
                return ns === "thirdera" && key === "derivedFrom" ? "combat" : null;
            }
        };
        const actor = {
            isToken: false,
            id: "a1",
            effects: [combatEffect],
            deleteEmbeddedDocuments: vi.fn().mockResolvedValue(undefined)
        };
        await syncDerivedFlatFootedCondition(actor);
        expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", ["eff-ff"]);
    });

    it("syncDerivedFlatFootedCondition creates effect when flat-footed and none exists", async () => {
        globalThis.game = {
            combat: {
                turn: 0,
                turns: [{ actorId: "a1" }, { actorId: "a2" }]
            },
            actors: { get: vi.fn() }
        };
        const actor = {
            isToken: false,
            id: "a2",
            effects: [],
            createEmbeddedDocuments: vi.fn().mockResolvedValue(undefined)
        };
        await syncDerivedFlatFootedCondition(actor);
        expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith(
            "ActiveEffect",
            expect.arrayContaining([
                expect.objectContaining({
                    statuses: ["flat-footed"],
                    flags: { thirdera: { derivedFrom: "combat" } }
                })
            ])
        );
    });

    it("syncFlatFootedForCombat iterates combatants and syncs each actor", async () => {
        const a2 = {
            id: "a2",
            isToken: false,
            effects: [],
            createEmbeddedDocuments: vi.fn().mockResolvedValue(undefined)
        };
        const combatants = {
            size: 2,
            *[Symbol.iterator]() {
                yield { actorId: "a1" };
                yield { actorId: "a2" };
            }
        };
        globalThis.game = {
            combat: { turn: 0, turns: [{ actorId: "a1" }, { actorId: "a2" }], combatants },
            actors: {
                get: vi.fn((id) => (id === "a2" ? a2 : { id, isToken: false, effects: [] }))
            }
        };
        await syncFlatFootedForCombat();
        expect(a2.createEmbeddedDocuments).toHaveBeenCalled();
    });

    it("syncFlatFootedForCombat returns when combatants missing or empty", async () => {
        globalThis.game = { combat: {} };
        await expect(syncFlatFootedForCombat()).resolves.toBeUndefined();
        globalThis.game = { combat: { combatants: { size: 0 } } };
        await expect(syncFlatFootedForCombat()).resolves.toBeUndefined();
    });

    it("removeDerivedFlatFooted deletes combat-derived effect", async () => {
        globalThis.game = { actors: { get: vi.fn() } };
        const combatEffect = {
            id: "c1",
            getFlag(ns, key) {
                return ns === "thirdera" && key === "derivedFrom" ? "combat" : null;
            }
        };
        const actor = {
            isToken: false,
            effects: [combatEffect],
            deleteEmbeddedDocuments: vi.fn().mockResolvedValue(undefined)
        };
        await removeDerivedFlatFooted(actor);
        expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", ["c1"]);
    });

    it("removeDerivedFlatFooted returns when actor missing", async () => {
        globalThis.game = { actors: { get: vi.fn() } };
        await expect(removeDerivedFlatFooted(null)).resolves.toBeUndefined();
    });
});
