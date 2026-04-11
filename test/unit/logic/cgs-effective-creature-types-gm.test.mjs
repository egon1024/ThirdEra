import { describe, expect, it, vi } from "vitest";
import {
    CGS_EFFECTIVE_CREATURE_TYPES_GM_HOOK_NAMES,
    buildEffectiveCreatureTypesDisplayText,
    notifyEffectiveCreatureTypesForSelectedTokens,
    registerCgsEffectiveCreatureTypesGmHooks,
} from "../../../module/logic/cgs-effective-creature-types-gm.mjs";

describe("buildEffectiveCreatureTypesDisplayText", () => {
    const deps = {
        fromUuidSync: (uuid) => ({ name: `Name-${uuid}` }),
        localize: (k) =>
            ({
                "THIRDERA.CGS.EffectiveTypesTypesLabel": "Types",
                "THIRDERA.CGS.EffectiveTypesSubtypesLabel": "Subtypes",
                "THIRDERA.CGS.EffectiveTypesEmptyList": "—",
            })[k] ?? k,
    };

    it("lists resolved names for types and subtypes", () => {
        const text = buildEffectiveCreatureTypesDisplayText(
            {
                details: { creatureTypeUuid: "ct-a", subtypeUuids: ["st-b"] },
                cgs: {
                    creatureTypeOverlays: { rows: [{ typeUuid: "ct-c" }] },
                    subtypeOverlays: { rows: [] },
                },
            },
            deps
        );
        expect(text).toContain("Types: Name-ct-a, Name-ct-c");
        expect(text).toContain("Subtypes: Name-st-b");
    });

    it("shows empty placeholder when no uuids", () => {
        const text = buildEffectiveCreatureTypesDisplayText({ details: {}, cgs: {} }, deps);
        expect(text).toBe("Types: —\nSubtypes: —");
    });

    it("falls back to raw uuid when document missing", () => {
        const text = buildEffectiveCreatureTypesDisplayText(
            {
                details: { creatureTypeUuid: "orphan-uuid", subtypeUuids: [] },
                cgs: { creatureTypeOverlays: { rows: [] }, subtypeOverlays: { rows: [] } },
            },
            { ...deps, fromUuidSync: () => null }
        );
        expect(text).toContain("Types: orphan-uuid");
    });
});

describe("registerCgsEffectiveCreatureTypesGmHooks", () => {
    it("registers expected hook names", () => {
        const registered = [];
        const mockHooksOn = vi.fn((name, _fn) => {
            registered.push(name);
        });
        const deps = {
            isGm: () => true,
            fromUuidSync: () => null,
            localize: (k) => k,
            notifyInfo: () => {},
        };
        registerCgsEffectiveCreatureTypesGmHooks(mockHooksOn, deps);
        expect(registered).toEqual([...CGS_EFFECTIVE_CREATURE_TYPES_GM_HOOK_NAMES]);
        expect(mockHooksOn).toHaveBeenCalledTimes(CGS_EFFECTIVE_CREATURE_TYPES_GM_HOOK_NAMES.length);
    });

    it("does not add items when hook runs as non-GM", () => {
        let handler = null;
        const mockHooksOn = vi.fn((_name, fn) => {
            handler = fn;
        });
        registerCgsEffectiveCreatureTypesGmHooks(mockHooksOn, {
            isGm: () => false,
            fromUuidSync: () => null,
            localize: (k) => k,
            notifyInfo: () => {},
        });
        const items = [{ name: "core", icon: "" }];
        handler({}, items);
        expect(items).toHaveLength(1);
    });

    it("pushes a context option that notifies with actor system", () => {
        let handler = null;
        const mockHooksOn = vi.fn((name, fn) => {
            handler = fn;
        });
        const notifyInfo = vi.fn();
        const actor = {
            type: "npc",
            name: "Zombie",
            system: { details: { creatureTypeUuid: "undead-uuid", subtypeUuids: [] }, cgs: {} },
        };
        const app = {
            collection: {
                get: (id) => (id === "aid" ? actor : null),
            },
        };
        registerCgsEffectiveCreatureTypesGmHooks(mockHooksOn, {
            isGm: () => true,
            fromUuidSync: () => ({ name: "Undead" }),
            localize: (key, data) =>
                key === "THIRDERA.CGS.EffectiveTypesTitle"
                    ? `${data.name}: title`
                    : ({
                          "THIRDERA.CGS.EffectiveCreatureTypesContext": "menu",
                          "THIRDERA.CGS.EffectiveTypesTypesLabel": "Types",
                          "THIRDERA.CGS.EffectiveTypesSubtypesLabel": "Subtypes",
                          "THIRDERA.CGS.EffectiveTypesEmptyList": "—",
                      })[key] ?? key,
            notifyInfo,
        });
        expect(handler).toBeTypeOf("function");
        const items = [];
        handler(app, items);
        expect(items).toHaveLength(1);
        expect(items[0].condition({ dataset: { entryId: "aid" } })).toBe(true);
        expect(items[0].condition({ dataset: { entryId: "missing" } })).toBe(false);
        items[0].callback({ dataset: { entryId: "aid" } });
        expect(notifyInfo).toHaveBeenCalledTimes(1);
        const msg = notifyInfo.mock.calls[0][0];
        expect(msg).toContain("Zombie");
        expect(msg).toContain("Undead");
    });
});

describe("notifyEffectiveCreatureTypesForSelectedTokens", () => {
    const makeDeps = (overrides = {}) => ({
        isGm: () => true,
        fromUuidSync: (uuid) => ({ name: `Name-${uuid}` }),
        localize: (key, data) =>
            key === "THIRDERA.CGS.EffectiveTypesTitle"
                ? `${data?.name}: title`
                : ({
                      "THIRDERA.CGS.EffectiveTypesTypesLabel": "Types",
                      "THIRDERA.CGS.EffectiveTypesSubtypesLabel": "Subtypes",
                      "THIRDERA.CGS.EffectiveTypesEmptyList": "—",
                      "THIRDERA.CGS.EffectiveTypesNoTokensSelected": "No tokens selected.",
                  })[key] ?? key,
        notifyInfo: vi.fn(),
        ...overrides
    });

    it("shows 'no tokens selected' when none controlled", () => {
        const deps = makeDeps();
        notifyEffectiveCreatureTypesForSelectedTokens(deps, { getControlledTokens: () => [] });
        expect(deps.notifyInfo).toHaveBeenCalledWith("No tokens selected.");
    });

    it("does nothing for non-GM users", () => {
        const deps = makeDeps({ isGm: () => false });
        notifyEffectiveCreatureTypesForSelectedTokens(deps, {
            getControlledTokens: () => [{ actor: { type: "npc", name: "Z", system: { details: {}, cgs: {} } } }]
        });
        expect(deps.notifyInfo).not.toHaveBeenCalled();
    });

    it("notifies for each controlled NPC/character token", () => {
        const deps = makeDeps();
        const tokens = [
            { actor: { type: "npc", name: "Zombie", system: { details: { creatureTypeUuid: "ct-u" }, cgs: {} } } },
            { actor: { type: "character", name: "Hero", system: { details: {}, cgs: {} } } },
        ];
        notifyEffectiveCreatureTypesForSelectedTokens(deps, { getControlledTokens: () => tokens });
        expect(deps.notifyInfo).toHaveBeenCalledTimes(2);
        expect(deps.notifyInfo.mock.calls[0][0]).toContain("Zombie");
        expect(deps.notifyInfo.mock.calls[1][0]).toContain("Hero");
    });

    it("skips tokens without an actor or with non-character/npc type", () => {
        const deps = makeDeps();
        const tokens = [
            { actor: null },
            { actor: { type: "vehicle", name: "Cart", system: {} } },
            { actor: { type: "npc", name: "Valid", system: { details: {}, cgs: {} } } },
        ];
        notifyEffectiveCreatureTypesForSelectedTokens(deps, { getControlledTokens: () => tokens });
        expect(deps.notifyInfo).toHaveBeenCalledTimes(1);
        expect(deps.notifyInfo.mock.calls[0][0]).toContain("Valid");
    });
});
