import { describe, expect, it } from "vitest";
import {
    FOUNDRY_DEFAULT_TOKEN_DIMENSION,
    TOKEN_DIMENSIONS_BY_SIZE,
    getSizeChangeFromActorUpdateDiff,
    getTokenDimensionsForSize,
    nearlyEqualTokenDimension,
    prototypeDimensionsMatchAutoForSize,
    shouldApplyAutoTokenDimensionsOnCreate,
    shouldApplyAutoTokenDimensionsOnSizeChange
} from "../../../module/logic/token-dimensions-from-size.mjs";

describe("TOKEN_DIMENSIONS_BY_SIZE", () => {
    it("uses fractional squares for Fine, Diminutive, Tiny", () => {
        expect(TOKEN_DIMENSIONS_BY_SIZE.Fine.width).toBe(0.1);
        expect(TOKEN_DIMENSIONS_BY_SIZE.Diminutive.width).toBe(0.2);
        expect(TOKEN_DIMENSIONS_BY_SIZE.Tiny.width).toBe(0.5);
    });

    it("uses 6×6 for Colossal (30 ft on 5 ft grid)", () => {
        expect(TOKEN_DIMENSIONS_BY_SIZE.Colossal).toEqual({ width: 6, height: 6 });
    });
});

describe("getTokenDimensionsForSize", () => {
    it("returns Medium for unknown size", () => {
        expect(getTokenDimensionsForSize("bogus")).toEqual({ width: 1, height: 1 });
        expect(getTokenDimensionsForSize(null)).toEqual({ width: 1, height: 1 });
    });

    it("returns Huge as 3×3", () => {
        expect(getTokenDimensionsForSize("Huge")).toEqual({ width: 3, height: 3 });
    });
});

describe("prototypeDimensionsMatchAutoForSize", () => {
    it("matches within epsilon", () => {
        expect(prototypeDimensionsMatchAutoForSize(0.5 + 1e-7, 0.5, "Tiny")).toBe(true);
    });

    it("rejects mismatch", () => {
        expect(prototypeDimensionsMatchAutoForSize(1, 1, "Large")).toBe(false);
    });
});

describe("shouldApplyAutoTokenDimensionsOnCreate", () => {
    it("applies when prototype is Foundry default 1×1 and size is not 1×1", () => {
        expect(
            shouldApplyAutoTokenDimensionsOnCreate({
                size: "Huge",
                prototypeWidth: FOUNDRY_DEFAULT_TOKEN_DIMENSION,
                prototypeHeight: FOUNDRY_DEFAULT_TOKEN_DIMENSION
            })
        ).toBe(true);
    });

    it("does not apply for Medium 1×1", () => {
        expect(
            shouldApplyAutoTokenDimensionsOnCreate({
                size: "Medium",
                prototypeWidth: 1,
                prototypeHeight: 1
            })
        ).toBe(false);
    });

    it("does not apply when prototype already differs from 1×1", () => {
        expect(
            shouldApplyAutoTokenDimensionsOnCreate({
                size: "Huge",
                prototypeWidth: 2,
                prototypeHeight: 2
            })
        ).toBe(false);
    });
});

describe("shouldApplyAutoTokenDimensionsOnSizeChange", () => {
    it("applies when footprint matches old size auto dims", () => {
        expect(
            shouldApplyAutoTokenDimensionsOnSizeChange({
                oldSize: "Medium",
                newSize: "Large",
                prototypeWidth: 1,
                prototypeHeight: 1
            })
        ).toBe(true);
    });

    it("does not apply when old and new size share same footprint", () => {
        expect(
            shouldApplyAutoTokenDimensionsOnSizeChange({
                oldSize: "Small",
                newSize: "Medium",
                prototypeWidth: 1,
                prototypeHeight: 1
            })
        ).toBe(false);
    });

    it("does not apply when prototype was customized away from old auto", () => {
        expect(
            shouldApplyAutoTokenDimensionsOnSizeChange({
                oldSize: "Large",
                newSize: "Huge",
                prototypeWidth: 1,
                prototypeHeight: 1
            })
        ).toBe(false);
    });

    it("returns false when size unchanged", () => {
        expect(
            shouldApplyAutoTokenDimensionsOnSizeChange({
                oldSize: "Large",
                newSize: "Large",
                prototypeWidth: 2,
                prototypeHeight: 2
            })
        ).toBe(false);
    });
});

describe("getSizeChangeFromActorUpdateDiff", () => {
    it("reads nested system.details.size", () => {
        expect(
            getSizeChangeFromActorUpdateDiff({
                system: { details: { size: "Gargantuan" } }
            })
        ).toBe("Gargantuan");
    });

    it("reads flattened key", () => {
        expect(getSizeChangeFromActorUpdateDiff({ "system.details.size": "Tiny" })).toBe("Tiny");
    });

    it("returns undefined when absent", () => {
        expect(getSizeChangeFromActorUpdateDiff({ system: { attributes: {} } })).toBeUndefined();
        expect(getSizeChangeFromActorUpdateDiff(null)).toBeUndefined();
    });
});

describe("nearlyEqualTokenDimension", () => {
    it("compares floats", () => {
        expect(nearlyEqualTokenDimension(0.2, 0.2 + 1e-8)).toBe(true);
        expect(nearlyEqualTokenDimension(0.2, 0.3)).toBe(false);
    });
});
