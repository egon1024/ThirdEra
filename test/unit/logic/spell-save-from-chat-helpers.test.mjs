import { describe, expect, it } from "vitest";
import { getSpellCastDataFromMessage } from "../../../module/logic/spell-save-from-chat-helpers.mjs";

describe("getSpellCastDataFromMessage", () => {
    it("returns null for null/undefined message", () => {
        expect(getSpellCastDataFromMessage(null)).toBeNull();
        expect(getSpellCastDataFromMessage(undefined)).toBeNull();
    });

    it("returns null when flags or spellCast missing", () => {
        expect(getSpellCastDataFromMessage({})).toBeNull();
        expect(getSpellCastDataFromMessage({ flags: {} })).toBeNull();
        expect(getSpellCastDataFromMessage({ flags: { thirdera: {} } })).toBeNull();
    });

    it("returns null when saveType is null or undefined", () => {
        expect(
            getSpellCastDataFromMessage({
                flags: { thirdera: { spellCast: { dc: 15, saveType: null } } }
            })
        ).toBeNull();
        expect(
            getSpellCastDataFromMessage({
                flags: { thirdera: { spellCast: { dc: 15 } } }
            })
        ).toBeNull();
    });

    it("returns null when dc is missing, non-numeric, or non-finite", () => {
        expect(
            getSpellCastDataFromMessage({
                flags: { thirdera: { spellCast: { saveType: "fort" } } }
            })
        ).toBeNull();
        expect(
            getSpellCastDataFromMessage({
                flags: { thirdera: { spellCast: { saveType: "fort", dc: "15" } } }
            })
        ).toBeNull();
        expect(
            getSpellCastDataFromMessage({
                flags: { thirdera: { spellCast: { saveType: "fort", dc: NaN } } }
            })
        ).toBeNull();
        expect(
            getSpellCastDataFromMessage({
                flags: { thirdera: { spellCast: { saveType: "fort", dc: Infinity } } }
            })
        ).toBeNull();
    });

    it("returns payload with empty spellName and empty target list when omitted", () => {
        expect(
            getSpellCastDataFromMessage({
                flags: { thirdera: { spellCast: { saveType: "will", dc: 18 } } }
            })
        ).toEqual({
            dc: 18,
            saveType: "will",
            spellName: "",
            targetActorUuids: []
        });
    });

    it("normalizes targetActorUuids to [] when not an array", () => {
        expect(
            getSpellCastDataFromMessage({
                flags: {
                    thirdera: {
                        spellCast: {
                            saveType: "ref",
                            dc: 16,
                            spellName: "Fireball",
                            targetActorUuids: "not-an-array"
                        }
                    }
                }
            })
        ).toEqual({
            dc: 16,
            saveType: "ref",
            spellName: "Fireball",
            targetActorUuids: []
        });
    });

    it("preserves targetActorUuids when array", () => {
        const uuids = ["Actor.a", "Actor.b"];
        expect(
            getSpellCastDataFromMessage({
                flags: {
                    thirdera: {
                        spellCast: {
                            saveType: "fort",
                            dc: 14,
                            spellName: "Hold Person",
                            targetActorUuids: uuids
                        }
                    }
                }
            })
        ).toEqual({
            dc: 14,
            saveType: "fort",
            spellName: "Hold Person",
            targetActorUuids: uuids
        });
    });
});
