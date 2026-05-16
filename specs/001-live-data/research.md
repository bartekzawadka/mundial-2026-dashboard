# Phase 0 — Research

Resolves the open technical questions before design. Each topic ends with
a decision that the plan and downstream artefacts commit to. Per
`/speckit-clarify` session 2026-05-15, all spec-level ambiguities are
already resolved; the items below are plan-level design choices.

## R1 · ESPN public `fifa.world` endpoint family

**Question**: Do the four URLs listed in `spec.md` (DS-A) actually serve
FIFA 2026 men's World Cup data with the expanded 48-team / 12-group / R32
structure?

**Findings**: The `site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/*`
family is ESPN's public scoreboard for the FIFA World Cup competition.
It has historically served the 2018 and 2022 tournaments (32-team format)
and is the same URL family ESPN's own embedded scoreboards consume. The
`fifa.world` league slug is stable across editions; group letters A–L and
the R32 stage are represented as `season.type` / `week.number` values
within the same response shape used for previous tournaments. The exact
field-by-field mapping is confirmed at implementation time by hitting
`…/scoreboard?dates=20260611-20260719` and inspecting
`events[].competitions[0].competitors[]`.

**Decision**:
- Primary base URL: `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world`
- Endpoints used: `/scoreboard`, `/standings`, `/summary?event={id}` —
  i.e., FR-001 (a) composition + (b) standings via `/standings`; (c)
  fixtures + scores via `/scoreboard`; (d) bracket via `/scoreboard`
  filtered by `season.type` (knockout); (e) per-match timeline via
  `/summary?event={id}`. The `/teams` endpoint is not separately
  consumed — team metadata appears inline in scoreboard and standings
  responses.
- The scoreboard endpoint accepts `?dates=YYYYMMDD-YYYYMMDD`; without it
  ESPN defaults to "today's matches." The dashboard MUST pass
  `?dates=20260611-20260719` so a single request returns the whole
  tournament.

**Rationale**: One tournament-wide call beats per-day pagination; 39 days
of fixtures fit comfortably in one JSON payload. Matches FR-001 plus
SC-002 (5 s eager budget).

**Alternatives considered**:
- Per-day calls (39 requests on every page load): rejected — burns the
  SC-002 budget on round-trip overhead.
- Per-group separate calls: rejected — ESPN does not expose group-scoped
  endpoints; standings is one call covering all 12 groups.

## R2 · ESPN bracket structure source

**Question**: Does ESPN's `fifa.world` family include a knockout bracket
structure with placeholder labels (per Clarifications §5: "Winner Group A",
"3B/E/F"), or is a separate endpoint required?

**Findings**: ESPN's scoreboard payload tags each event with
`competitions[0].seasonType` and `competitions[0].notes[].headline`
strings. For knockout matches before group standings finalize, the
competitor entries carry `team.displayName` values like
`"Winner Group A"` or `"Runner-up Group B"` instead of a concrete team
identifier. Once the bracket is drawn (typically the morning after the
last group MD3 match) ESPN overwrites those labels with concrete teams.
Past tournaments (2018, 2022) followed this pattern reliably.

**Decision**: The knockout bracket is derived from `/scoreboard` filtered
by `season.type === 3` (postseason / knockout). No separate `/bracket` or
`/draws` endpoint is required. The text in `competitor.team.displayName`
is the source-verbatim placeholder label per Clarifications §5. When
that field is absent for a slot, the slot renders as `empty` per the
Bracket slot entity.

**Rationale**: Reuses a single endpoint; matches Clarifications §5
("verbatim from source; no client synthesis").

**Alternatives considered**:
- A hypothetical `/bracket` endpoint: not documented for `fifa.world`;
  rejected.
- Client-side derivation of placeholder pairings from group standings
  + a static FIFA-rules map: rejected by Clarifications §5.

## R3 · ESPN match timeline (`/summary?event={id}`)

**Question**: What event types appear in the summary endpoint? Are they
sufficient for the seven categories US4 requires (kickoff, goal, yellow
card, red card, substitution, half-time, full-time)?

**Findings**: ESPN summary responses include `plays[]` and `commentary[]`
arrays. Each play carries `clock.displayValue` (minute string),
`type.text` (e.g., `"Goal"`, `"Yellow Card"`, `"Substitution"`),
`period.number`, `team.id`, and `participants[].athlete.displayName`.
Half-time and full-time markers appear as plays with type values like
`"End of First Half"` and `"End of Regulation"`.

**Decision**: Map ESPN's `plays[]` entries to the domain `MatchEvent`
type. The seven event-type values in the spec are covered. Anything
ESPN emits that does not match those seven maps to a generic `'info'`
event so the timeline renders robustly when ESPN adds new play types
(graceful degradation rather than section-wide error, per Edge Case
"Source schema drift" interpreted at the *event* granularity).

**Rationale**: Strict whitelisting would brittle the timeline against
ESPN evolutions. The `'info'` fallback preserves chronology and minute
display without claiming a semantic type the source did not provide.

**Alternatives considered**:
- Strict whitelist with drop-on-unknown: rejected — too brittle.
- Commentary-text fallback: rejected — commentary is free-form and not
  always populated, especially for lower-profile matches.

## R4 · CORS posture of `site.api.espn.com`

**Question**: Will browser requests to ESPN succeed from the dashboard's
origin without a proxy?

**Findings**: ESPN's `site.api.espn.com` responds with
`Access-Control-Allow-Origin: *` on the public scoreboard, standings,
and summary endpoints. There is no documented authentication; the host
is the same one ESPN uses to power its own embedded scoreboards on
third-party media sites.

**Decision**: Browser-direct `fetch()` is the call path. No CORS proxy.
No Cloudflare worker. No nginx pass-through. Matches FR-006 (CORS-
permissive) and FR-007 (no secrets); keeps the architecture inside
the constitutional "no backend" envelope.

**Risk and mitigation**: If ESPN changes posture mid-tournament, the
per-section error state activates correctly (FR-010) and the operator
flips to fallback DS-B by editing `live-data.config.ts` per
Clarifications §4. Procedure documented in `quickstart.md`.

## R5 · OpenFootball fallback (DS-B)

**Question**: Does the OpenFootball 2026 dataset exist with sufficient
detail to serve as a config-flip fallback?

**Findings**: The `openfootball/world-cup.json` repository at
`master/2026/` holds `worldcup.json` (consolidated), `worldcup.groups.json`
(composition), and `worldcup.knockout.json` (bracket). The repo is
community-maintained; commit cadence during the tournament is typically
end-of-matchday, sometimes longer. Fields cover team names, group codes,
fixtures with date + wall-clock time + venue, and group winners after MD3.
There are no live in-progress scores, no per-match event timelines.

**Decision**: DS-B URLs live in `live-data.config.ts` but are not
touched at runtime. The operator-only fallback procedure is documented
in `quickstart.md`. The OpenFootball mapper ships as `src/app/data/
openfootball.ts` exporting the same function signatures as `espn.ts`
but each function body throws
`Error('openfootball mapper not implemented — flip requires authoring this file')`.
Pre-building a full DS-B mapper that is never executed at runtime is
YAGNI per Constitution III. The signature stub keeps the type system
aware of the contract so a future flip is mechanical to implement.

**Capability gaps after flip** (documented for the operator):
- No live in-progress scores; matches in progress render as
  `scheduled` until DS-B's next commit.
- No timelines — US4 reverts to "events not yet available" universally.
- Wall-clock kickoff times need a venue → IANA-zone table to map to
  UTC; this small table is authored at flip time.

**Alternatives considered**:
- Ship a full DS-B mapper now: rejected as premature.
- Drop DS-B entirely from config: rejected — Clarifications §1 retains
  it as the operator's escape hatch.

## R6 · HTTP layer — Angular `HttpClient` vs native `fetch`

**Question**: Which HTTP API best fits a signals-first, no-RxJS-pattern
data layer?

**Findings**: Angular's `HttpClient` returns RxJS `Observable`s, which
needs a `toSignal()` bridge or manual subscription to land in the
signals-first style mandated by Constitution Principle I. Native
`fetch()` returns a `Promise`, which converts trivially to a signal via
an `async` function that writes to `signal<SectionState<T>>`.
`AbortController` provides the per-request timeout (FR-011) without
dependencies.

**Decision**: Use native `fetch()` + `AbortController`. Do NOT add
`provideHttpClient` to bootstrap. Do NOT depend on RxJS for the fetch
path (RxJS remains in `package.json` as an Angular peer dep but is not
imported by feature code).

**Rationale**: Fewer moving parts, no RxJS↔signal bridge, smaller bundle.
Matches Constitution Principles I + III.

**Alternatives considered**:
- `HttpClient` + `toSignal`: rejected — extra ceremony for no
  functional gain.
- A first-class fetch wrapper utility: rejected for now — there is
  exactly one call site (`live-data.service.ts`), so an abstraction
  would violate the "at least two real call sites" rule in
  Constitution Principle III.

## R7 · Section state shape

**Question**: How should each section's state be expressed so that
loading / populated / error are all visually distinct (FR-014, FR-015)
and exhaustiveness is type-checked?

**Decision**: A discriminated-union signal per section:

```ts
export type SectionState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T; fetchedAt: number }
  | { status: 'error'; message: string };
```

The template uses `@switch (state().status)` to render the three visual
states. Each section's signal is held inside `LiveDataService`;
`app.component.ts` consumes them via direct read or `computed()`
derivations.

**Rationale**: Discriminated unions make exhaustive rendering checkable
by the TS compiler. Matches Constitution Principle II.

## R8 · Time-zone display (resolves FR-013 ambiguity)

**Question**: FR-013 reads "the IANA / abbreviation visible next to the
time." Show the full IANA name (`America/Los_Angeles`) or the short
abbreviation (`PST`)?

**Decision**: Short abbreviation. Built with
`new Intl.DateTimeFormat(undefined, { timeZoneName: 'short', dateStyle: 'medium', timeStyle: 'short' })`.
Example output: `Jun 11, 2026, 4:00 PM PST`.

**Rationale**: Match-row real estate is small; "PST" or "CET" fits
inline whereas `America/Los_Angeles` wraps awkwardly. Sports apps
conventionally show the abbreviation. The `Intl` API derives the
abbreviation from the user's actual IANA zone, so there is no manual
mapping table to maintain. Constitution Principle IV (responsive
design) prefers compact strings on mobile widths.

## R9 · Eager fetch parallelism

**Question**: Should the three eager fetches (standings, scoreboard for
fixtures + scores, scoreboard filtered for bracket) be parallel or
sequential? Are scoreboard and bracket two separate requests or one?

**Decision**: Two `fetch` calls in parallel via `Promise.all`:
`/standings` and `/scoreboard?dates=20260611-20260719`. The bracket is
derived from the same `/scoreboard` response by filtering events with
`season.type === 3`; it does not require its own HTTP call. Each
section's `SectionState` settles independently — a failure in
`/standings` does not block `/scoreboard` from populating its two
dependent sections (matches + bracket), per FR-010 "other sections
that did succeed MUST remain rendered."

**Rationale**: Two independent endpoints → parallel. Single `/scoreboard`
covers both fixtures and bracket → one network call serves two UI
sections. SC-002's 5 s budget is comfortably met.

## R10 · Inline expander UX (US4)

**Question**: One match expanded at a time (accordion) or many
(multi-expand)?

**Decision**: Accordion. Single open match per tab. Expanding a new
row collapses any previously open row in the same tab. Persists the
open-match identity in a signal local to the component (not in
storage — FR-002).

**Rationale**: Matches the user's mental model (focus on one match at
a time), bounds lazy-fetch concurrency (at most one in-flight
`/summary?event={id}` request), and simplifies accessibility semantics
(only one `aria-expanded="true"` at a time).

## R11 · Pre-tournament rendering (Edge Case)

**Question**: Today is 2026-05-15. The tournament starts 2026-06-11.
How does the page render when `/scoreboard?dates=20260611-20260719`
returns events with no scores and `/standings` returns 0-played rows?

**Decision**: The same renderer code paths handle empty/zero values
naturally — a `StandingRow` with `played: 0, points: 0` renders to a
zero-point row; a `Match` with `status: 'scheduled'` renders to the
scheduled state (kickoff date only). No special "pre-tournament" mode
is needed in the renderer. The hero `pill` text "Starts June 11, 2026"
in `app.component.html` is already present and remains accurate.

**Rationale**: Avoid mode flags; the data itself describes the state.
Matches Edge Case "Pre-tournament window" and US1 Acceptance Scenario 3.

## R12 · Loading indicator on subsequent Refresh

**Question**: When a user clicks the per-section Refresh button on a
section that is already in `success` state, does the section flash
back to a full loading skeleton or display an inline "refreshing"
indicator while keeping the stale data visible?

**Decision**: Keep the stale data visible and overlay an inline
"refreshing" indicator (a small spinning glyph next to the Refresh
button label). FR-015 requires a distinct loading state but does not
mandate clearing the populated content; flashing back to skeleton on a
manual refresh creates a worse perceived experience than overlay.
First-load (`idle` → `loading`) still uses the full skeleton because
there is no stale data to keep.

**Rationale**: Better UX with no spec conflict. The state machine in
R7 supports this — the component can read `status === 'loading' &&
previousData != null` to choose the overlay variant. Implemented by
keeping the previous `success.data` in a sibling signal that lives
across status transitions.

