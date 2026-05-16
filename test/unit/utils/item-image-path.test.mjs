import { describe, expect, it } from "vitest";
import { iconFilenameFromPath, resolveItemImagePath } from "../../../module/utils/item-image-path.mjs";

describe("item-image-path", () => {
    describe("iconFilenameFromPath", () => {
        it("extracts basename without query", () => {
            expect(iconFilenameFromPath("icons/svg/footprint.svg?v=1")).toBe("footprint.svg");
        });
    });

    describe("resolveItemImagePath", () => {
        it("maps missing Track icon to pawprint", () => {
            expect(resolveItemImagePath("icons/svg/footprint.svg")).toBe("icons/svg/pawprint.svg");
        });

        it("leaves valid paths unchanged", () => {
            expect(resolveItemImagePath("icons/svg/sword.svg")).toBe("icons/svg/sword.svg");
        });

        it("maps other known missing icons to shield", () => {
            expect(resolveItemImagePath("icons/svg/wolf.svg")).toBe("icons/svg/shield.svg");
        });
    });
});
