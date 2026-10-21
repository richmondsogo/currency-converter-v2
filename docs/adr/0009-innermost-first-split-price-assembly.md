# 0009. Innermost-First Split Price Assembly

Date: 2026-03-01
Status: Accepted

## Context
When e-commerce sites construct split prices (e.g., `<span class="price"><span class="sym">$</span><span class="whole">49</span><sup class="cents">99</sup></span>`), both the inner spans and their parent containers may contain text matching price regular expressions. Naively converting an outer container can destroy complex adjacent markup (like discount badges or product links) and prevent clean reverting.

## Decision
Candidate split-price elements are sorted in ascending order by their descendant element count (`element.getElementsByTagName('*').length`), evaluating innermost elements first. Additionally, any element that contains an already-converted child or whose ancestor is already converted is skipped.

## Rationale
- Minimal DOM disruption: Confines replacement strictly to the tightest container that encloses the complete price components.
- Byte-for-byte fidelity: Prevents parent containers from obliterating sibling markup and ensures clean revert restoration.

## Consequences
- Requires an initial sorting pass over candidate elements before DOM mutation begins.
