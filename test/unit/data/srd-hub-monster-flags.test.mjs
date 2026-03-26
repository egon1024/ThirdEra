/**
 * Hub augmentation script writes flags.thirdera.srdHubTraits + marked HTML in specialAbilities.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONSTERS_DIR = path.join(__dirname, "../../../packs/monsters");

function load(name) {
    return JSON.parse(fs.readFileSync(path.join(MONSTERS_DIR, name), "utf8"));
}

describe("SRD hub augmentation flags", () => {
    it("demon hub monster has structured traits and marker in specialAbilities", () => {
        const data = load("monster-dretch.json");
        const hub = data.flags?.thirdera?.srdHubTraits;
        expect(hub?.hubPath).toBe("demon.htm");
        expect(hub?.hubTitle).toBe("Demon");
        expect(Array.isArray(hub?.immunities)).toBe(true);
        expect(hub?.immunities.length).toBeGreaterThan(0);
        expect(hub?.energyResistance?.acid).toBe(10);
        expect(hub?.traitFlags?.telepathy).toBe(true);
        const sa = data.system?.statBlock?.specialAbilities ?? "";
        expect(sa).toContain("<!--thirdera-srd-hub-start:demon.htm-->");
        expect(sa).toContain("<!--thirdera-srd-hub-end-->");
    });

    it("devil hub monster has fire immunity in structured list", () => {
        const data = load("monster-barbed-devil-hamatula.json");
        const hub = data.flags?.thirdera?.srdHubTraits;
        expect(hub?.hubPath).toBe("devil.htm");
        expect(hub?.immunities).toContain("fire");
        expect(hub?.immunities).toContain("poison");
    });

    it("every monster with srdHubTraits has valid marker pairing", () => {
        const files = fs.readdirSync(MONSTERS_DIR).filter((f) => f.startsWith("monster-") && f.endsWith(".json"));
        for (const file of files) {
            const data = JSON.parse(fs.readFileSync(path.join(MONSTERS_DIR, file), "utf8"));
            const hub = data.flags?.thirdera?.srdHubTraits;
            if (!hub) continue;
            expect(hub.hubPath, file).toMatch(/\.htm$/);
            expect(typeof hub.hubTitle).toBe("string");
            expect(Array.isArray(hub.traitBullets)).toBe(true);
            expect(hub.traitFlags && typeof hub.traitFlags).toBe("object");
            const sa = data.system?.statBlock?.specialAbilities ?? "";
            const start = `<!--thirdera-srd-hub-start:${hub.hubPath}-->`;
            expect(sa.includes(start), file).toBe(true);
            expect(sa.includes("<!--thirdera-srd-hub-end-->"), file).toBe(true);
        }
    });
});
