# 0007. Currency Metadata Generation

Date: 2026-03-01
Status: Accepted

## Context
A global currency converter requires comprehensive metadata (ISO codes, symbols, English display names, fraction digits, and ccTLD associations) for over 170 currencies. Bundling an external multi-megabyte dataset or fetching metadata remotely at runtime introduces network latency and bundle bloat.

## Decision
Create an offline generator script (`scripts/generate-currencies.js`) that queries native Node.js APIs (`Intl.supportedValuesOf('currency')`, `Intl.DisplayNames`, `Intl.NumberFormat`), merged with a curated override map for symbols, aliases, and ccTLD mappings. The script outputs a static, tree-shakeable ESM module: `src/shared/currencies-data.js`.

## Rationale
- Zero runtime overhead: Metadata is statically committed to the repository and compiled directly into bundles.
- Offline reliability: The extension operates completely offline once rates are cached, with no external metadata dependencies.
- Standardized accuracy: Relies on official CLDR/Intl standards with targeted manual disambiguations for ambiguous symbols (e.g. `$` -> USD, CAD, AUD based on TLD / language hints).

## Consequences
- Updating metadata or currency mappings requires re-running `scripts/generate-currencies.js` and committing the output.
