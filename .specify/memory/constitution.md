<!--
SYNC IMPACT REPORT
==================
Version change: 0.0.0 (template) → 1.0.0
Bump rationale: MAJOR — initial ratification; placeholders replaced with concrete principles.

Modified principles:
  - [PRINCIPLE_1_NAME] → I. Standalone Angular & Signals-First
  - [PRINCIPLE_2_NAME] → II. Strict TypeScript & Type Safety
  - [PRINCIPLE_3_NAME] → III. Simplicity & YAGNI (NON-NEGOTIABLE)
  - [PRINCIPLE_4_NAME] → IV. Responsive, Accessible UI
  - [PRINCIPLE_5_NAME] → V. Reproducible Builds & CI Parity

Added sections:
  - Technology & Platform Constraints (was [SECTION_2_NAME])
  - Development Workflow & Quality Gates (was [SECTION_3_NAME])

Removed sections: none

Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no change required (Constitution Check
    block already delegates gates to this file generically)
  - .specify/templates/spec-template.md ✅ no change required (no principle-named
    sections present)
  - .specify/templates/tasks-template.md ✅ no change required (task categories
    align with principles; testing remains optional per template guidance)
  - README.md ✅ no change required (stack description already consistent)
  - CLAUDE.md ✅ no change required (delegates to plan)

Deferred items:
  - TODO(RATIFICATION_DATE): set to 2026-05-15 by default; confirm with project
    owner whether an earlier date should be backdated to actual project start.
-->

# Mundial 2026 Dashboard Constitution

## Core Principles

### I. Standalone Angular & Signals-First

The application MUST be built with Angular standalone components — no `NgModule`
declarations. All reactive UI state MUST use `signal()` / `computed()` /
`effect()` rather than ad-hoc class fields or RxJS `BehaviorSubject` patterns.
Third-party UI component frameworks (Material, PrimeNG, Bootstrap, Tailwind,
etc.) MUST NOT be introduced; styling is hand-authored SCSS. Rationale: the
stack is deliberately minimal so the dashboard stays small, fast, and easy to
reason about; signals are the framework-native primitive for v17+ Angular and
keep change detection predictable.

### II. Strict TypeScript & Type Safety

TypeScript MUST run in strict mode. Public surfaces of components and helper
modules MUST declare explicit types for inputs, outputs, and return values.
`any` is forbidden except at clearly documented boundaries (e.g., untyped
third-party APIs), and any such use MUST carry a one-line comment explaining
why a narrower type is not possible. Rationale: a typed surface is the cheapest
form of documentation and the most effective regression guard given the
project does not currently maintain an automated test suite.

### III. Simplicity & YAGNI (NON-NEGOTIABLE)

Features MUST be implemented at the smallest scope that satisfies the
requirement. Premature abstractions (generic services, dependency-injection
indirection, configuration layers, plugin systems) are forbidden until at
least two real call sites demand them. Static data (groups, fixtures, points)
lives in dedicated `*.data.ts` modules until a real backend is wired; do not
introduce a data-access layer to "prepare" for one. Rationale: this is a
focused SPA; abstractions added "for later" almost always become churn.

### IV. Responsive, Accessible UI

Layouts MUST work without horizontal scroll from 360 px viewport width up.
Markup MUST be semantic (use `<button>`, `<nav>`, headings in order, etc.);
interactive controls MUST be reachable and operable via keyboard. Color
choices MUST meet WCAG 2.1 AA contrast for text and essential UI. Rationale:
the dashboard is public-facing and consumed on phones during matches; broken
mobile or keyboard support is a real defect, not a polish item.

### V. Reproducible Builds & CI Parity

The Docker build defined by `Dockerfile` MUST be the canonical production
build: any change that makes `docker build .` fail or diverge from the local
`npm run build` artifact is a release blocker. The GitHub Actions workflow
(`.github/workflows/docker-build.yaml`) MUST run on every PR targeting `main`
and MUST pass before merge. Manual, machine-specific build steps MUST NOT be
required to ship. Rationale: container parity is the only check that catches
"works on my laptop" regressions in a project without a test suite.

## Technology & Platform Constraints

- Runtime stack: Angular 21.x, TypeScript ~5.9, RxJS 7.8, Node.js 20 (Alpine)
  for build, nginx 1.27 (Alpine) for serving. Major-version bumps to any of
  these are treated as constitutional amendments (see Governance).
- Package manager: npm with the committed `package-lock.json`. Lockfile MUST
  be committed alongside any dependency change.
- Source layout: single-project Angular workspace rooted at `/src`. Adding a
  second workspace project, a monorepo tool, or a backend service requires a
  constitutional amendment.
- Analytics & telemetry: the Angular CLI analytics flag is `false` and MUST
  remain so. No third-party analytics, tag managers, or trackers may be added
  to the production bundle.
- Assets and static data are committed to the repo (`/public`, `*.data.ts`).
  External fetches at runtime are out of scope until a data-service
  integration is explicitly planned.

## Development Workflow & Quality Gates

- All changes land via pull request to `main`. Direct pushes to `main` are
  forbidden except for repo-hygiene commits (license, README typos).
- A PR MUST be reviewed and approved by at least one other contributor before
  merge. Solo merges are permitted only when no other contributor is available
  within 48 hours and the change is non-functional (docs, formatting).
- CI status checks defined in `.github/workflows/` MUST be green before merge.
- For any change touching component templates, styles, or layout, the author
  MUST manually verify the affected view in a browser (desktop + a 375 px
  mobile viewport) before requesting review. "Type-checks and builds" is not
  sufficient evidence that UI works.
- Commit messages SHOULD describe the *why* (motivation, constraint) and not
  only the *what*. One-line subject + optional body is fine.
- Generated files (`node_modules/`, `dist/`, `.angular/cache/`) MUST stay out
  of commits; `.gitignore` is the source of truth.

## Governance

This constitution supersedes ad-hoc conventions and code-review opinions; when
they conflict, the constitution wins or the conflicting rule must be amended
here first.

Amendments require:

1. A PR modifying `.specify/memory/constitution.md` with a Sync Impact Report
   prepended as an HTML comment (version delta, modified/added/removed
   principles, template impact, deferred TODOs).
2. Review approval from at least one contributor other than the author.
3. A version bump following semantic versioning:
   - **MAJOR**: removing a principle, redefining a principle in a backward
     incompatible way, or removing/replacing a governance rule.
   - **MINOR**: adding a new principle or materially expanding the scope of
     an existing one.
   - **PATCH**: wording, clarification, typo, or non-semantic refinement.

Every PR description MUST state whether the change touches constitutional
concerns (build/CI, dependency majors, accessibility, signals/standalone
posture) so reviewers can verify compliance. Unjustified violations are a
review blocker; justified exceptions MUST be recorded in the PR description
and, if recurring, promoted to a constitutional amendment.

Runtime development guidance for AI assistants and human contributors lives
in `CLAUDE.md` and the current feature plan under `specs/<feature>/plan.md`;
those documents elaborate but never override this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-05-15 | **Last Amended**: 2026-05-15
