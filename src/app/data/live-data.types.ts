// Internal domain types — mapped from raw provider payloads at the boundary.
// Source: specs/001-live-data/data-model.md.

export type TournamentPhase =
  | 'pre-tournament'
  | 'group'
  | 'knockout'
  | 'complete';

export interface Tournament {
  readonly edition: '2026';
  readonly hostCountries: readonly ['Canada', 'Mexico', 'United States'];
  readonly startDate: '2026-06-11';
  readonly endDate: '2026-07-19';
  readonly phase: TournamentPhase;
}

export type Confederation =
  | 'AFC'
  | 'CAF'
  | 'CONCACAF'
  | 'CONMEBOL'
  | 'OFC'
  | 'UEFA'
  | 'unknown';

export type GroupCode =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';

export interface Team {
  readonly id: string;
  readonly name: string;
  readonly flag: string;
  readonly confederation: Confederation;
  // Optional: not always derivable for knockout-resolved teams without a
  // cross-section standings lookup. Always populated for teams sourced
  // from a standings payload.
  readonly groupCode?: GroupCode;
  readonly seed?: number;
}

export interface Group {
  readonly code: GroupCode;
  readonly teams: readonly Team[];
  readonly standings: readonly StandingRow[];
}

export interface StandingRow {
  readonly teamId: string;
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
  readonly position: number;
}

export type MatchStatus = 'scheduled' | 'live' | 'finished';

export type Stage =
  | { readonly kind: 'group'; readonly group: GroupCode; readonly matchday: 1 | 2 | 3 }
  | { readonly kind: 'r32' }
  | { readonly kind: 'r16' }
  | { readonly kind: 'qf' }
  | { readonly kind: 'sf' }
  | { readonly kind: 'final' };

export interface Score {
  readonly home: number;
  readonly away: number;
}

export interface MatchSide {
  readonly team?: Team;
  readonly placeholderLabel?: string;
}

export interface Match {
  readonly id: string;
  readonly stage: Stage;
  readonly kickoffUtc: string;
  readonly venue: string;
  readonly hostCity: string;
  readonly home: MatchSide;
  readonly away: MatchSide;
  readonly status: MatchStatus;
  readonly score?: Score;
}

export type MatchEventType =
  | 'kickoff'
  | 'goal'
  | 'yellow-card'
  | 'red-card'
  | 'substitution'
  | 'half-time'
  | 'full-time'
  | 'info';

export interface MatchEvent {
  readonly id: string;
  readonly matchId: string;
  readonly minute: number;
  readonly period: number;
  readonly type: MatchEventType;
  readonly teamId?: string;
  readonly primaryPlayer?: string;
  readonly secondaryPlayer?: string;
  readonly description: string;
}

export type BracketRound = 'r32' | 'r16' | 'qf' | 'sf' | 'final';

export type BracketOccupant =
  | { readonly kind: 'team'; readonly team: Team }
  | { readonly kind: 'placeholder'; readonly label: string }
  | { readonly kind: 'empty' };

export interface BracketSlot {
  readonly round: BracketRound;
  readonly index: number;
  readonly occupant: BracketOccupant;
  readonly match?: Match;
}

export type SectionState<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly data: T; readonly fetchedAt: number }
  | { readonly status: 'error'; readonly message: string };

