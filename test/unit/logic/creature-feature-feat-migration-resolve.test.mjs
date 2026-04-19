import path from "path";
import { describe, expect, it } from "vitest";
import { resolveMonsterPackPathForMigration } from "../../../module/logic/creature-feature-feat-migration-resolve.mjs";

describe("resolveMonsterPackPathForMigration", () => {
    const monstersDir = path.join(process.cwd(), "packs", "monsters");

    it("uses monsterPathByKey when basename is absent", () => {
        const map = new Map([["monsterApe", path.join(monstersDir, "monster-ape.json")]]);
        const row = { monsterKey: "monsterApe", oldFeatKey: "x", newCreatureFeatureKey: "y" };
        const out = resolveMonsterPackPathForMigration(row, map, monstersDir);
        expect(out).toEqual({ ok: true, fp: path.join(monstersDir, "monster-ape.json") });
    });

    it("returns error when key missing and no basename", () => {
        const out = resolveMonsterPackPathForMigration(
            { monsterKey: "monsterMissing", oldFeatKey: "a", newCreatureFeatureKey: "b" },
            new Map(),
            monstersDir
        );
        expect(out.ok).toBe(false);
        if (!out.ok) expect(out.message).toContain("no monster JSON");
    });

    it("resolves basename under monsters dir", () => {
        const out = resolveMonsterPackPathForMigration(
            {
                monsterKey: "monsterDireApe",
                monsterPackBasename: "monster-ape-dire.json",
                oldFeatKey: "multiattack",
                newCreatureFeatureKey: "creatureMultiattack"
            },
            new Map(),
            monstersDir
        );
        expect(out).toEqual({ ok: true, fp: path.join(monstersDir, "monster-ape-dire.json") });
    });

    it("rejects non-basename monsterPackBasename", () => {
        const out = resolveMonsterPackPathForMigration(
            {
                monsterKey: "monsterApe",
                monsterPackBasename: "../secrets.json",
                oldFeatKey: "a",
                newCreatureFeatureKey: "b"
            },
            new Map(),
            monstersDir
        );
        expect(out.ok).toBe(false);
        if (!out.ok) expect(out.message).toContain("basename");
    });
});
