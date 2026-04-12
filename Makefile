# Convenience targets; npm remains the source of truth (see package.json).
.PHONY: test test-coverage lint

# Non-login shells (e.g. some IDE / `make` invocations) often omit nvm from PATH.
NODE := $(shell command -v node 2>/dev/null)
ifeq ($(NODE),)
NODE := $(shell command -v nodejs 2>/dev/null)
endif

# Default nvm location; honour NVM_DIR when make inherits it from the environment.
NVMDIR := $(if $(NVM_DIR),$(NVM_DIR),$(HOME)/.nvm)
NVMSH := $(NVMDIR)/nvm.sh

test:
ifeq ($(NODE),)
ifneq ($(wildcard $(NVMSH)),)
	@bash -c 'set -e; . "$(NVMSH)"; node --check module/logic/compendium-loader.mjs; npm test'
else
	@printf '%s\n' "make test: no Node on PATH (tried \`node\` and \`nodejs\`). If you use nvm, ensure $(NVMSH) exists or set NVM_DIR. Otherwise add Node to PATH or run \`npm test\` from a shell where \`node\` works." >&2; exit 1
endif
else
	"$(NODE)" --check module/logic/compendium-loader.mjs
	npm test
endif

test-coverage:
ifeq ($(NODE),)
ifneq ($(wildcard $(NVMSH)),)
	@bash -c 'set -e; . "$(NVMSH)"; npm run test:coverage'
else
	@printf '%s\n' "make test-coverage: no Node on PATH and no nvm at $(NVMSH). Add Node to PATH or run \`npm run test:coverage\` from a configured shell." >&2; exit 1
endif
else
	npm run test:coverage
endif

lint:
ifeq ($(NODE),)
ifneq ($(wildcard $(NVMSH)),)
	@bash -c 'set -e; . "$(NVMSH)"; npm run lint'
else
	@printf '%s\n' "make lint: no Node on PATH (tried \`node\` and \`nodejs\`). If you use nvm, ensure $(NVMSH) exists or set NVM_DIR. Otherwise add Node to PATH or run \`npm run lint\` from a shell where \`node\` works." >&2; exit 1
endif
else
	npm run lint
endif
