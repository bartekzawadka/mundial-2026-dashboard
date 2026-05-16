# Feature Specification: Live Tournament Data

**Feature Branch**: `001-live-data`

**Created**: 2026-05-15

**Status**: Draft

**Input**: User description: "We need all FIFA 2026 matches, tables, timelines, trees and all data to be fetched on the fly when user opens website. No 'cached'/stored data. Just prepare a set of data source URLs from which website will collect all the necessary information. Prepare spec 001-live-data for this."

## Clarifications

### Session 2026-05-15

- Q: Which of the candidate data source families (DS-A / DS-B / DS-C) is the primary source, and which (if any) is the fallback? → A: DS-A (ESPN public sports JSON) is the primary source; DS-B (OpenFootball static JSON on GitHub) is the secondary fallback; DS-C (TheSportsDB) is rejected for this feature.
- Q: Where does the match timeline (US4) surface in the UI, given the Assumption that no new views are added? → A: As an inline expander on each match row inside the Group dashboard and the Elimination ladder. Clicking a match row expands it in place to reveal the timeline; the timeline endpoint is fetched lazily on expand. No modal, sub-route, or top-level view is added.
- Q: What is the granularity of the Refresh affordance — global page button, per-section only, or both? → A: Per-section "Refresh" button on every data section (group standings, match schedule + scores, bracket, expanded match timeline). The button is always visible regardless of section state (loading / populated / error) and re-fetches that section on demand; in the error state it doubles as the Retry affordance. No global "Refresh All" page-level button; browser reload remains available as the full-page refresh path.
- Q: What does "secondary fallback" mean operationally for DS-B — runtime auto-failover or config-only swap? → A: Config-only fallback. DS-B URLs live in the same configuration surface as DS-A (per FR-008); switching primary ↔ fallback is a one-place edit + redeploy. On any single page load only one source is contacted; no runtime auto-failover and no automatic cross-source retry on a failed primary request.
- Q: Where do unresolved bracket slot placeholder labels (e.g., "Winner A", "3B/E/F") come from? → A: The primary source's bracket payload, read verbatim. The client never synthesizes placeholder labels and never encodes FIFA 2026 progression rules (group ranking, third-place permutations, seeding). If the primary source omits a label for a slot, that slot renders as empty rather than client-derived.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See current group standings on page load (Priority: P1)

A fan opens the dashboard during the tournament and immediately sees the actual,
up-to-date group standings for all twelve groups — real points, goal difference,
matches played, and current position — instead of the placeholder values that
ship in the current build.

**Why this priority**: Group standings are the front-and-center view of the
dashboard today and the single highest-signal piece of information during the
group phase. Without live standings the page is functionally a static brochure.
This is the MVP of the live-data feature: every other view degrades gracefully
if it is missing, but the group dashboard cannot.

**Independent Test**: Open the site in a browser during or immediately after a
matchday. Verify that each group card shows the same standings (order, points,
GD, matches played) as the official FIFA 2026 group tables and that the values
update if the page is reloaded after a result changes. Confirm no values are
read from local storage, service-worker cache, or in-repo data files.

**Acceptance Scenarios**:

1. **Given** the user opens the dashboard for the first time during the group
   stage, **When** the page finishes loading, **Then** every one of the twelve
   group cards shows live standings sourced from an external provider, with
   teams ordered by current ranking and with real points, goal difference, and
   matches-played values.
2. **Given** the user is viewing the dashboard and a result was just made
   official by the data source, **When** the user reloads the browser tab,
   **Then** the standings reflect the new result.
3. **Given** the user opens the dashboard before any group match has been
   played, **When** the page loads, **Then** every team appears at 0 points /
   0 matches played and the cards still render without errors.

---

### User Story 2 - See match schedule and results (Priority: P2)

A fan wants to know which matches have already been played, what their scores
were, which match is on now, and which matches are next on each group's
schedule.

**Why this priority**: The dashboard already advertises three match cards per
group ("MD1", "MD1", "MD3" placeholders today). Replacing these placeholders
with live fixtures + scores is the natural complement to live standings and
covers the "matches" data category called out in the feature description. It
is P2 rather than P1 because the standings already imply most of this
information once they are live.

**Independent Test**: Compare the three match rows under every group card
against the official fixture list. Verify that completed matches show the
final score, that an in-progress match shows the current score and a clear
live indicator, and that upcoming matches show kickoff date/time in the
viewer's local time zone.

**Acceptance Scenarios**:

1. **Given** a group has played one of its three matchdays, **When** the user
   views that group's card, **Then** the played match shows the final score
   and the upcoming matches show their scheduled kickoff time.
2. **Given** a match is currently in progress, **When** the user views the
   group card containing it, **Then** the match row shows the running score
   with a visible "live" indicator.
3. **Given** kickoff times are returned in UTC by the source, **When** the
   user views the page, **Then** times are displayed in the viewer's local
   time zone with the zone abbreviation visible.

---

### User Story 3 - See the knockout bracket with real teams (Priority: P3)

Once the group phase ends, a fan opens the "Elimination ladder" tab and sees
the actual Round of 32 pairings, Round of 16 winners, quarter/semifinals, and
final — populated with real qualified teams instead of placeholder labels
("Match 1", "Path 1", "Quarter 1", "Semi 1", "World Champion").

**Why this priority**: The bracket view is the second of the two top-level
tabs in the application. It is only useful once the knockout phase begins
(2026-06-28 onward), so it ships after the two views that are useful from
matchday 1.

**Independent Test**: Open the "Elimination ladder" tab after group stage
ends. Verify every Round of 32 slot is populated with the correct team (or
the correct placeholder pairing like "1A vs 3B/E/F" while group ranking is
still finalising), and that progression to later rounds matches the official
bracket as winners are decided.

**Acceptance Scenarios**:

1. **Given** the group stage has ended, **When** the user opens the
   Elimination ladder, **Then** every Round of 32 slot shows a concrete team
   matchup with kickoff date and host city.
2. **Given** a Round of 32 match has been completed, **When** the user
   reloads the page, **Then** the winning team appears in the corresponding
   Round of 16 slot.
3. **Given** the final has been decided, **When** the user views the
   bracket, **Then** the champion's name and flag replace the "World
   Champion" placeholder in the final slot.

---

### User Story 4 - See match timeline for a live match (Priority: P4)

A fan watching a match elsewhere checks the dashboard for a chronological
event timeline (kickoff, goals, yellow/red cards, substitutions,
half-time, full-time) for the currently-running match.

**Why this priority**: Timelines are explicitly listed in the feature
request alongside matches, tables, and trees. They are P4 because they
only matter during the ~2-hour window a match is live, are additive to
the existing UI, and require richer data than the other three categories.
Cutting this user story still leaves a useful product.

**Independent Test**: While a match is in progress, click that match's
row to expand its inline timeline, and check each event against an
independent live source. Confirm event ordering is chronological and
that the timeline updates on page reload as new events occur.

**Acceptance Scenarios**:

1. **Given** a match is live, **When** the user clicks the match row to
   expand it inline, **Then** events appear in chronological order with
   minute, event type, and involved player/team inside the expanded row
   body.
2. **Given** a match has finished, **When** the user clicks the match
   row to expand it inline, **Then** the full timeline from kickoff to
   final whistle is visible in read-only form inside the expanded row
   body.

---

### Edge Cases

- **Pre-tournament window**: Today is 2026-05-15; the tournament starts
  2026-06-11. Before any match is played, group standings, scores, and
  the bracket are all empty. The page MUST still render every group with
  all four teams at 0 points / 0 matches played and the bracket MUST
  still render with placeholder pairings, with no error states.
- **All data sources unreachable on page load**: If every required source
  fails (network error, DNS failure, 5xx, timeout) the affected section
  MUST show a clearly labelled empty/error state; the section's
  per-section Refresh button (see FR-004 / FR-010) remains available so
  the user can retry, and the rest of the page MUST still render the
  parts whose sources succeeded.
- **Partial data**: If standings load but fixtures do not (or vice versa),
  each section degrades independently — a failure in one data category
  MUST NOT blank out the others.
- **Rate-limited by source**: If a source responds with a rate-limit
  status, the page treats it like any other failed fetch (empty/error
  state with the per-section Refresh button still available); the page
  MUST NOT silently retry in a loop on the user's behalf.
- **Slow source (>5 s)**: While data is in flight, each section shows a
  loading state distinct from the empty state. After a per-request
  timeout (default: 10 s) the section transitions to the error state.
- **Source schema drift**: If the source returns data that does not match
  the expected shape for a section, that section shows the error state;
  it MUST NOT render partially-decoded or garbled values.
- **In-progress match score change while user is on the page**: Per the
  feature description ("fetched on the fly when user opens website"),
  no in-session polling is performed. The user must reload to see new
  values. A short note on the page MUST inform users that scores are
  point-in-time and they should reload for updates.
- **Time-zone correctness**: Sources commonly return kickoff times in
  UTC. The page MUST display them in the viewer's local time zone with
  the zone abbreviation rendered next to the time.
- **Mid-match data shape (live score vs. final)**: An in-progress match
  has a different "status" than a finished match. Each match row MUST
  visually distinguish scheduled / live / finished states.

## Requirements *(mandatory)*

### Functional Requirements

**Fetching & freshness**

- **FR-001**: On every page load, the application MUST fetch all of the
  following from external sources, with no fallback to data bundled
  inside the application: (a) group composition, (b) group standings,
  (c) the full match list with scheduled/live/final status and scores,
  (d) the knockout bracket structure with current occupants of each
  slot, and (e) per-match timeline events for matches the user opens.
- **FR-002**: The application MUST NOT persist fetched tournament data
  in `localStorage`, `sessionStorage`, `IndexedDB`, a service-worker
  cache, or any other client-side persistence layer. Each page load is
  a fresh fetch.
- **FR-003**: The application MUST NOT ship the in-repo file
  `src/app/tournament.data.ts` (or any equivalent committed dataset
  of teams, groups, fixtures, or standings) in the production bundle
  once this feature is delivered. Any pre-tournament team/group
  composition used as a UI scaffold MUST come from the same live
  source as the rest of the data so that there is a single source of
  truth.
- **FR-004**: The application MUST NOT issue background polling
  requests while the page is open. Refreshing data is the user's
  action. Each data section (group standings, match schedule +
  scores, bracket, and each expanded match timeline) MUST expose its
  own per-section "Refresh" affordance that is always visible
  regardless of the section's state (loading / populated / error)
  and re-fetches that section on demand. The application MUST NOT
  introduce a global "Refresh All" page-level button; browser reload
  remains available as the full-page refresh path.
- **FR-005**: Standard HTTP caching headers returned by the data
  source (`Cache-Control`, `ETag`) are out of scope for this feature
  and may be honoured by the browser; the application MUST NOT add
  application-level caching on top.

**Data source contract**

- **FR-006**: All data sources used by the application MUST be
  reachable directly from the user's browser — i.e., they MUST serve
  CORS headers permitting the dashboard's origin and MUST NOT require
  request signing or secrets that would need a backend.
- **FR-007**: The application MUST NOT embed long-lived API keys or
  tokens in the production bundle. If a candidate source requires a
  key, it is disqualified for this feature until a server-side proxy
  exists (which is out of scope here — see Assumptions).
- **FR-008**: The set of data source URLs — both the active primary
  set and the configured fallback set — MUST be enumerated in one
  configuration surface (e.g., a single configuration object or
  environment file) so that swapping providers is a one-place edit.
  Only the active primary set is contacted at runtime; the fallback
  set is never fetched at runtime and exists in configuration solely
  so an operator can flip primary ↔ fallback during an extended
  primary outage by editing config and redeploying.
- **FR-009**: The chosen data source(s) MUST cover the FIFA 2026 men's
  World Cup, including the expanded 48-team / 12-group / Round-of-32
  format.

**Data sources (resolved)**

This feature uses **DS-A (ESPN public sports JSON) as the primary
source** and **DS-B (OpenFootball static JSON on GitHub) as the
secondary fallback**. DS-A is selected because it is the only
candidate that covers all four data categories the spec requires
(standings, fixtures + scores, bracket, per-match timelines) with
documented CORS-permissive public endpoints and no API key. DS-B is
retained as a static, fully CORS-permissive backup for tournament
composition and fixtures when DS-A is unreachable; fallback values
may lag live state. Fallback is **config-only**: DS-B is never
contacted at runtime, and its URLs live in the same configuration
surface as DS-A so that an operator can flip primary ↔ fallback by
editing config and redeploying. DS-C is rejected for this feature.
No other source families may be introduced without amending this
spec.

- **DS-A · ESPN public sports JSON** — *PRIMARY*. No key,
  CORS-permissive in practice, covers FIFA World Cup including
  bracket:
  - `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard`
    — fixtures + live scores
  - `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/standings`
    — group tables
  - `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event={eventId}`
    — match timeline / events
  - `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams`
    — team metadata
- **DS-B · OpenFootball static JSON on GitHub** — *FALLBACK*. No
  key, fully CORS-permissive, community-maintained, suited to
  fixtures / composition; standings are derived, not pushed live:
  - `https://raw.githubusercontent.com/openfootball/world-cup.json/master/2026/worldcup.json`
  - `https://raw.githubusercontent.com/openfootball/world-cup.json/master/2026/worldcup.groups.json`
  - `https://raw.githubusercontent.com/openfootball/world-cup.json/master/2026/worldcup.knockout.json`
- **DS-C · TheSportsDB free tier** — *Rejected for this feature*.
  Key `3` is the documented public free key, CORS-permissive, lower
  update cadence and lower live fidelity than ESPN:
  - `https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id={leagueId}&s=2026`
  - `https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l={leagueId}&s=2026`
  - `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d={YYYY-MM-DD}&l={leagueId}`

**Sources explicitly out-of-scope** for this feature because they
require server-side credentials or paid plans: api.football-data.org
(token in header — key leaks to the browser), API-Football via
RapidAPI (RapidAPI key leaks to the browser), api.fifa.com private
feeds (no public terms / CORS).

**Behaviour on failure**

- **FR-010**: When a data source request fails (network error,
  non-2xx status, timeout, malformed payload), the affected section
  of the UI MUST render an empty/error state with a brief
  explanation. Re-triggering the fetch uses the same per-section
  Refresh affordance defined in FR-004 (the Refresh button doubles
  as Retry in the error state — no separate Retry button is
  introduced). Other sections that did succeed MUST remain rendered.
- **FR-011**: Per-request timeout MUST be 10 seconds by default; the
  configured value MUST live alongside the URL list (FR-008).
- **FR-012**: The application MUST NOT retry failed requests
  automatically on the user's behalf within a single page visit.
  This prohibition explicitly includes automatic cross-source
  retry: a failed request to the active primary source MUST NOT
  trigger an automatic request to the configured fallback source.

**Display**

- **FR-013**: Kickoff times MUST be displayed in the viewer's local
  time zone with the IANA / abbreviation visible next to the time.
- **FR-014**: Each match row MUST visually distinguish three states:
  *scheduled* (future kickoff time), *live* (in progress, current
  score, visible live indicator), *finished* (final score).
- **FR-015**: While data is in flight, every section MUST display a
  loading state that is visually distinct from both the empty/error
  state and the populated state. This is required even on very fast
  connections so that the page never flashes "empty" before "populated".

### Key Entities *(include if feature involves data)*

- **Tournament**: The FIFA 2026 men's World Cup edition. Holds top-level
  metadata (start/end dates, host countries, current phase: pre-tournament
  / group / knockout / complete).
- **Team**: A qualified national team. Attributes: name, flag/badge,
  confederation, group code, seed within group.
- **Group**: One of twelve four-team groups (A–L). Holds the four
  Teams and an ordered list of Standings rows.
- **Standings row**: A per-team row inside a Group. Attributes: matches
  played, wins, draws, losses, goals for, goals against, goal
  difference, points, current position.
- **Match**: One fixture in the tournament. Attributes: external id,
  competition stage (group MD1/2/3, R32, R16, QF, SF, Final), kickoff
  timestamp in UTC, venue / host city, home team, away team, status
  (scheduled / live / finished), score (live or final).
- **Match event**: A single point on a Match's timeline. Attributes:
  match id, minute, type (goal / yellow card / red card / substitution
  / kickoff / half-time / full-time), team involved, player(s)
  involved, description.
- **Bracket slot**: A position in the knockout tree. Attributes: round
  (R32 / R16 / QF / SF / Final), slot index within the round, current
  occupant (a Team, an unresolved label string read verbatim from the
  primary source's bracket payload such as "1A" or "Winner A", or
  empty), the Match that fills it. The client MUST NOT synthesize
  placeholder labels nor encode tournament progression rules; if the
  source omits a label, the slot renders as empty.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a first-time visit, the group standings view is fully
  populated with live data within 3 seconds on a median consumer
  broadband connection (≥10 Mbps, ≤50 ms RTT to the chosen source).
- **SC-002**: On a first-time visit, the three eagerly-fetched data
  categories (standings, fixtures + scores, bracket) are fully
  populated within 5 seconds on the same connection. Match timelines
  are lazy per US4 and FR-001(e); a per-match timeline populates
  within 3 seconds of the user expanding that match row on the same
  connection.
- **SC-003**: For at least 95% of visits during the 39-day tournament
  window (2026-06-11 to 2026-07-19), every visible value on the page
  matches the official FIFA scoreboard within 60 seconds of the
  scoreboard update (a function of the source's own freshness and the
  user's reload cadence).
- **SC-004**: Across an automated audit of `localStorage`,
  `sessionStorage`, `IndexedDB`, and service-worker storage on a
  freshly cleared profile after a normal visit, no entry contains
  tournament fixtures, standings, bracket slots, or timeline events.
- **SC-005**: Zero secrets (API keys, tokens, bearer values) are
  present in the production JavaScript bundle, verifiable by a static
  scan of the built artefact.
- **SC-006**: When the primary data source is artificially blocked,
  every affected section enters its error state within the configured
  timeout, the unaffected sections render normally, and the user can
  trigger a retry without reloading the page.
- **SC-007**: After a result becomes official at the data source, a
  user who reloads the page sees the updated standings, scores, or
  bracket occupants on that reload — no further action required.

## Assumptions

- **Refresh model is per page load.** The feature description says
  data is fetched "on the fly when user opens website". This is read
  literally: one fetch per page load, no in-session auto-polling. A
  small in-page hint tells users that scores are point-in-time and a
  reload is needed for updates. (If product later wants live ticking,
  that is a follow-up feature with its own spec.)
- **No backend will be introduced as part of this feature.** The
  current project is a static SPA served by nginx (see constitution
  §Technology & Platform Constraints). This spec deliberately stays
  inside that envelope by requiring CORS-friendly, key-less sources.
  Introducing a server-side data proxy is a separate constitutional
  amendment and a separate feature.
- **The data-service integration is the one explicitly contemplated
  by the constitution.** Constitution III (Simplicity & YAGNI) and the
  Technology & Platform Constraints both note that runtime fetches
  are out of scope "until a data-service integration is explicitly
  planned." This spec *is* that explicit plan; on merge,
  `tournament.data.ts` and any other in-repo demo data are removed.
- **Source authority is single, not consensus.** The application
  trusts whichever source is configured. There is no cross-source
  reconciliation logic — that would multiply complexity for marginal
  gain.
- **Browser HTTP caching is acceptable.** Browsers may cache the
  source response per `Cache-Control` headers from the provider; that
  is the provider's contract, not the application's, and is therefore
  outside what FR-002 prohibits. FR-002 specifically targets
  application-level persistence (localStorage / service worker /
  bundled data).
- **All currently rendered views remain in scope, nothing new is
  added.** The group dashboard and the elimination ladder are the two
  top-level tabs today. This spec wires them to live data; it does
  not introduce squad pages, player stats, top scorers, venues, or
  any other view. Those are out of scope and would be separate specs.
- **The viewer is on a modern evergreen browser.** Same audience as
  the existing app; no IE/legacy testing.
- **English-only display.** The application is English-only today and
  this feature does not internationalize team names or event
  descriptions returned by the source.

