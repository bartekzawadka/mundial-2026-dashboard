# Implementation Plan: Live Tournament Data

**Branch**: `001-live-data` | **Date**: 2026-05-15 | **Spec**: [./spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-live-data/spec.md`

## Summary

Wire the Mundial 2026 dashboard to live external data instead of the bundled
`tournament.data.ts`. On every page load the SPA fetches group composition +
standings, the full fixture list with scheduled / live / finished scores, and
the knockout bracket structure from ESPN's public `site.api.espn.com` JSON
endpoints. Per-match timelines load lazily when the user clicks a match row to
expand it inline (accordion behaviour: one open match per tab). DS-B
(OpenFootball static JSON) is held in configuration as a config-only fallback
that an operator can flip to during an extended DS-A outage; it is never
contacted at runtime. No backend. No `localStorage` / `sessionStorage` /
`IndexedDB` / service-worker persistence. No API keys in the bundle.
Per-section "Refresh" affordances are always visible on every section
(success or error); no global Refresh All button.

## Technical Context

**Language/Version**: TypeScript ~5.9.3 (strict mode per Constitution
Principle II).

**Primary Dependencies**: Angular 21.2.x standalone components + signals
(already in `package.json`). No new runtime dependencies. Native `fetch` +
`AbortController` for HTTP (see research §R6). No third-party UI framework,
no state-management library, no fetch wrapper library.

**Storage**: None. FR-002 forbids any client-side persistence layer
(`localStorage`, `sessionStorage`, `IndexedDB`, service-worker cache).
Browser HTTP caching honoured per the provider's `Cache-Control` is fine
per FR-005 and Assumptions §"Browser HTTP caching".

**Testing**: No automated test suite (Constitution Principle II rationale).
Manual verification per Constitution §Development Workflow & Quality Gates:
each touched view checked in a real browser at desktop and 375 px mobile
widths. The quickstart describes the smoke-test sequence.

**Target Platform**: Production — nginx 1.27 (Alpine) per `Dockerfile`.
Browsers — modern evergreen (Chromium / Firefox / Safari current-minus-1).

**Project Type**: Single-project Angular workspace; root `/src/app`. No
second workspace, no monorepo tool, no backend service. Constitution
§Technology constraint preserved.

**Performance Goals**:
- SC-001 — group standings populated within 3 s on ≥10 Mbps, ≤50 ms RTT.
- SC-002 — three eagerly-fetched categories (standings, fixtures + scores,
  bracket) populated within 5 s on the same connection; lazy per-match
  timeline populated within 3 s of row expand.
- SC-007 — post-result accuracy on reload (function of source freshness).

**Constraints**:
- FR-001 — every page load fetches all eager categories from external
  sources; no bundled fallback dataset.
- FR-002, SC-004 — no client-side persistence of fetched data.
- FR-003 — `src/app/tournament.data.ts` is deleted on merge; no equivalent
  in-repo dataset of teams / groups / fixtures.
- FR-004 — no background polling; per-section Refresh button always visible.
- FR-006, FR-007, SC-005 — CORS-permissive key-less sources only; no
  secrets in the bundle.
- FR-008 — single config surface contains both primary (DS-A ESPN) and
  fallback (DS-B OpenFootball) URL sets; only the active set is contacted
  at runtime.
- FR-011 — 10 s per-request timeout via `AbortController`.
- FR-012 — no automatic retry; no automatic cross-source retry.
- FR-013 — local time-zone display with zone abbreviation (resolved in
  research §R8 in favour of abbreviation over IANA name).

**Scale/Scope**:
- 48 teams, 12 groups (A–L), 104 matches (72 group + 32 knockout).
- Lazy per-match timelines: at most one expanded at a time (research §R10).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Principle-by-principle check against `.specify/memory/constitution.md` v1.0.0.

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Standalone Angular & Signals-First | PASS | All new components/services use standalone + signals; no `NgModule`, no RxJS `BehaviorSubject`, no third-party UI library. Hand-authored SCSS only. |
| II. Strict TypeScript & Type Safety | PASS | Raw ESPN payload types live in `espn.ts` and are mapped into typed domain entities at the boundary. No `any` in production code. |
| III. Simplicity & YAGNI (NON-NEGOTIABLE) | PASS | This feature **is** the explicitly-planned data-service integration that the Constitution names (§Technology, §Principle III). Four new files only (config, types, source-boundary, service). No generic HTTP wrapper. No DI-based provider strategy. DS-B fallback is config-only — no runtime polymorphism between providers; the OpenFootball mapper ships as a typed stub that throws (research §R5). |
| IV. Responsive, Accessible UI | PASS | Each match row becomes a `<button>` with `aria-expanded` for the inline expander. Per-section Refresh buttons carry section-scoped `aria-label`. Live indicator uses `aria-live="polite"`. WCAG AA contrast preserved. Existing 360 px breakpoint behaviour kept. |
| V. Reproducible Builds & CI Parity | PASS | No new system dependencies; `npm run build` and `docker build .` produce identical artefacts. The CI workflow file is unchanged. |

**Gate result (pre-research)**: PASS. No exception entries required in
Complexity Tracking.

**Re-check after Phase 1**: PASS. Phase 1 artefacts (`data-model.md`,
`contracts/`, `quickstart.md`) introduce no new files outside the four
listed under Project Structure, no new dependencies, no NgModules, no RxJS
patterns. Constitution remains green.

## Project Structure

### Documentation (this feature)

```text
specs/001-live-data/
├── plan.md              # This file
├── spec.md              # Feature spec (with Clarifications session 2026-05-15)
├── research.md          # Phase 0 — resolved unknowns + design decisions
├── data-model.md        # Phase 1 — internal domain types
├── contracts/           # Phase 1 — what we require from each source endpoint
│   ├── espn-scoreboard.contract.md
│   ├── espn-standings.contract.md
│   ├── espn-summary.contract.md
│   └── openfootball-fallback.contract.md
├── quickstart.md        # Phase 1 — run, smoke test, fallback flip procedure
└── tasks.md             # Generated by /speckit-tasks (NOT by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── index.html              # unchanged
├── main.ts                 # unchanged
├── styles.scss             # unchanged
└── app/
    ├── app.component.ts    # refactored: inject LiveDataService, render section states
    ├── app.component.html  # updated: loading / error states, per-section Refresh, inline expander
    ├── app.component.scss  # updated: loading / error / expander styles
    └── data/
        ├── live-data.config.ts     # FR-008 single config: { active, primary, fallback, timeoutMs }
        ├── live-data.types.ts      # internal domain types (Tournament, Group, Match, MatchEvent, BracketSlot, SectionState<T>)
        ├── espn.ts                 # raw ESPN payload types + boundary mappers
        └── live-data.service.ts    # Injectable, providedIn:'root'; signal state per section; fetch + abort helpers

# Deleted on merge (FR-003):
src/app/tournament.data.ts
```

**Structure Decision**: Stay inside the existing single-project Angular
workspace (Constitution §Technology constraint). All new code lives under
`src/app/data/`. The existing `app.component.*` files are modified in
place; no new top-level views, no new sub-routes (US4 surface is an inline
expander per Clarifications §2). Four new files; one deletion.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitutional gates required justification. This table is intentionally
empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

