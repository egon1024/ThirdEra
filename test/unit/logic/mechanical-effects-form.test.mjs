import { describe, expect, it } from "vitest";
import { getSystemChangesFromForm } from "../../../module/logic/mechanical-effects-form.mjs";

/** Minimal form mock: mechanical table + named inputs */
function mockFormWithChanges(rows) {
    const inputs = [];
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const mk = (name, value) => ({
            name,
            value,
            getAttribute(attr) {
                return attr === "name" ? name : null;
            }
        });
        inputs.push(mk(`system.changes.${i}.key`, r.key));
        inputs.push(mk(`system.changes.${i}.value`, String(r.value)));
        inputs.push(mk(`system.changes.${i}.label`, r.label ?? ""));
    }
    return {
        querySelector(sel) {
            if (sel === ".mechanical-effects-table") return {};
            const m = sel.match(/^\[name="(system\.changes\.\d+\.(?:key|value|label))"\]$/);
            if (!m) return null;
            return inputs.find((inp) => inp.name === m[1]) ?? null;
        },
        querySelectorAll(sel) {
            if (sel === '[name^="system.changes."]') return inputs;
            return [];
        }
    };
}

describe("getSystemChangesFromForm", () => {
    it("returns undefined when there is no mechanical-effects table", () => {
        const form = {
            querySelector: () => null,
            querySelectorAll: () => []
        };
        expect(getSystemChangesFromForm(form)).toBeUndefined();
    });

    it("returns empty array when table exists but has no change rows", () => {
        const form = {
            querySelector: (sel) => (sel === ".mechanical-effects-table" ? {} : null),
            querySelectorAll: () => []
        };
        expect(getSystemChangesFromForm(form)).toEqual([]);
    });

    it("builds changes from keyed form fields in index order", () => {
        const form = mockFormWithChanges([
            { key: "ability.dex", value: 2, label: "a" },
            { key: "ability.con", value: -2, label: "b" }
        ]);
        expect(getSystemChangesFromForm(form)).toEqual([
            { key: "ability.dex", value: 2, label: "a" },
            { key: "ability.con", value: -2, label: "b" }
        ]);
    });

    it("treats empty value as 0 and NaN as 0", () => {
        const form = mockFormWithChanges([{ key: "ability.str", value: "", label: "" }]);
        expect(getSystemChangesFromForm(form)[0].value).toBe(0);
        const form2 = mockFormWithChanges([{ key: "ability.str", value: "x", label: "" }]);
        expect(getSystemChangesFromForm(form2)[0].value).toBe(0);
    });
});
