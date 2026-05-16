---
description: "Task list for Live Tournament Data (001-live-data)"
---

# Tasks: Live Tournament Data

**Input**: Design documents from `/specs/001-live-data/`

**Prerequisites**: plan.md, spec.md (clarified 2026-05-15), research.md, data-model.md, contracts/

**Tests**: NONE. Per plan.md §Testing and Constitution Principle II rationale, this feature has no automated test suite. Verification is manual per `quickstart.md` (desktop + 375 px mobile) and per-story Independent Test from `spec.md`.

**Organization**: Tasks are grouped by user story (P1 → P4) so each story can be implemented and validated independently. MVP = US1.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Different file, no dependency on incomplete tasks → safe to run in parallel
- **[Story]**: User story label (US1, US2, US3, US4) on per-story tasks only

## Path Conventions

Single-project Angular workspace. All new code lives under `src/app/data/`; UI changes are made in place to `src/app/app.component.{ts,html,scss}`. No `tests/` directory is created.

```text
src/app/
├── app.component.ts            # MODIFIED: inject LiveDataService, drop GROUPS import
├── app.component.html          # MODIFIED: section state @switch shells, inline expander
├── app.component.scss          # MODIFIED: loading/error/refreshing/expander styles
├── data/
│   ├── live-data.config.ts     # NEW (FR-008)
│   ├── live-data.types.ts      # NEW (data-model.md)
│   ├── espn.ts                 # NEW (raw payload types + 4 mappers)
│   ├── openfootball.ts         # NEW (stub, throws — research §R5)
│   └── live-data.service.ts    # NEW (Injectable, providedIn:'root')
└── tournament.data.ts          # DELETED on merge (FR-003)
```

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the workspace is in a clean state and create the per-feature directory.

- [x] T001 Verify `npm install` succeeds and `npm run start` boots the current placeholder app at `http://localhost:4200` against the in-repo `tournament.data.ts`; record baseline so regressions are obvious after the refactor.
- [x] T002 [P] Verify `package.json` declares Angular 21.2.x with standalone-component support and that **no new runtime dependency** is needed (native `fetch` + `AbortController` only, per plan.md §Primary Dependencies and research §R6); do **not** add `provideHttpClient`, do **not** import RxJS in feature code.
- [x] T003 [P] Create the empty directory `src/app/data/` (single `mkdir -p`); confirm no existing files inside.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Stand up the four new files exactly as listed in plan.md §Project Structure plus the fallback stub, refactor `app.component.ts` to inject `LiveDataService`, and delete `tournament.data.ts` (FR-003). After this phase every user story can be implemented against a complete type system and a working service skeleton.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Type system, config, raw-payload boundary (parallel — different files)

- [x] T004 [P] Create `src/app/data/live-data.types.ts` containing every internal domain type listed in `data-model.md`: `TournamentPhase`, `Tournament`, `Confederation`, `GroupCode`, `Team`, `Group`, `StandingRow`, `MatchStatus`, `Stage` (discriminated union: `group` / `r32` / `r16` / `qf` / `sf` / `final`), `Score`, `MatchSide` (exactly one of `team` or `placeholderLabel`), `Match`, `MatchEventType` (`kickoff` / `goal` / `yellow-card` / `red-card` / `substitution` / `half-time` / `full-time` / `info`), `MatchEvent`, `BracketRound`, `BracketOccupant` (discriminated union: `team` / `placeholder` / `empty`), `BracketSlot`, and `SectionState<T>` (discriminated union: `idle` / `loading` / `success` with `data` + `fetchedAt: number` / `error` with `message`). Strict TS, no `any`, all types `readonly`-leaning where appropriate.

- [x] T005 [P] Create `src/app/data/live-data.config.ts` exporting a single `LiveDataConfig` const with shape `{ active: 'primary' | 'fallback'; primary: { scoreboard: string; standings: string; summary: (eventId: string) => string }; fallback: { worldcup: string; groups: string; knockout: string }; timeoutMs: number }`. Populate `primary` with the three ESPN endpoints from spec.md §Data sources (use the `?dates=20260611-20260719` query parameter on `scoreboard` per research §R1); populate `fallback` with the three OpenFootball raw.githubusercontent.com URLs from spec.md §Data sources; set `active: 'primary'`, `timeoutMs: 10000` (FR-011). Add a top-of-file comment noting that fallback URLs are config-only per Clarifications §4 and are never contacted at runtime.

- [x] T006 [P] Create `src/app/data/espn.ts` with the raw ESPN payload TypeScript interfaces only (no mappers yet — mappers ship per-story in Phases 3–6). Required raw types: `RawScoreboardResponse` (`{ events: RawScoreboardEvent[] }`), `RawScoreboardEvent` (with `id`, `date`, `status.type.state`, `season.type`, `week?.number`, `notes?: { headline: string }[]`, `competitions: [{ venue: { fullName; address: { city } }, competitors: RawCompetitor[] }]`), `RawCompetitor` (`{ homeAway, team: { id, displayName, abbreviation }, score? }`), `RawStandingsResponse` (`{ children: RawStandingsGroup[] }`), `RawStandingsGroup` (`{ name; standings: { entries: RawStandingEntry[] } }`), `RawStandingEntry` (`{ team: { id, displayName, abbreviation }, stats: { name: string; value: number }[] }`), `RawSummaryResponse` (`{ plays: RawSummaryPlay[] }`), `RawSummaryPlay` (`{ id, clock: { displayValue }, period: { number }, type: { text }, team?: { id }, participants?: { athlete: { displayName } }[], text }`). Field shapes MUST match `contracts/espn-scoreboard.contract.md`, `contracts/espn-standings.contract.md`, and `contracts/espn-summary.contract.md` exactly. Also add a `flagFromAbbreviation(abbr: string): string` helper that converts a 2- or 3-letter ESPN abbreviation to a regional-indicator emoji (returns `''` when the code is missing or non-ISO-2 — degradation, not error).

- [x] T007 [P] Create `src/app/data/openfootball.ts` as a typed stub per research §R5 and `contracts/openfootball-fallback.contract.md`. Export three function signatures: `mapWorldCupToMatches(raw: unknown): Match[]`, `mapWorldCupGroupsToGroups(raw: unknown): Group[]`, `mapWorldCupKnockoutToBracket(raw: unknown): BracketSlot[]`. Each body throws `new Error('openfootball mapper not implemented — flip requires authoring this file')`. File-level JSDoc comment explains: config-only fallback, never contacted at runtime, flip procedure is documented in `specs/001-live-data/quickstart.md`. Import domain types from `./live-data.types`.

### Service scaffolding (depends on T004, T005, T006)

- [x] T008 Create `src/app/data/live-data.service.ts` as `@Injectable({ providedIn: 'root' })` with: (a) imports from `./live-data.types`, `./live-data.config`, `./espn`; (b) one writable `signal<SectionState<...>>({ status: 'idle' })` per section — `standingsState` (`Group[]`), `matchesState` (`Match[]`), `bracketState` (`BracketSlot[]`), and a `timelineStateByMatchId = signal<Map<string, SectionState<MatchEvent[]>>>(new Map())`; (c) parallel `previousStandings`, `previousMatches`, `previousBracket` signals holding the last `success.data` to support the "keep stale visible during Refresh" pattern from research §R12; (d) a private `fetchWithTimeout<T>(url: string): Promise<T>` helper using native `fetch` + `AbortController` with `LiveDataConfig.timeoutMs` (FR-011) that resolves to parsed JSON or rejects with a typed `Error`; (e) a private `runSection<T>(stateSignal, previousSignal, fetcher: () => Promise<T>): Promise<void>` helper that transitions the signal `idle/success → loading` (preserving previousData), awaits, and writes either `{ status: 'success', data, fetchedAt: Date.now() }` or `{ status: 'error', message }`. No section-specific fetchers yet — those ship per user story.

### Component refactor + cleanup (depends on T008)

- [x] T009 Refactor `src/app/app.component.ts`: replace `import { GROUPS } from './tournament.data'` with constructor `inject(LiveDataService)`; remove the `groups`, `filteredGroups`, `rounds`, `points`, and `query`/`updateQuery` placeholder members; expose `protected readonly liveData = inject(LiveDataService)`; keep `activeView` and `setView`; keep `stats` (static page chrome) and the hero `pill` text "Starts June 11, 2026" (research §R11). Imports list keeps `NgClass`; no `HttpClient`, no `provideHttpClient`.

- [x] T010 Replace the body of `src/app/app.component.html` with a section-scaffolded shell: hero block (unchanged copy), tabs (Group dashboard / Elimination ladder, controlled by `activeView()`), and **four empty `@switch (state().status)` blocks** — one for `standingsState`, `matchesState`, `bracketState`, and a placeholder slot for per-match `timelineState`. Each `@switch` MUST have all four cases stubbed (`idle`, `loading`, `error`, `success`) even if the inner template is `<!-- US? populates -->`. Each section MUST render an always-visible per-section "Refresh" `<button>` outside the `@switch` (FR-004), with section-scoped `aria-label` (e.g., `aria-label="Refresh group standings"`). Live regions: standings + matches use `aria-live="polite"`. No global "Refresh All" button anywhere.

- [x] T011 [P] Add base section-state CSS in `src/app/app.component.scss`: `.section--loading` skeleton (visually distinct per FR-015), `.section--error` (concise message, retry posture), `.section--refreshing` overlay (small inline spinner adjacent to the Refresh label, retains underlying populated content per research §R12), `.section__refresh-btn` (always visible across all states, focus ring). Preserve existing hero / tab / responsive 360 px breakpoint styles.

- [x] T012 Delete `src/app/tournament.data.ts` (FR-003). Confirm `grep -rn "tournament.data" src/` returns no matches and `npm run build` succeeds with the placeholder shells from T010 (renderer will show all sections as `idle` / `loading` until US1+ wire in section fetchers).

**Checkpoint**: Foundation ready. Service skeleton compiles, sections render as empty `idle` states with always-visible Refresh buttons, `tournament.data.ts` is gone. User stories can now proceed.

---

## Phase 3: User Story 1 — See current group standings on page load (Priority: P1) 🎯 MVP

**Goal**: On every page load, all twelve group cards show live standings (team list ordered by current position with played / W / D / L / GF / GA / GD / points) fetched from ESPN's `/standings`. No bundled data, no client-side persistence (FR-001, FR-002). Per-section Refresh affordance always visible and doubles as Retry on error (FR-004, FR-010).

**Independent Test** (per `spec.md` US1): Open the site in a browser during/after a matchday. Verify each group card shows live standings (order, points, GD, played) matching the official FIFA 2026 tables; reload after a result changes and verify the new values appear; storage audit (`localStorage`, `sessionStorage`, `indexedDB.databases()`, `caches.keys()`) is empty.

### Implementation for US1

- [x] T013 [US1] Implement `mapStandings(raw: unknown): Group[]` in `src/app/data/espn.ts` per `contracts/espn-standings.contract.md`. Validate root is `{ children: array of 12 entries matching /^Group ([A-L])$/ }` — throw on root or cardinality mismatch (section transitions to `error` per drift behaviour). For each child: extract `code` from the regex capture; build the four `Team` entries from `entries[].team` (`id`, `name`, `flag` via `flagFromAbbreviation(team.abbreviation)`, `confederation: 'unknown'` for now, `groupCode`, `seed` = `rank` value); build the four `StandingRow` entries by reading `stats[]` by `name`. Stat lookup MUST accept both `ties` and `draws` keys for draws (contract: "Mapper tolerates either"). Missing non-rank stats default to `0` with `console.warn`. Order each group's `standings` array by `position` ascending (`teams` array order mirrors `standings`).

- [x] T014 [US1] In `src/app/data/live-data.service.ts`, add `public async refreshStandings(): Promise<void>` that calls `runSection(this.standingsState, this.previousStandings, async () => mapStandings(await fetchWithTimeout(LiveDataConfig.primary.standings)))`. Add `private kickOffEagerLoads()` invoked once in the constructor that fires `void this.refreshStandings();` (matches + bracket are added by US2/US3 — keep this method as the central place to add them).

- [x] T015 [US1] In `src/app/app.component.html`, fill the `standingsState` `@switch` cases: `@case ('loading')` → 12 skeleton group cards (use a static `[].constructor(12)` or inline literal length); `@case ('error')` → error panel with state's `message`; `@case ('success')` → iterate `state().data` as `@for (group of …; track group.code)`, render group card with header `Group {{ group.code }}` and a table of four rows showing `position`, flag + name, `played`, `wins`, `draws`, `losses`, `goalsFor`, `goalsAgainst`, `goalDifference`, `points`. The "refresh in progress while previously populated" affordance reads `state().status === 'loading' && liveData.previousStandings()` and renders the previous group cards underneath an overlay (research §R12). The standings section header includes the always-visible Refresh button calling `liveData.refreshStandings()`.

- [x] T016 [P] [US1] Style the standings section in `src/app/app.component.scss`: group card grid (1 col mobile ≤360 px, 2/3/4 cols on wider widths, matching existing breakpoint behaviour kept from current placeholder), table row hover/focus, position pill, points emphasis. Loading skeleton variant (`.group-card--skeleton`) with shimmer. Error variant (`.group-card--error`). All styles WCAG AA contrast (Constitution Principle IV).

- [x] T017 [US1] Manual verification per `quickstart.md` §1 (loading state), §2 (populated), §3 (per-section Refresh keeps stale visible), §7 (error path: block `/standings` in DevTools → error state appears, click Refresh retries, unblock → recovers), §8 (pre-tournament 0/0 rows render without error). Run on desktop **and** 375 × 812 px mobile viewport per plan.md §Testing.

**Checkpoint**: US1 fully functional and independently deployable as the MVP. Group standings load live on every page open, Refresh works, error isolation works. Matches and bracket remain `idle` (US2/US3 not yet shipped) but the page chrome and standings section work end-to-end.

---

## Phase 4: User Story 2 — See match schedule and results (Priority: P2)

**Goal**: Each group card shows its three matchday matches; finished matches show final score, in-progress matches show running score with a visible "live" indicator and `aria-live="polite"`, scheduled matches show local-zone kickoff time with short zone abbreviation. Schedule + scores fetched from ESPN's `/scoreboard` in parallel with standings (research §R9). A small in-page hint informs users that scores are point-in-time and a reload is needed for updates (Edge Case "In-progress match score change").

**Independent Test** (per `spec.md` US2): Compare three match rows under every group card against the official fixture list. Completed → final score; in-progress → running score + live indicator; upcoming → local-zone kickoff time with zone abbreviation visible.

### Implementation for US2

- [x] T018 [US2] Implement `mapScoreboardToMatches(raw: unknown): Match[]` in `src/app/data/espn.ts` per `contracts/espn-scoreboard.contract.md`. Validate root is `{ events: array }` — throw on shape mismatch. For each event: extract `id`, `kickoffUtc` from `date`, status mapping `pre→scheduled` / `in→live` / `post→finished`, `venue.fullName`, `venue.address.city`, then for each of the two `competitors[]` (sorted by `homeAway`) build a `MatchSide` — if `team.id` is present and `team.displayName` is **not** a placeholder pattern (`/^(Winner|Runner-?up|Loser)\b/i` or `/^[1-4][A-L](\/[A-L])*$/`), set `MatchSide.team` with `flagFromAbbreviation`; otherwise set `MatchSide.placeholderLabel = team.displayName` verbatim (Clarifications §5). Build `Stage`: `season.type === 2` → `{ kind: 'group', group: <from team's groupCode lookup against standings if loaded, else parse from notes/headline>, matchday: week.number as 1|2|3 }`; `season.type === 3` → map `notes[].headline` to `r32`/`r16`/`qf`/`sf`/`final` (case-insensitive prefix). Attach `score` from `competitors[].score` (string-to-int) when status is `live`/`finished`. Drop individual events missing any required field; throw only when ALL events are invalid (contract drift rule).

- [x] T019 [US2] In `src/app/data/live-data.service.ts`, add a private cached `lastScoreboardRaw` field. Add `public async refreshMatches(): Promise<void>` that calls `runSection(this.matchesState, this.previousMatches, …)` where the fetcher fetches `LiveDataConfig.primary.scoreboard`, stores the raw payload on `lastScoreboardRaw`, and returns `mapScoreboardToMatches(raw)`. Update `kickOffEagerLoads()` to also call `void this.refreshMatches();` (runs in parallel with `refreshStandings` — both eagerly fired from constructor per research §R9).

- [x] T020 [US2] In `src/app/app.component.html`, fill the `matchesState` `@switch` cases. Note: matches render **nested inside each group card**, so the matches `@switch` lives inside the group card iteration from US1. For `success`: under each group's `standings` table, render three match rows for the three matchdays — `@for (match of liveData.matchesForGroup(group.code); track match.id)`. Each row shows: matchday chip (`MD1` / `MD2` / `MD3`), kickoff date+time (formatted per T022), home flag + name, score (`–` if `scheduled`, else `H – A`), away flag + name. Add visually distinct classes `.match--scheduled` / `.match--live` / `.match--finished` (FR-014). The live row carries an animated dot + `aria-live="polite"` span reading "Live, {home} {scoreH} {away} {scoreA}" so screen readers pick up live updates on reload. `loading` → 3 skeleton rows per group; `error` → inline notice. Always-visible Refresh button for matches lives at the section header level (top of the Group dashboard tab) calling `liveData.refreshMatches()`.

- [x] T021 [US2] In `src/app/app.component.ts`, add a `protected matchesForGroup(code: GroupCode): Match[]` helper that filters `liveData.matchesState()` when `success` (or `liveData.previousMatches()` when refreshing) by `match.stage.kind === 'group' && match.stage.group === code`, sorted by `(matchday, kickoffUtc)`.

- [x] T022 [US2] In `src/app/app.component.ts`, add a `protected formatKickoff(iso: string): string` helper using `new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'short' }).format(new Date(iso))` (research §R8 — short abbreviation, not IANA name). Example output: `Jun 11, 2026, 4:00 PM PST`. The helper MUST be deterministic for a given (input, browser locale, browser zone) — do not cache values across calls.

- [x] T023 [US2] In `src/app/app.component.html`, add a small in-page hint (subtle banner or footnote under the tabs) reading approximately: "Scores update on each page reload — no automatic refresh." Wire it to render whenever `matchesState().status === 'success'` (or `previousMatches()` is set). Required by Edge Case "In-progress match score change while user is on the page".

- [x] T024 [P] [US2] Style match rows in `src/app/app.component.scss`: `.match-row` base, `.match-row--scheduled` (muted), `.match-row--live` (accent + animated dot, prefers-reduced-motion fallback to static dot), `.match-row--finished` (final-score emphasis). Live dot honours `prefers-reduced-motion`. Mobile layout stacks home/score/away vertically at ≤360 px.

- [x] T025 [US2] Manual verification per `quickstart.md` §2 (eager-load budget — both standings and matches populated within 5 s on unthrottled), §4 mention only (skip timeline part — US4), §5 (time zone correctness — toggle DevTools → Sensors location to Tokyo; reload; times render in JST), §6 (scheduled / live / finished visual distinction). Verify the in-page hint about reload is visible. Re-run mobile viewport at 375 × 812 px.

**Checkpoint**: Standings + match schedule and scores load on every page open in parallel; both sections recoverable independently. Bracket section still `idle` (US3 not yet shipped).

---

## Phase 5: User Story 3 — See the knockout bracket with real teams (Priority: P3)

**Goal**: Elimination ladder tab shows the R32 → R16 → QF → SF → Final bracket populated from ESPN's `/scoreboard` (filtered by `season.type === 3` — research §R2, §R9). Resolved slots show team name + flag; unresolved slots show source-verbatim placeholder labels ("Winner Group A", "3B/E/F"); slots with no source label render empty (Clarifications §5). No separate HTTP request — bracket derives from the same `/scoreboard` response US2 already fetches.

**Independent Test** (per `spec.md` US3): Open the Elimination ladder tab after group stage ends; every R32 slot shows the correct team matchup with kickoff date and host city; after a R32 match is decided, reload and confirm the winner appears in the corresponding R16 slot.

### Implementation for US3

- [x] T026 [US3] Implement `mapScoreboardToBracket(raw: unknown): BracketSlot[]` in `src/app/data/espn.ts` per the bracket portions of `contracts/espn-scoreboard.contract.md` and research §R2. Validate root is `{ events: array }`. Filter to events with `season.type === 3`. Map the round from `notes[].headline` (case-insensitive prefix `Round of 32` → `r32`, `Round of 16` → `r16`, `Quarterfinal`/`Quarter` → `qf`, `Semifinal`/`Semi` → `sf`, `Final` → `final`). Within each round, sort events by `kickoffUtc` to establish a stable `index`. For each event emit **two** `BracketSlot` entries — one for `home`, one for `away`. Each slot's `occupant`: `{ kind: 'team', team }` when the competitor resolves to a real team (same heuristic as T018), `{ kind: 'placeholder', label }` when `team.displayName` is a placeholder pattern (verbatim from source — never synthesize), `{ kind: 'empty' }` when both `team.id` and `team.displayName` are missing. Attach the parent `Match` (built from the same event) to each slot via `match`. Cardinality sanity: per round counts SHOULD be R32=32 / R16=16 / QF=8 / SF=4 / Final=2 — do NOT throw if smaller (early-stage state); only throw if the root shape is wrong.

- [x] T027 [US3] In `src/app/data/live-data.service.ts`, add `public async refreshBracket(): Promise<void>` that runs against `this.bracketState` and reuses `lastScoreboardRaw` when populated within the same session (research §R9 — one /scoreboard fetch fuels both matches and bracket); when `lastScoreboardRaw` is null, fetch it now via the same URL as `refreshMatches`. After refresh, calling `refreshMatches` SHOULD also re-derive and write `bracketState` from the new raw payload (and vice-versa for `refreshBracket`) so the two sections stay coherent — implement this by extracting a private `applyScoreboard(raw)` that updates both signals. Update `kickOffEagerLoads()` constructor wiring: a single `/scoreboard` fetch on construction populates both `matchesState` and `bracketState` (still parallel to `refreshStandings`).

- [x] T028 [US3] In `src/app/app.component.html`, fill the `bracketState` `@switch` inside the Elimination ladder tab (controlled by `activeView() === 'knockout'`). For `success`: render five round columns (R32, R16, QF, SF, Final). Pair each round's slots `(0,1)`, `(2,3)`, … into a single bracket card showing both sides. Each side renders flag + name when `occupant.kind === 'team'`, the verbatim placeholder label when `'placeholder'`, and a dash/empty cell when `'empty'`. Each card shows kickoff date + host city when its `match` is attached (date-only formatted via a new `formatBracketDate(iso)` helper using `Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })` — round-column real estate is tight, omit time). `loading` → skeleton columns. `error` → inline notice. Always-visible Refresh button at the top of the Elimination ladder tab calling `liveData.refreshBracket()`.

- [x] T029 [P] [US3] Style the bracket section in `src/app/app.component.scss`: column layout (horizontal scroll on mobile <600 px, grid on wider), bracket-card with two-side stack, connector lines using CSS `border-right` between rounds (existing placeholder grid uses similar visual — preserve it), placeholder label muted compared to resolved teams, empty cell uses `&ndash;` or similar. R32 card shows date + city as a small footer line.

- [x] T030 [US3] Manual verification: switch to the Elimination ladder tab; for the pre-tournament state, confirm every R32 slot renders the source-supplied placeholder label or empty cell — **no client-synthesized labels** (`grep -rIn "Winner Group\|Runner-up\|Path \|Match [0-9]\|World Champion" src/` returns no string literals in source; placeholders come from data only). Block `/scoreboard` per `quickstart.md` §7 and confirm both matches and bracket sections error together (they share the fetch) while standings stays populated. Confirm Refresh on the bracket re-pulls both bracket and matches.

**Checkpoint**: All three eager sections (standings, matches, bracket) are wired to live data. Page is functional end-to-end on matchday 1. US4 (timelines) is purely additive on top.

---

## Phase 6: User Story 4 — See match timeline for a live match (Priority: P4)

**Goal**: Click any match row (in either the Group dashboard or the Elimination ladder) and the row expands in place to show a chronological event timeline (kickoff, goals, yellow/red cards, substitutions, half-time, full-time) fetched lazily from ESPN's `/summary?event={id}`. Accordion behaviour: at most one match expanded per tab at a time (research §R10). No modal, no sub-route. Per-match Refresh inside the expander.

**Independent Test** (per `spec.md` US4): While a match is in progress, click that match row to expand it; verify events appear chronologically with minute / type / player / team. Reload while a match is live and verify newly-emitted events appear.

### Implementation for US4

- [x] T031 [US4] Implement `mapSummaryToEvents(raw: unknown, matchId: string): MatchEvent[]` in `src/app/data/espn.ts` per `contracts/espn-summary.contract.md`. Validate root is `{ plays: array }` — throw on shape mismatch. For each play: parse `clock.displayValue` into `minute: number` (regex `/^(\d+)(?:\+(\d+))?'?$/` → sum of base + stoppage; round up); read `period.number`; map `type.text` case-insensitive prefix to `MatchEventType` per the contract table (`kick off`/`start of` → `kickoff`; `goal`/`penalty - scored`/`own goal` → `goal`; `yellow card` → `yellow-card`; `red card`/`second yellow` → `red-card`; `substitution` → `substitution`; `end of first half`/`half-time`/`halftime` → `half-time`; `end of regulation`/`full time`/`full-time` → `full-time`; everything else → `info`). Attach `teamId`. Player attribution per contract: goal → `primaryPlayer` = scorer / `secondaryPlayer` = assister; substitution → primary = off / secondary = on; cards → primary = carded player only. Sort returned array by `(period.number, minute)` ascending — mapper enforces the timeline ordering invariant from `data-model.md`.

- [x] T032 [US4] In `src/app/data/live-data.service.ts`, add `public async refreshTimeline(matchId: string): Promise<void>` that runs against the per-match entry of `timelineStateByMatchId`. The method MUST: (a) clone the current `Map`, set the entry to `{ status: 'loading' }` (preserving any previous `success.data` via a parallel `previousTimelineByMatchId` Map for the research §R12 overlay pattern), reassign the signal; (b) call `fetchWithTimeout(LiveDataConfig.primary.summary(matchId))`; (c) on success write `{ status: 'success', data: mapSummaryToEvents(raw, matchId), fetchedAt }`; on error write `{ status: 'error', message }`. Empty `plays[]` is NOT an error — per the contract, it surfaces as `success` with `data: []` and the template renders an empty-state message based on the parent match's status.

- [x] T033 [US4] In `src/app/app.component.ts`, add an `expandedMatchId = signal<string | null>(null)` and a `protected toggleExpand(matchId: string): void` method: if equal to current, set to `null`; else set to `matchId` and (if no timeline state yet for this match) call `liveData.refreshTimeline(matchId)`. The single signal is reused across both tabs — since only one tab is visible at a time and the user can only interact with one tab's rows, the accordion semantic ("one open per tab" — research §R10) is satisfied by a single signal. (If the user switches tabs, the in-flight `expandedMatchId` may still belong to the previous tab; collapse it on `setView` to be safe — update `setView` to also call `expandedMatchId.set(null)`.)

- [x] T034 [US4] In `src/app/app.component.html`, convert match rows in **both** the Group dashboard match list (under each group card from T020) and the bracket cards (each side or each card from T028) into clickable `<button type="button">` elements with `aria-expanded="{{ expandedMatchId() === match.id }}"`, `aria-controls="timeline-{{ match.id }}"`, and `(click)="toggleExpand(match.id)"`. When expanded, render an inline expander `<section id="timeline-{{ match.id }}" aria-live="polite">` immediately below the row containing the timeline `@switch` block. Cases: `idle` (won't be visible — toggle triggers loading immediately); `loading` → 3-event skeleton; `error` → inline notice + Retry (same button doubles as Refresh per FR-010); `success` → `@for (event of state().data; track event.id)` rendering minute chip, type icon, `description`, primary/secondary players. If `state().data.length === 0` show the empty state determined by parent match status (`scheduled` → "Match hasn't started"; `live` / `finished` → "Events not yet available"). The expander includes a per-timeline Refresh button calling `liveData.refreshTimeline(match.id)`.

- [x] T035 [P] [US4] Style the inline expander in `src/app/app.component.scss`: animated open/close (`max-height` + `prefers-reduced-motion` skip), event-row variants (`.event--goal`, `.event--yellow-card`, `.event--red-card`, `.event--substitution`, `.event--kickoff` / `.event--half-time` / `.event--full-time`, `.event--info`), minute chip, icons (text glyphs only — no third-party icon library per Constitution Principle I). Maintain WCAG AA contrast for each variant. Mobile: stack player text below minute chip at ≤360 px.

- [x] T036 [US4] Manual verification per `quickstart.md` §4: click a match row in the Group dashboard → row expands → DevTools Network shows exactly one `GET /summary?event={id}` request → events render chronologically. Click the same row → collapses. Click a **different** row in the same tab → first collapses (accordion). Switch to the Elimination ladder tab → repeat (use a knockout match if available; otherwise check that pre-tournament placeholder cards are NOT clickable when no `match.id` is attached). On a slow connection, the expander shows the skeleton loading state. Force a `/summary` failure (DevTools block URL) and verify the in-expander Refresh retries.

**Checkpoint**: All four user stories functional. Feature complete pending polish.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify quickstart in full, confirm constitutional + non-functional requirements (FR-002 / SC-004 / SC-005 / a11y), and ship.

- [x] T037 [P] Run the storage audit from `quickstart.md` (FR-002, SC-004): in DevTools console verify `JSON.stringify(localStorage) === '{}'`, `JSON.stringify(sessionStorage) === '{}'`, `(await indexedDB.databases()).length === 0`, `(await caches.keys()).length === 0`. Repeat after a per-section Refresh and after expanding a match. Any non-empty result is a release blocker — locate and remove the writer.

- [x] T038 [P] Run the bundle audit from `quickstart.md` (SC-005): `npm run build && grep -RIn -E "api[-_]?key|bearer|x-rapidapi" dist/` — expect zero hits. Any match is a release blocker.

- [x] T039 [P] Full `quickstart.md` smoke run on both desktop and 375 × 812 px mobile viewport per plan.md §Testing: §1 loading, §2 populated, §3 per-section Refresh, §4 inline expander accordion (both tabs), §5 time-zone display (toggle DevTools Sensors location), §6 match-state visual distinction, §7 error isolation, §8 pre-tournament rendering.

- [x] T040 [P] Accessibility pass on `src/app/app.component.html`: every Refresh button carries a section-scoped `aria-label`; every match `<button>` has `aria-expanded` toggling correctly; live regions use `aria-live="polite"`; keyboard nav: Tab through Refresh buttons + match rows; Enter / Space expands and collapses; focus ring visible. Verify with Chrome Accessibility tree.

- [x] T041 [P] Run `npm run build` and `docker build .` (Constitution Principle V — Reproducible Builds & CI Parity); confirm both succeed and produce equivalent artefacts. The CI workflow file (`.github/workflows/*`) is NOT touched — confirm no diff under `.github/`.

- [x] T042 [P] Confirm FR-003 cleanup: `grep -rn "tournament.data\|tournament\.data" src/` returns no matches. Confirm no stray `localStorage` / `sessionStorage` / `indexedDB` / `caches` writes in feature code: `grep -RIn "localStorage\|sessionStorage\|indexedDB\|caches\." src/` returns no matches outside the audit instructions (there should be none in source at all).

- [x] T043 [P] Constitution compliance final check: confirm no new `NgModule`, no `RxJS` import in feature code (Principle I: `grep -RIn "from 'rxjs'\|@NgModule\|BehaviorSubject" src/app/data/ src/app/app.component.ts` returns nothing), no `any` in production code (Principle II: TS strict mode already on; verify `tsc --noEmit` is clean — `npm run build` already covers this), no new third-party UI library in `package.json` diff vs `main`.

- [x] T044 Update `CLAUDE.md` (or in-repo dev notes) only if the feature meaningfully changes the developer workflow; per `quickstart.md` it does not — verify and leave untouched.

- [x] T045 Open PR `001-live-data → main`, enable auto-merge with merge commit (`gh pr merge <#> --auto --merge`) per project `CLAUDE.md` §Git workflow. Do NOT bypass branch protection; let required checks gate.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 → T002 + T003 (both `[P]`).
- **Foundational (Phase 2)**: depends on Setup. Internal order:
  - T004, T005, T006, T007 all `[P]` (different files, no inter-deps).
  - T008 depends on T004 + T005 + T006.
  - T009 depends on T008.
  - T010 depends on T009 (uses the service).
  - T011 `[P]` depends on T010 (styles target the markup classes in T010).
  - T012 depends on T009 (import removed) and T010 (template no longer references GROUPS).
- **User Stories (Phases 3 – 6)**: all depend on Phase 2 complete (`T012` done). Across stories the sequencing is:
  - US1 (P1) ships standalone — does not depend on US2/US3/US4.
  - US2 (P2) ships standalone after Phase 2 — does not depend on US1.
  - US3 (P3) shares the `/scoreboard` fetch and `applyScoreboard(raw)` helper with US2 (T027 extracts it). Implementing US3 before US2 still works because T027 introduces the helper and updates `kickOffEagerLoads` regardless; pick the simpler order P2 → P3.
  - US4 (P4) attaches its expander UI to match rows rendered by US2 (Group dashboard) and bracket cards rendered by US3. US4 can be implemented in parallel with US2/US3 — the expander wires to `match.id` which T018 produces and T026 attaches.
- **Polish (Phase 7)**: depends on all in-scope stories.

### Within-Story Dependencies

| Story | Sequential chain (within story) | Parallel within story |
|-------|--------------------------------|-----------------------|
| US1 | T013 → T014 → T015; T017 last | T016 `[P]` (different file, depends only on T015 markup classes existing — start once T015 is in flight) |
| US2 | T018 → T019 → T020 → T021/T022/T023 (all touch app.component.ts/html, do them sequentially) → T025 last | T024 `[P]` (scss) |
| US3 | T026 → T027 → T028 → T030 last | T029 `[P]` (scss) |
| US4 | T031 → T032 → T033 → T034 → T036 last | T035 `[P]` (scss) |

### Cross-Story Parallel Opportunities

Once Phase 2 is complete:

- A single developer should ship US1 first (MVP) end-to-end.
- With multiple developers, US2, US3, and US4 can run concurrently because:
  - US2 owns `mapScoreboardToMatches` + `refreshMatches` + the match-rows template;
  - US3 owns `mapScoreboardToBracket` + `refreshBracket` + the bracket template;
  - US4 owns `mapSummaryToEvents` + `refreshTimeline` + the expander.
  - They write to the same files (`espn.ts`, `live-data.service.ts`, `app.component.{ts,html,scss}`) but to **disjoint regions** — coordinate via clear section comments inside each file (e.g., `// --- US2: matches ---`). Use small, focused commits per phase to keep merge conflicts trivial.

### Polish Parallelism

All Phase 7 tasks except T045 are `[P]` — independent verifications.

---

## Parallel Example: kicking off Phase 2 (Foundational)

```
# After T001-T003 done, run all four type/config/boundary files concurrently:
Task T004: Author src/app/data/live-data.types.ts (full domain types per data-model.md)
Task T005: Author src/app/data/live-data.config.ts (single config surface per FR-008)
Task T006: Author src/app/data/espn.ts raw payload types + flagFromAbbreviation helper
Task T007: Author src/app/data/openfootball.ts stub functions throwing

# Then sequentially:
Task T008: Author src/app/data/live-data.service.ts skeleton
Task T009: Refactor src/app/app.component.ts to inject LiveDataService
Task T010: Replace src/app/app.component.html with section @switch shells
Task T011 (parallel with T012 after T010): Add base section CSS in app.component.scss
Task T012 (parallel with T011 after T009/T010): Delete src/app/tournament.data.ts
```

---

## Parallel Example: User Story 1 (MVP)

```
# Strictly sequential — same-file edits:
Task T013: mapStandings in src/app/data/espn.ts
Task T014: refreshStandings + kickOffEagerLoads in live-data.service.ts
Task T015: standings @switch + group cards in app.component.html

# Parallelizable with T015:
Task T016 [P]: standings styles in app.component.scss

# After all of above:
Task T017: Manual smoke per quickstart.md §1/§2/§3/§7/§8 on desktop + 375px mobile
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup): T001 – T003.
2. Complete Phase 2 (Foundational): T004 – T012. After T012 the page builds and renders empty section shells — the placeholder no longer ships, the service is wired, nothing fetches yet.
3. Complete Phase 3 (US1): T013 – T017. After T017 the dashboard fetches live ESPN standings on every page load, the per-section Refresh button works and recovers from errors, and storage audit passes.
4. **STOP and VALIDATE** with the Independent Test from US1 (`spec.md` §US1). If the standings render correctly on desktop and at 375 px mobile, this is shippable as the MVP.
5. If shipping the MVP standalone: jump to Phase 7 polish for the SC-004 / SC-005 / a11y checks and PR.

### Incremental Delivery

1. Phase 1 + Phase 2 + Phase 3 → Deploy MVP (standings live).
2. Phase 4 (US2) → Deploy (standings + matches live, time-zone display, in-page reload hint).
3. Phase 5 (US3) → Deploy (standings + matches + bracket live).
4. Phase 6 (US4) → Deploy (full feature: per-match timelines on demand).
5. Phase 7 → final verification + PR.

### Parallel Team Strategy

With multiple developers and Phase 2 complete:

- Dev A → US1 (T013 – T017).
- Dev B → US2 (T018 – T025) starting from T018 (does not depend on US1).
- Dev C → US3 (T026 – T030), coordinates with Dev B on the `applyScoreboard(raw)` helper in T027 (Dev B owns `refreshMatches`, Dev C extracts the shared `applyScoreboard`).
- Dev D → US4 (T031 – T036) — independent of US1/US2/US3 except that the expander UI in T034 attaches to match-row markup that US2 (group dashboard) and US3 (bracket) produce; if US4 lands first, the expander is harmless (no rows to attach to). For neatness, land in order US2 → US3 → US4.

---

## Notes

- This feature ships **no test code**. Verification is manual per `quickstart.md` and the per-story Independent Test in `spec.md`. Do not add `tests/` directories or unit test runners (Constitution Principle II rationale).
- `[P]` tasks touch different files and have no incomplete dependencies — they are safe to run in parallel.
- `[Story]` labels appear only on Phase 3 – Phase 6 tasks. Setup, Foundational, and Polish tasks have no story label.
- The four ESPN mappers live in the **same file** (`src/app/data/espn.ts`). When two stories edit `espn.ts` in parallel, use clearly-labelled section comments and small focused commits to keep merges trivial. Same caveat for `live-data.service.ts` and `app.component.{ts,html,scss}`.
- The DS-B (OpenFootball) fallback is **never coded against during this feature** beyond T007 (stub). If a future flip is required, the procedure is in `quickstart.md` §"Flip primary ↔ fallback".
- After each phase commit a working state. Auto-merge is enabled per the project's `CLAUDE.md` §Git workflow.
- The Constitution Check in `plan.md` is GREEN; no Complexity-Tracking entries are required and none should be introduced.

