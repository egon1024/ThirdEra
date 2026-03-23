import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["test/**/*.test.mjs", "test/**/*.spec.mjs"],
        passWithNoTests: false
    }
});
