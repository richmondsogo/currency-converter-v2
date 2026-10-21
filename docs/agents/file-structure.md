# File & Directory Structure Conventions

This document defines the organization of files and directories in the `currency-convertr` repository.

```
currency-convertr/
├── .agents/                    # Custom project agent configurations & skills
├── .github/                    # GitHub actions, workflows, issue templates
├── .gitignore                  # Git ignore definitions
├── AGENTS.md                   # Agent guidelines, banned skills, zero-innerHTML rule
├── BUILD_PROTOCOL.md           # Governance protocol and step lifecycle standard
├── CONTEXT.md                  # High-level architecture, entry points, and status
├── CHANGELOG.md                # Release version history
├── CHROMEWEBSTORE.md           # Chrome Web Store submission metadata and store copy
├── DESIGN.md                   # Canonical design system tokens, typography, and UI specs
├── INSTALLED_SKILLS.md         # Inventory of locally available agent skills
├── LICENSE                     # MIT License
├── PRIVACY_POLICY.md           # User privacy policy and data non-transmission guarantees
├── README.md                   # Public repository documentation, quickstart, and feature list
├── build.js                    # esbuild bundler script for Chrome & Firefox MV3
├── package.json                # Project dependencies, metadata, and scripts
├── package-lock.json           # Locked dependency tree
│
├── dist/                       # Compiled extension bundles (tracked on main)
│   ├── chrome/                 # Manifest V3 unpacked extension directory for Chrome
│   │   ├── background.js       # Bundled service worker
│   │   ├── content.js          # Bundled full in-page conversion engine
│   │   ├── manifest.json       # Generated Chrome MV3 manifest
│   │   ├── icons/              # Extension icons (16, 48, 96, 128)
│   │   ├── options/            # Options HTML, CSS, and bundled JS
│   │   └── popup/              # Popup HTML, CSS, and bundled JS
│   ├── firefox/                # Manifest V3 unpacked extension directory for Firefox
│   │   ├── background.js       # Firefox background script
│   │   ├── content.js          # Bundled full in-page conversion engine
│   │   ├── manifest.json       # Generated Firefox MV3 manifest (with gecko ID)
│   │   ├── icons/              # Extension icons
│   │   ├── options/            # Options HTML, CSS, and bundled JS
│   │   └── popup/              # Popup HTML, CSS, and bundled JS
│   └── packages/               # Zipped extension packages ready for store uploads
│       ├── currency-converter-chrome-v2.0.0.zip
│       └── currency-converter-firefox-v2.0.0.zip
│
├── docs/                       # Project documentation
│   ├── adr/                    # Architecture Decision Records
│   │   ├── 0000-template.md    # Standard ADR template
│   │   └── 0001-...            # Sequentially numbered architectural decisions
│   ├── agents/                 # Agent operational guides and standards
│   │   └── file-structure.md   # This document
│   ├── audits/                 # UI, accessibility, and performance audit reports
│   │   └── pill-audit.md       # improve-ui audit of the Dynamic Island pill
│   └── steps/                  # Plan and execution logs for individual steps
│       ├── 01-snapshot-local-state.md
│       └── 02-behavior-spec.md
│
├── screenshots/                # Visual verification screenshots and store graphics
│
├── scripts/                    # Build utilities, data generators, and test verification scripts
│   ├── generate-currencies.js  # Node.js generator for currencies-data.js
│   ├── generate_clean_assets.js
│   ├── generate_v2_screenshots.js
│   └── verify_*.js             # Automated visual verification scripts
│
├── src/                        # Primary extension source code (pure ESM)
│   ├── background.js           # Central background service worker
│   ├── content/                # In-page execution modules
│   │   ├── content.js          # Full in-page engine orchestrator
│   │   ├── scanner.js          # DOM tree walker, split-price assembler, MutationObserver
│   │   ├── ui.js               # InPageUI Dynamic Island pill class (zero innerHTML)
│   │   └── ui.css              # Dynamic Island styling and OLED theme
│   ├── popup/                  # Toolbar popup UI
│   │   ├── popup.html          # Popup markup
│   │   ├── popup.js            # Popup logic and quick converter
│   │   └── popup.css           # Popup styles
│   ├── options/                # Options & settings UI
│   │   ├── options.html        # Options page markup
│   │   ├── options.js          # SettingsManager bridge and site overrides
│   │   └── options.css         # Options styling
│   └── shared/                 # Shared cross-context utility modules
│       ├── browser.js          # Cross-browser chrome/browser API shim
│       ├── currencies.js       # Currency list utilities and helpers
│       ├── currencies-data.js  # Static generated currency database (170+ codes)
│       ├── format.js           # Intl.NumberFormat localized currency formatter
│       ├── messaging.js        # Typed message definitions and promises
│       ├── parser.js           # Multi-currency regex parser & DOM metadata inference
│       ├── rates.js            # 3-Tier fallback rates fetcher and cache manager
│       └── settings.js         # Settings schema, migrations, and defaults
│
└── tests/                      # Automated test suite (Node.js test runner)
    ├── fixtures/               # HTML fixture files for integration tests
    ├── build.test.js           # Manifest structure, permissions, and build validation
    ├── currencies.test.js      # Metadata and currency code tests
    ├── format.test.js          # Number formatting and display mode tests
    ├── parse.test.js           # Standalone parser test script
    ├── parser.test.js          # Price detection, regex, and DOM inference tests
    ├── pill_and_options.test.js# UI lifecycle and options unit tests
    ├── rates.test.js           # Fallback, cross-rates, and cache tests
    ├── scanner.test.js         # DOM scanning, revert fidelity, and shadow DOM tests
    └── settings.test.js        # Settings defaults, migrations, and persistence tests
```

---

## Directory Conventions

1. **No Root Clutter**: Never create loose scripts, scratchpad files, or temporary artifacts in the root directory. Scratch scripts belong in `scripts/` or your assigned conversation scratch directory.
2. **Audit Outputs**: All visual, accessibility, or performance audit reports must be saved under `docs/audits/`.
3. **Step Documentation**: Step logs and implementation specs must be placed under `docs/steps/NN-<slug>.md`.
4. **Architectural Decisions**: Architectural choices must be recorded in `docs/adr/NNNN-<slug>.md` using `docs/adr/0000-template.md`.
5. **Product Source Isolation**: All application code lives strictly under `src/`. No production code is authored directly in `dist/`.
