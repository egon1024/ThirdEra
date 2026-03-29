import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cgsConditionsCapabilityProvider } from "../../../module/logic/cgs-conditions-capability-provider.mjs";

describe("cgsConditionsCapabilityProvider", () => {
    let prevConfig;
    let prevGame;

    beforeEach(() => {
        prevConfig = globalThis.CONFIG;
        prevGame = globalThis.game;
    });

    afterEach(() => {
        globalThis.CONFIG = prevConfig;
        globalThis.game = prevGame;
    });

    it("returns contributions from active conditions with cgsGrants.grants", () => {
        const grants = [{ category: "senseSuppression", scope: "allVision", label: "Cannot see" }];
        const blindItem = {
            type: "condition",
            name: "Blinded",
            uuid: "Compendium.thirdera.thirdera_conditions.Item.abc",
            system: {
                conditionId: "blinded",
                cgsGrants: { grants }
            }
        };
        globalThis.CONFIG = { THIRDERA: { conditionItemsById: new Map([["blinded", blindItem]]) } };
        globalThis.game = { items: { contents: [] } };

        const actor = {
            effects: [{ statuses: new Set(["blinded"]) }]
        };
        const out = cgsConditionsCapabilityProvider(actor);
        expect(out).toHaveLength(1);
        expect(out[0].label).toBe("Blinded");
        expect(out[0].grants).toEqual(grants);
        expect(out[0].sourceRef?.kind).toBe("conditionItem");
        expect(out[0].sourceRef?.uuid).toBe("Compendium.thirdera.thirdera_conditions.Item.abc");
        expect(out[0].sourceRef?.conditionId).toBe("blinded");
    });

    it("returns empty when condition has no cgs grants", () => {
        const item = {
            name: "Shaken",
            uuid: "Item.x",
            system: { conditionId: "shaken", cgsGrants: { grants: [] } }
        };
        globalThis.CONFIG = { THIRDERA: { conditionItemsById: new Map([["shaken", item]]) } };
        globalThis.game = { items: { contents: [] } };

        const actor = { effects: [{ statuses: new Set(["shaken"]) }] };
        expect(cgsConditionsCapabilityProvider(actor)).toEqual([]);
    });

    it("dedupes the same condition across multiple effects", () => {
        const grants = [{ category: "sense", senseType: "scent", range: "" }];
        const item = {
            name: "Track",
            uuid: "Item.t",
            system: { conditionId: "scent", cgsGrants: { grants } }
        };
        globalThis.CONFIG = { THIRDERA: { conditionItemsById: new Map([["scent", item]]) } };
        globalThis.game = { items: { contents: [] } };

        const actor = {
            effects: [{ statuses: new Set(["scent"]) }, { statuses: new Set(["scent"]) }]
        };
        expect(cgsConditionsCapabilityProvider(actor)).toHaveLength(1);
    });
});
