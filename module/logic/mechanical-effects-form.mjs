/**
 * Read `system.changes` from an item sheet form's mechanical-effects table.
 * Used so submitOnChange (e.g. from Description / ProseMirror) does not drop rows when
 * Foundry's default form expansion omits nested `system.changes.*` fields.
 *
 * @param {ParentNode|null|undefined} form  Typically the sheet's <form>
 * @returns {Array<{ key: string, value: number, label: string }>|undefined}  `undefined` if this form has no mechanical-effects table
 */
export function getSystemChangesFromForm(form) {
    const table = form?.querySelector?.(".mechanical-effects-table");
    if (!table) return undefined;
    const indices = new Set();
    for (const el of form.querySelectorAll('[name^="system.changes."]')) {
        const name = el.getAttribute?.("name") ?? el.name ?? "";
        const m = name.match(/^system\.changes\.(\d+)\./);
        if (m) indices.add(parseInt(m[1], 10));
    }
    const sorted = [...indices].sort((a, b) => a - b);
    return sorted.map((i) => {
        const keyEl = form.querySelector(`[name="system.changes.${i}.key"]`);
        const valEl = form.querySelector(`[name="system.changes.${i}.value"]`);
        const labEl = form.querySelector(`[name="system.changes.${i}.label"]`);
        const raw = valEl?.value;
        const value = raw === "" || raw == null ? 0 : Number(raw);
        return {
            key: (keyEl?.value ?? "").trim(),
            value: Number.isNaN(value) ? 0 : value,
            label: (labEl?.value ?? "").trim()
        };
    });
}
