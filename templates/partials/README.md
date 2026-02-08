# Editor Box Partial - Usage Guide

## Overview

The `editor-box.hbs` partial provides a reusable component for rich text editors with toggle-able display/edit modes. It includes the refined styling we developed for spell sheets:

- **Display Mode**: Compact, auto-sized content display
- **Edit Mode**: 10em minimum height with vertical resize capability
- **Transparent Background**: Matches the panel background
- **Labeled Headers**: Clear field identification

## File Location

`/templates/partials/editor-box.hbs`

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `label` | string | Yes | The header label displayed above the editor |
| `name` | string | Yes | The field name for the prose-mirror element (e.g., "system.description") |
| `value` | string | Yes | The current value of the field |
| `enrichedContent` | string | Yes | The enriched HTML content to display in view mode |
| `documentUuid` | string | Yes | The document UUID for the prose-mirror element |
| `minHeight` | string | No | The minimum height in edit mode (default: "10em") |

## Usage Example

```handlebars
{{> editor-box 
    label="Description" 
    name="system.description" 
    value=system.description 
    enrichedContent=enriched.description
    documentUuid=item.uuid
    minHeight="15em"
}}
```

## Registration

To use this partial in your sheet, register it in your ApplicationV2 class:

```javascript
static PARTS_TEMPLATES = [
    "systems/thirdera/templates/partials/editor-box.hbs"
];
```

## CSS Dependencies

The partial relies on the following CSS classes defined in `thirdera.css`:

- `.editor-box` - Container styling
- `prose-mirror` - Base editor styling
- `prose-mirror.active` - Edit mode styling with 10em min-height
- `.ProseMirror` - Content area with transparent background and resize handle

## Where It's Used

Currently implemented in:
- **Spell Item Sheet**: Description and Material Components fields

## Extending

To use this partial in other item types or actor sheets:

1. Register the partial in your sheet class (see Registration above)
2. Prepare the enriched content in your `_prepareContext()` method
3. Invoke the partial in your template with the appropriate parameters

Example for a feat description:

```javascript
// In _prepareContext()
const enriched = {
    benefit: await TextEditor.enrichHTML(systemData.benefit, { async: true, relativeTo: item })
};
```

```handlebars
{{!-- In template --}}
{{> editor-box 
    label="Benefit" 
    name="system.benefit" 
    value=system.benefit 
    enrichedContent=enriched.benefit
    documentUuid=item.uuid
}}
```
