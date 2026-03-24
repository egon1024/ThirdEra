/**
 * Regression: embedded monster actors must not list the same skill twice (same
 * npcEmbeddedSkillIdentity string: key for most skills; profession uses key + name).
 * Duplicates usually come from merge scripts that only strip type === "skill" (exact case)
 * or from appending without stripping.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { npcEmbeddedSkillIdentity } from "../../../module/logic/npc-embedded-skill-identity.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONSTERS_DIR = path.join(__dirname, "../../../packs/monsters");

describe("packs/monsters JSON embedded skills", () => {
    it("has at most one skill item per npcEmbeddedSkillIdentity per file", () => {
        const files = fs.readdirSync(MONSTERS_DIR).filter((f) => f.startsWith("monster-") && f.endsWith(".json"));
        for (const file of files) {
            const data = JSON.parse(fs.readFileSync(path.join(MONSTERS_DIR, file), "utf8"));
            const skills = (data.items ?? []).filter((i) => i.type === "skill");
            const ids = skills.map((s) => npcEmbeddedSkillIdentity(s)).filter(Boolean);
            expect(ids.length, `${file}: duplicate skill identities`).toBe(new Set(ids).size);
        }
    });

    it("has at most one feat item per system.key per file", () => {
        const files = fs.readdirSync(MONSTERS_DIR).filter((f) => f.startsWith("monster-") && f.endsWith(".json"));
        for (const file of files) {
            const data = JSON.parse(fs.readFileSync(path.join(MONSTERS_DIR, file), "utf8"));
            const feats = (data.items ?? []).filter((i) => i.type === "feat");
            const keys = feats.map((f) => String(f.system?.key ?? "").trim().toLowerCase()).filter(Boolean);
            expect(keys.length, `${file}: duplicate feat keys`).toBe(new Set(keys).size);
        }
    });
});
