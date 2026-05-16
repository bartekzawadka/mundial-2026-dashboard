# Phase 1 — Internal Data Model

These are the TypeScript types the app uses internally, mapped from raw
ESPN payloads at the boundary. Source: `spec.md` § Key Entities, refined
by research §R3 and §R7. They live in `src/app/data/live-data.types.ts`.

## Tournament

```ts
export type TournamentPhase =
  | 'pre-tournament'   // before first group MD1 kickoff
  | 'group'            // any group match scheduled/live, no knockout match started
  | 'knockout'         // first R32 kickoff … final
  | 'complete';        // after final
```

```ts
export interface Tournament {
  edition: '2026';
  hostCountries: readonly ['Canada', 'Mexico', 'United States'];
  startDate: '2026-06-11';
  endDate: '2026-07-19';
  phase: TournamentPhase;
}
```

Phase derivation is client-side from the loaded fixture statuses (cheapest
computation). The values are derived in a `computed()` signal off the
matches section; `Tournament` is never fetched as its own entity.

## Team

```ts
export interface Team {
  id: string;                // ESPN team id; primary key
  name: string;              // from competitor.team.displayName
  flag: string;              // emoji derived from team.abbreviation (ISO-2)
  confederation: Confederation;
  groupCode: GroupCode;
  seed: number;              // 1..4 within group; derived from standings rank at fetch time, or pot when pre-tournament
}

export type Confederation =
  | 'AFC' | 'CAF' | 'CONCACAF' | 'CONMEBOL' | 'OFC' | 'UEFA' | 'unknown';

export type GroupCode =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';
```

`flag`: ESPN serves SVG flag URLs on `team.flag.href` but the existing UI
uses emoji. The boundary mapper derives the emoji from the ISO-2 country
code in `team.abbreviation` / `team.location`. If the code is missing or
malformed, `flag` falls back to an empty string and the team name renders
without a flag glyph (degradation, not section error).

`confederation`: not always present on ESPN payloads; the mapper applies a
small static lookup keyed on team id (built once from the standings
response, since ESPN groups standings by confederation in some endpoints
but not consistently across `fifa.world`). When unknown, `'unknown'` is
used and the UI hides the confederation badge.

## Group

```ts
export interface Group {
  code: GroupCode;
  teams: Team[];              // length 4
  standings: StandingRow[];   // length 4, ordered by current position
}
```

## StandingRow

```ts
export interface StandingRow {
  teamId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  position: number;           // 1..4
}
```

State invariants: `played === wins + draws + losses`,
`goalDifference === goalsFor - goalsAgainst`,
`points === wins * 3 + draws`. The mapper does NOT enforce these — it
trusts the source — but the renderer can flag a soft warning if any are
violated (developer console only; the UI still renders the source values
verbatim per the single-source-of-truth assumption).

## Match

```ts
export type MatchStatus = 'scheduled' | 'live' | 'finished';

export type Stage =
  | { kind: 'group'; group: GroupCode; matchday: 1 | 2 | 3 }
  | { kind: 'r32' }
  | { kind: 'r16' }
  | { kind: 'qf' }
  | { kind: 'sf' }
  | { kind: 'final' };

export interface Score {
  home: number;
  away: number;
}

export interface MatchSide {
  team?: Team;                 // present when source has resolved the slot
  placeholderLabel?: string;   // present pre-resolution; verbatim from source (Clarifications §5)
}

export interface Match {
  id: string;                  // ESPN event id
  stage: Stage;
  kickoffUtc: string;          // ISO 8601 UTC, e.g. '2026-06-11T20:00:00Z'
  venue: string;               // e.g., 'Estadio Azteca'
  hostCity: string;            // e.g., 'Mexico City'
  home: MatchSide;
  away: MatchSide;
  status: MatchStatus;
  score?: Score;               // present when status === 'live' || 'finished'
}
```

Status transitions: `scheduled → live → finished` are source-driven; the
application observes them, never mutates them. A reload after a status
change reflects the new state per SC-007.

`Stage`: discriminated by `kind` so the renderer can `@switch` exhaustively
between group MD chips and knockout round labels.

Exactly one of `team` / `placeholderLabel` on a `MatchSide` is expected to
be populated; both empty is the "empty" case from the Bracket-slot
entity and renders as an empty side.

## MatchEvent

```ts
export type MatchEventType =
  | 'kickoff'
  | 'goal'
  | 'yellow-card'
  | 'red-card'
  | 'substitution'
  | 'half-time'
  | 'full-time'
  | 'info';                    // catch-all per research §R3
```

```ts
export interface MatchEvent {
  id: string;                  // mapping of ESPN play id; key for *ngFor
  matchId: string;
  minute: number;              // 0..120+
  type: MatchEventType;
  teamId?: string;
  primaryPlayer?: string;      // scorer / booked / off
  secondaryPlayer?: string;    // assist / on
  description: string;         // source-derived human-readable string
}
```

Ordering invariant: timeline events are sorted by `(period, minute)` in
ascending order at the mapper boundary; the renderer trusts the input
ordering.

## BracketSlot

```ts
export type BracketRound = 'r32' | 'r16' | 'qf' | 'sf' | 'final';

export type BracketOccupant =
  | { kind: 'team'; team: Team }
  | { kind: 'placeholder'; label: string }   // verbatim from source (Clarifications §5)
  | { kind: 'empty' };                       // source omitted a label

export interface BracketSlot {
  round: BracketRound;
  index: number;               // 0-based within the round
  occupant: BracketOccupant;
  match?: Match;               // the Match that fills this slot, when source has linked it
}
```

Cardinality per round (each side of each knockout match is one slot):
| Round | Matches | Slots |
|-------|---------|-------|
| R32   | 16      | 32    |
| R16   | 8       | 16    |
| QF    | 4       | 8     |
| SF    | 2       | 4     |
| Final | 1       | 2     |

The existing UI renders rounds with one entry per match (not per side),
so the renderer pairs `(home, away)` slots into a single bracket card.
The data model keeps them as separate `BracketSlot`s to preserve the
"empty side" representation when only one side is resolved.

## SectionState

```ts
export type SectionState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T; fetchedAt: number }  // epoch ms
  | { status: 'error'; message: string };
```

Used inside `LiveDataService` for the four UI sections:

| Section signal | T = … |
|----------------|-------|
| `standingsState` | `Group[]` (length 12) |
| `matchesState`   | `Match[]` (length 104) |
| `bracketState`   | `BracketSlot[]` (length 62) |
| `timelineStateByMatchId` (Map) | `MatchEvent[]` per match |

The first three are eagerly fetched on service construction; the fourth
populates lazily on row expand per US4 + research §R10. Per research
§R12 the "loading after success" transition keeps the previous
`success.data` available to the renderer via a parallel
`previous*Data` signal so the populated content stays visible during a
manual Refresh.

## Boundary mapping (high-level)

Mapping functions live in `src/app/data/espn.ts`. Naming:

- `mapScoreboardToMatches(raw): Match[]` — fixtures + scores
- `mapScoreboardToBracket(raw): BracketSlot[]` — same raw, filtered + restructured
- `mapStandings(raw): Group[]` — composition + standings tables
- `mapSummaryToEvents(raw, matchId): MatchEvent[]` — timeline

Each mapper validates *required* fields per the relevant contract in
`./contracts/`. A required-field violation throws inside the service's
fetch wrapper, which catches and writes
`{ status: 'error', message: 'Source response did not match expected shape.' }`
into the section signal. Other sections are unaffected.

