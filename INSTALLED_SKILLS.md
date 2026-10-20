# Global AI Skills Catalog & Usage Guide

This document indexes all frontend, UI/UX, motion, and design skills installed globally into your Antigravity environment (`C:\Users\Richmond\.gemini\config\skills`).

---

## Quick Decision Matrix

| If your goal is... | Best Skill to Use | Key Trigger / Invocation |
|---|---|---|
| **Quickly deslop / clean up an interface** (spacing, typography, layout) | `baseline-ui` | `/baseline-ui` or `/baseline-ui <file>` |
| **Document an app's visual language or create `DESIGN.md`** | `create-design-md` | `/create-design-md` |
| **Audit an existing screen without breaking its identity** | `improve-ui` | `/improve-ui` |
| **Build a pan/zoom component playground/viewer** | `component-canvas` | `/component-canvas` |
| **Audit/fix WCAG, ARIA labels, keyboard nav, or contrast** | `fixing-accessibility` | `/fixing-accessibility` or `/fixing-accessibility <file>` |
| **Fix page titles, OG cards, Twitter previews, or canonical tags** | `fixing-metadata` | `/fixing-metadata` |
| **Eliminate animation jank, layout thrashing, or compositor bugs** | `fixing-motion-performance` | `/fixing-motion-performance` or `/fixing-motion-performance <file>` |
| **Route a UI goal to the smallest appropriate skill context** | `ui-skills-root` | Triggered at start of UI tasks |
| **Art-direct a distinctive, award-grade website (anti-slop)** | `taste-skill` / `design-taste-frontend` | `node scripts/draw.mjs --sector <name>` |
| **Query 79 UI styles, 192 color palettes, or generate design systems** | `ui-ux-pro-max` | `python scripts/search.py "<query>" --design-system` |
| **Generate marketing banners, hero banners, or social headers** | `banner-design` | Direct skill query |
| **Establish brand voices, tone frameworks, or guidelines** | `brand` | Direct skill query |
| **Design brand logos, CIP mockups, or multi-platform deliverables** | `design` | Direct skill query |
| **Generate interactive HTML slide decks with Chart.js** | `slides` | Direct skill query |
| **Implement accessible Radix / Tailwind UI components** | `ui-styling` | Direct skill query |

---

## 1. ibelick UI Skills Suite (`ibelick/ui-skills`)

A modular toolkit by Julien Pradet (creator of `motion-primitives`) targeting UI polish, motion performance, accessibility, and design system governance.

### 1.1 `baseline-ui`
- **Location**: [`C:\Users\Richmond\.gemini\config\skills\baseline-ui`](file:///C:/Users/Richmond/.gemini/config/skills/baseline-ui)
- **Purpose**: Rapidly eliminates AI-generated interface slop by enforcing strict layout, spacing, and typographic baselines.
- **Best Use Cases**:
  - Running a fast cleanup pass over a newly drafted component or page.
  - Reviewing specific files for subtle hierarchy, padding, and font-scale violations (`/baseline-ui <file>`).
  - Enforcing sensible Tailwind CSS defaults and `motion/react` standards.

### 1.2 `create-design-md`
- **Location**: [`C:\Users\Richmond\.gemini\config\skills\create-design-md`](file:///C:/Users/Richmond/.gemini/config/skills/create-design-md)
- **Purpose**: Reverse-engineers a codebase or public website to author or update a canonical `DESIGN.md` specification file.
- **Best Use Cases**:
  - Onboarding AI coding agents to an existing codebase so all future UI work remains visually coherent.
  - Extracting core design tokens (colors, typography, radii, spacing, depth) into persistent documentation without modifying product code.

### 1.3 `improve-ui`
- **Location**: [`C:\Users\Richmond\.gemini\config\skills\improve-ui`](file:///C:/Users/Richmond/.gemini/config/skills/improve-ui)
- **Purpose**: Audits a product surface against its own design tokens and writes self-contained implementation plans in `design-plans/`.
- **Best Use Cases**:
  - Performing a non-destructive audit of an existing screen or flow.
  - Identifying design system drift and presenting concrete fix plans before any code is modified.
  - Preparing structured frontend design handoffs.

### 1.4 `component-canvas`
- **Location**: [`C:\Users\Richmond\.gemini\config\skills\component-canvas`](file:///C:/Users/Richmond/.gemini/config/skills/component-canvas)
- **Purpose**: Builds an interactive, pan-and-zoom full-screen canvas for previewing existing components and their states.
- **Best Use Cases**:
  - Visualizing component variants, edge cases, and animations in an isolated sandbox.
  - Stress-testing UI components with long text, empty states, and dynamic sizes without altering original component source.

### 1.5 `fixing-accessibility`
- **Location**: [`C:\Users\Richmond\.gemini\config\skills\fixing-accessibility`](file:///C:/Users/Richmond/.gemini/config/skills/fixing-accessibility)
- **Purpose**: Surgical audit and remediation of accessibility violations (WCAG 2.1 AA).
- **Best Use Cases**:
  - Adding keyboard accessibility to custom dropdowns, dialogs, drawers, and tabs.
  - Auditing form errors, missing `aria-labels`, missing focus rings, and color contrast ratios.
  - Running `/fixing-accessibility <file>` for targeted code suggestions.

### 1.6 `fixing-metadata`
- **Location**: [`C:\Users\Richmond\.gemini\config\skills\fixing-metadata`](file:///C:/Users/Richmond/.gemini/config/skills/fixing-metadata)
- **Purpose**: Audits and fixes HTML metadata, Open Graph cards, Twitter share previews, canonical tags, and structured JSON-LD data.
- **Best Use Cases**:
  - Preparing landing pages and blog posts for social sharing and search indexing.
  - Verifying social preview card tags (`og:title`, `og:image`, `twitter:card`).
  - Fixing canonical URL discrepancies and favicon manifests.

### 1.7 `fixing-motion-performance`
- **Location**: [`C:\Users\Richmond\.gemini\config\skills\fixing-motion-performance`](file:///C:/Users/Richmond/.gemini/config/skills/fixing-motion-performance)
- **Purpose**: Identifies and resolves 60fps animation regressions, layout thrashing, and compositor bottlenecks.
- **Best Use Cases**:
  - Diagnosing stuttering scroll effects, choppy page transitions, or heavy blur filters.
  - Migrating CPU-heavy properties (`top`, `left`, `width`, `height`) to GPU compositor properties (`transform`, `opacity`).
  - Enforcing `prefers-reduced-motion` compliance across all animation code.

### 1.8 `ui-skills-root`
- **Location**: [`C:\Users\Richmond\.gemini\config\skills\ui-skills-root`](file:///C:/Users/Richmond/.gemini/config/skills/ui-skills-root)
- **Purpose**: Intelligent router that classifies incoming UI tasks and activates the smallest appropriate UI skill context.
- **Best Use Cases**:
  - Deciding whether a task is UI-related and narrowing scope to the minimal necessary documentation.

---

## 2. Leonxlnx Taste Skill (`Leonxlnx/taste-skill`)

### `design-taste-frontend` / `taste-skill`
- **Location**: [`C:\Users\Richmond\.gemini\config\skills\taste-skill`](file:///C:/Users/Richmond/.gemini/config/skills/taste-skill) (Aliased as [`design-taste-frontend`](file:///C:/Users/Richmond/.gemini/config/skills/design-taste-frontend))
- **Author**: Leonxlnx
- **Purpose**: The anti-slop frontend art-direction engine. Distilled from a rigorous study of 247 award-winning websites (Awwwards SOTD, One Page Love). Deals distinctive aesthetic concepts, typography pairings, palettes, and section compositions while eliminating repetitive generic AI design patterns.
- **Included CLI Tools**:
  - `node scripts/draw.mjs --sector <sector>`: Generates complete, non-generic design direction bundles for SaaS, finance, portfolios, consumer apps, ecommerce, etc.
  - `node scripts/inspect.mjs`: Measures rendered layouts in a real browser against strict anti-slop rules (e.g. banning eyebrow labels, artificial 01/02/03 numbering, centered 3-line headlines, and unearned gradients).
- **Best Use Cases**:
  - Designing a landing page or marketing site from scratch that looks bespoke, memorable, and high-craft.
  - Overcoming "AI slop" when a user complains that a page looks generic, templated, or uninspired.
  - Selecting typography pairings, high-contrast layouts, and signature motion transitions.

---

## 3. NextLevelBuilder UI/UX Pro Max Suite (`nextlevelbuilder/ui-ux-pro-max-skill`)

A comprehensive offline design intelligence ecosystem containing 79 UI styles, 192 product color palettes, 74 font pairings, 119 UX guidelines, and 25 chart specifications.

### 3.1 `ui-ux-pro-max`
- **Location**: [`C:\Users\Richmond\.gemini\config\skills\ui-ux-pro-max`](file:///C:/Users/Richmond/.gemini/config/skills/ui-ux-pro-max) (Aliased as [`ui-ux-pro-max-skill`](file:///C:/Users/Richmond/.gemini/config/skills/ui-ux-pro-max-skill))
- **Purpose**: Searchable design intelligence database with zero external dependencies.
- **Search CLI**:
  ```bash
  python "C:/Users/Richmond/.gemini/config/skills/ui-ux-pro-max/scripts/search.py" "<query>" [options]
  ```
  - `--design-system`: Generates a full tailored design system (pattern, palette, typography, checklist).
  - `--domain style`: Searches 79 curated visual styles (Glassmorphism, Bento, Brutalism, Minimalism, Neo-brutalism, etc.).
  - `--domain color`: Queries 192 domain-specific palettes with hex codes and reasoning profiles.
  - `--domain typography`: Queries curated Google Font pairings with mood keywords.
  - `--domain ux`: Queries 119 accessibility and usability rules.
  - `--domain chart`: Queries 25 data visualization types and recommendations.
  - `--stack <tech>`: Queries stack-specific implementation patterns (React, Next.js, Tailwind, SwiftUI, Flutter, Vue, etc.).
- **Best Use Cases**:
  - Generating complete design systems for new products or dashboards based on industry context.
  - Querying exact WCAG accessibility rules, touch target guidelines, and responsive layout constraints.
  - Choosing appropriate charting patterns for analytics dashboards.

### 3.2 Companion Design Skills
- **`banner-design`** ([`C:\Users\Richmond\.gemini\config\skills\banner-design`](file:///C:/Users/Richmond/.gemini/config/skills/banner-design)):
  Designs banners for ads, social media (Twitter/X, LinkedIn, Facebook, YouTube), website hero sections, and print in 22 distinct visual styles.
- **`brand`** ([`C:\Users\Richmond\.gemini\config\skills\brand`](file:///C:/Users/Richmond/.gemini/config/skills/brand)):
  Defines brand voices, visual identity standards, tone frameworks, and asset governance.
- **`design`** ([`C:\Users\Richmond\.gemini\config\skills\design`](file:///C:/Users/Richmond/.gemini/config/skills/design)):
  End-to-end design tool for logos (55 styles), Corporate Identity Programs (CIP), HTML presentation decks, and SVG icon generation.
- **`slides`** ([`C:\Users\Richmond\.gemini\config\skills\slides`](file:///C:/Users/Richmond/.gemini/config/skills/slides)):
  Creates interactive, responsive HTML presentations with integrated Chart.js visualizations.
- **`ui-styling`** ([`C:\Users\Richmond\.gemini\config\skills\ui-styling`](file:///C:/Users/Richmond/.gemini/config/skills/ui-styling)):
  Constructs accessible, responsive interfaces using Tailwind CSS and Radix / shadcn/ui component architectures.

---

## 4. Local Execution & Verification Reference

All skills have been verified locally on your machine:
- **Python-based CLI tools**: Tested against Python 3.x with zero external packages.
- **Node.js-based CLI tools**: Tested against Node.js v22.x standard libraries.
- **Antigravity Global Root**: `C:\Users\Richmond\.gemini\config\skills\`
