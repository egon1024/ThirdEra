import { describe, expect, it } from "vitest";
import { getSpellPenetrationCastFlags } from "../../../module/logic/spell-sr-from-chat-helpers.mjs";

describe("getSpellPenetrationCastFlags", () => {
    it("returns null for missing or disallowed spellCast", () => {
        expect(getSpellPenetrationCastFlags(null)).toBeNull();
        expect(getSpellPenetrationCastFlags(undefined)).toBeNull();
        expect(getSpellPenetrationCastFlags({ srKey: "no" })).toBeNull();
        expect(getSpellPenetrationCastFlags({ srKey: "" })).toBeNull();
    });

    it("returns null when casterLevel is not a finite number", () => {
        expect(
            getSpellPenetrationCastFlags({
                srKey: "yes",
                casterLevel: "5"
            })
        ).toBeNull();
        expect(
            getSpellPenetrationCastFlags({
                srKey: "yes-harmless",
                casterLevel: NaN
            })
        ).toBeNull();
    });

    it("accepts yes and yes-harmless srKey", () => {
        const a = getSpellPenetrationCastFlags({
            srKey: "yes",
            casterLevel: 7,
            spellName: "Ray",
            targetActorUuids: ["Actor.x"]
        });
        expect(a).toEqual({
            casterLevel: 7,
            spellName: "Ray",
            targetActorUuids: ["Actor.x"]
        });
        const b = getSpellPenetrationCastFlags({
            srKey: "yes-harmless",
            casterLevel: 0,
            targetActorUuids: "bad"
        });
        expect(b).toEqual({
            casterLevel: 0,
            spellName: "",
            targetActorUuids: []
        });
    });

    it("normalizes spellName and target list", () => {
        expect(
            getSpellPenetrationCastFlags({
                srKey: "yes",
                casterLevel: 12
            })
        ).toEqual({
            casterLevel: 12,
            spellName: "",
            targetActorUuids: []
        });
    });
});
