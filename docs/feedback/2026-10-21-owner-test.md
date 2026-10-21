# Owner Feedback: Live Testing (2026-10-21)

1. Dragged the pill and a second pill remained on the page. Screenshot shows "USD -> NGN 148" and "USD 0" at the same time.
2. Pill currency dropdown: only the focused option is legible. Owner does not want a basic native dropdown.
3. eBay: set Always, it did not auto-convert. Converted manually and prices read "US NGN 133,419.80" instead of "NGN 133,419.80". A pill showed "USD -> NGN 0" with a grey dot while the page was converted. (Possibly tested on a stale build.)
4. plug.tech: added a rule, reloaded, nothing happened until manual convert; after that prices read "NGN 552,620.92 USD" (stray "USD"). (Possibly tested on a stale build.)
5. Never convert worked, but choosing it from the dropdown was bad.
6. Options page needs a huge overhaul: minimalist, calm, coherent; clean sidebar layout with shadcn components. Contrast is off, layout is clumsy. Dislikes the Live Preview section and the pill-style tab bar. The "Add Rule" button reads "+ + Add Rule" (an icon plus and a literal plus in the label text).
7. Popup: "Always convert" and "Never convert" are two independent toggle switches with bad spacing; with the tri-state site mode they can show contradictory states. Toggles look larger than the 32x18 spec in DESIGN.md. No consistent design system.
8. Owner expected shadcn/component libraries to be used. They were not.
9. Owner loves the pill concept and its fluency.
