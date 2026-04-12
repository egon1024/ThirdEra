/**
 * ESLint flat config — ThirdEra `.mjs` sources (Vitest tree, system `module/`, entry, scripts, Vitest config).
 *
 * Rules: `eslint:recommended` on each slice. The system slice uses browser + common Foundry VTT globals
 * (readonly) so `no-undef` is useful without listing the entire Foundry API. Remaining false positives
 * or policy tweaks belong in follow-up PRs (do not silence real issues here without maintainer intent).
 */
import eslint from "@eslint/js";
import globals from "globals";

const underscoreUnusedVarsRule = [
    "error",
    {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
    },
];

const recommendedWithUnderscoreUnused = {
    ...eslint.configs.recommended.rules,
    "no-unused-vars": underscoreUnusedVarsRule,
};

/** Globals typical of Foundry client / system code (not a complete API surface). */
const foundryClientGlobals = {
    ...globals.browser,
    foundry: "readonly",
    game: "readonly",
    Hooks: "readonly",
    CONFIG: "readonly",
    CONST: "readonly",
    canvas: "readonly",
    ui: "readonly",
    Roll: "readonly",
    Dialog: "readonly",
    ChatMessage: "readonly",
    Actor: "readonly",
    Item: "readonly",
    Macro: "readonly",
    Handlebars: "readonly",
    /** Foundry client / sheets (jQuery) */
    $: "readonly",
    jQuery: "readonly",
    /** Legacy global alias still referenced in some sheets */
    fromUuid: "readonly",
};

export default [
    {
        ignores: ["**/node_modules/**", "coverage/**"],
    },
    {
        files: ["test/**/*.mjs"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.node,
                ...globals.vitest,
                CONFIG: "readonly",
            },
        },
        rules: recommendedWithUnderscoreUnused,
    },
    {
        files: ["module/**/*.mjs", "thirdera.mjs"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: foundryClientGlobals,
        },
        rules: recommendedWithUnderscoreUnused,
    },
    {
        files: ["scripts/**/*.mjs", "vitest.config.mjs"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },
        rules: recommendedWithUnderscoreUnused,
    },
];
