# 0010. Open Shadow DOM Traversal

Date: 2026-03-01
Status: Accepted

## Context
Modern frontend frameworks and web components increasingly encapsulate catalog, cart, and checkout components inside Shadow DOM roots. A scanner limited strictly to the main document light DOM misses prices contained inside custom elements.

## Decision
Implement recursive shadow root discovery via `_findAllRoots()`. Both TreeWalker text node scans and split-price candidate selections iterate across the root document light DOM and all open shadow DOM trees attached to host elements.

## Rationale
- Coverage: Ensures prices inside web components (such as custom `<product-card>` or `<price-badge>`) are discovered and converted.
- Safety: Only attaches to `open` shadow roots accessible via `element.shadowRoot`. Skips extension roots marked with `data-cc-ignore`.

## Consequences
- Closed shadow roots (`mode: "closed"`) cannot be accessed due to browser security boundaries.
