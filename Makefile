# Convenience targets; npm remains the source of truth (see package.json).
.PHONY: test test-coverage

test:
	node --check module/logic/compendium-loader.mjs
	npm test

test-coverage:
	npm run test:coverage
