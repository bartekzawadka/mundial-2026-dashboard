// Raw ESPN payload types, boundary mappers, and the small flag helper.
// Field shapes per specs/001-live-data/contracts/espn-*.contract.md.
// Domain types are imported from ./live-data.types.

import type {
  BracketOccupant,
  BracketRound,
  BracketSlot,
  Group,
  GroupCode,
  Match,
  MatchEvent,
  MatchEventType,
  MatchSide,
  MatchStatus,
  Score,
  Stage,
  StandingRow,
  Team,
} from './live-data.types';

// ---------- raw payload types ----------

export interface RawScoreboardResponse {
  readonly events?: readonly RawScoreboardEvent[];
}

export interface RawScoreboardEvent {
  readonly id?: string;
  readonly date?: string;
  readonly name?: string;
  readonly shortName?: string;
  readonly status?: { readonly type?: { readonly state?: string } };
  readonly season?: { readonly type?: number };
  readonly week?: { readonly number?: number; readonly text?: string };
  readonly notes?: readonly { readonly headline?: string; readonly type?: string }[];
  readonly competitions?: readonly RawScoreboardCompetition[];
}

export interface RawScoreboardCompetition {
  readonly notes?: readonly { readonly headline?: string; readonly type?: string }[];
  readonly groupId?: string | number;
  readonly venue?: {
    readonly fullName?: string;
    readonly address?: { readonly city?: string };
  };
  readonly competitors?: readonly RawCompetitor[];
}

export interface RawCompetitor {
  readonly homeAway?: string;
  readonly team?: RawTeam;
  readonly score?: string | number;
}

export interface RawTeam {
  readonly id?: string;
  readonly displayName?: string;
  readonly shortDisplayName?: string;
  readonly abbreviation?: string;
  readonly location?: string;
}

export interface RawStandingsResponse {
  readonly children?: readonly RawStandingsGroup[];
}

export interface RawStandingsGroup {
  readonly name?: string;
  readonly standings?: { readonly entries?: readonly RawStandingEntry[] };
}

export interface RawStandingEntry {
  readonly team?: RawTeam;
  readonly stats?: readonly { readonly name?: string; readonly value?: number }[];
}

export interface RawSummaryResponse {
  readonly plays?: readonly RawSummaryPlay[];
}

export interface RawSummaryPlay {
  readonly id?: string;
  readonly clock?: { readonly displayValue?: string };
  readonly period?: { readonly number?: number };
  readonly type?: { readonly text?: string };
  readonly team?: { readonly id?: string };
  readonly participants?: readonly {
    readonly athlete?: { readonly displayName?: string };
  }[];
  readonly text?: string;
}

// ---------- helpers ----------

// ISO-3166-1 alpha-2 → regional-indicator flag emoji.
// Returns '' when abbr is missing or not a two-letter ASCII string
// (graceful degradation — the row still renders, without a flag glyph).
export function flagFromAbbreviation(abbr: string | undefined): string {
  if (!abbr) return '';
  const trimmed = abbr.trim().toUpperCase();
  if (trimmed.length !== 2 || !/^[A-Z]{2}$/.test(trimmed)) return '';
  const A = 0x41;
  const REGIONAL_A = 0x1f1e6;
  return String.fromCodePoint(
    trimmed.charCodeAt(0) - A + REGIONAL_A,
    trimmed.charCodeAt(1) - A + REGIONAL_A,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const GROUP_CODES: readonly GroupCode[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
];

function isGroupCode(value: string): value is GroupCode {
  return (GROUP_CODES as readonly string[]).includes(value);
}

const PLACEHOLDER_NAME_PATTERNS: readonly RegExp[] = [
  /^(Winner|Runner-?up|Loser)\b/i,
  /^[1-4][A-L](\/[A-L])*$/,
  /^TBD$/i,
];

function isPlaceholderName(name: string): boolean {
  return PLACEHOLDER_NAME_PATTERNS.some((re) => re.test(name.trim()));
}

function readNumberStat(
  stats: readonly { readonly name?: string; readonly value?: number }[] | undefined,
  ...candidateNames: readonly string[]
): number | undefined {
  if (!stats) return undefined;
  for (const candidate of candidateNames) {
    const found = stats.find((s) => s?.name === candidate);
    if (found && typeof found.value === 'number') return found.value;
  }
  return undefined;
}

function buildMatchSide(competitor: RawCompetitor | undefined): MatchSide {
  if (!competitor || !competitor.team) return {};
  const rawTeam = competitor.team;
  const id = rawTeam.id ?? '';
  const name = rawTeam.displayName ?? rawTeam.shortDisplayName ?? '';
  if (!id || !name || isPlaceholderName(name)) {
    const placeholderLabel = name || rawTeam.shortDisplayName;
    if (!placeholderLabel) return {};
    return { placeholderLabel };
  }
  const team: Team = {
    id,
    name,
    flag: flagFromAbbreviation(rawTeam.abbreviation),
    confederation: 'unknown',
  };
  return { team };
}

function parseGroupCodeFromText(text: string | undefined): GroupCode | undefined {
  if (!text) return undefined;
  const match = text.match(/Group\s+([A-L])\b/i);
  if (!match) return undefined;
  const letter = match[1].toUpperCase();
  return isGroupCode(letter) ? letter : undefined;
}

function parseGroupCode(event: RawScoreboardEvent): GroupCode | undefined {
  for (const note of event.notes ?? []) {
    const code = parseGroupCodeFromText(note?.headline);
    if (code) return code;
  }
  const competition = event.competitions?.[0];
  for (const note of competition?.notes ?? []) {
    const code = parseGroupCodeFromText(note?.headline);
    if (code) return code;
  }
  const fromName = parseGroupCodeFromText(event.name);
  if (fromName) return fromName;
  const fromShort = parseGroupCodeFromText(event.shortName);
  if (fromShort) return fromShort;
  return undefined;
}

function parseBracketRound(event: RawScoreboardEvent): BracketRound | undefined {
  const headlines: string[] = [];
  for (const note of event.notes ?? []) {
    if (note?.headline) headlines.push(note.headline);
  }
  for (const note of event.competitions?.[0]?.notes ?? []) {
    if (note?.headline) headlines.push(note.headline);
  }
  if (event.name) headlines.push(event.name);
  if (event.shortName) headlines.push(event.shortName);

  for (const raw of headlines) {
    const h = raw.trim().toLowerCase();
    if (h.startsWith('round of 32') || h.startsWith('r32')) return 'r32';
    if (h.startsWith('round of 16') || h.startsWith('r16')) return 'r16';
    if (h.startsWith('quarterfinal') || h.startsWith('quarter-final') || h.startsWith('quarter')) return 'qf';
    if (h.startsWith('semifinal') || h.startsWith('semi-final') || h.startsWith('semi')) return 'sf';
    if (h.startsWith('final')) return 'final';
  }
  return undefined;
}

function parseMatchStatus(state: string | undefined): MatchStatus | undefined {
  if (state === 'pre') return 'scheduled';
  if (state === 'in') return 'live';
  if (state === 'post') return 'finished';
  return undefined;
}

function parseScore(home: RawCompetitor | undefined, away: RawCompetitor | undefined): Score | undefined {
  if (!home || !away) return undefined;
  const h = typeof home.score === 'string' ? parseInt(home.score, 10) : typeof home.score === 'number' ? home.score : NaN;
  const a = typeof away.score === 'string' ? parseInt(away.score, 10) : typeof away.score === 'number' ? away.score : NaN;
  if (!Number.isFinite(h) || !Number.isFinite(a)) return undefined;
  return { home: h, away: a };
}

function buildMatchFromEvent(event: RawScoreboardEvent): Match | undefined {
  if (!event.id || !event.date) return undefined;
  const status = parseMatchStatus(event.status?.type?.state);
  if (!status) return undefined;

  const competition = event.competitions?.[0];
  const venue = competition?.venue?.fullName;
  const hostCity = competition?.venue?.address?.city;
  if (!venue || !hostCity) return undefined;

  const competitors = competition?.competitors ?? [];
  if (competitors.length !== 2) return undefined;
  const home = competitors.find((c) => c?.homeAway === 'home') ?? competitors[0];
  const away = competitors.find((c) => c?.homeAway === 'away') ?? competitors[1];

  const seasonType = event.season?.type;
  const stage = ((): Stage | undefined => {
    if (seasonType === 2) {
      const group = parseGroupCode(event);
      const matchday = event.week?.number;
      if (!group || (matchday !== 1 && matchday !== 2 && matchday !== 3)) return undefined;
      return { kind: 'group', group, matchday };
    }
    if (seasonType === 3) {
      const round = parseBracketRound(event);
      if (!round) return undefined;
      return { kind: round };
    }
    return undefined;
  })();
  if (!stage) return undefined;

  const score = status === 'scheduled' ? undefined : parseScore(home, away);

  return {
    id: event.id,
    stage,
    kickoffUtc: event.date,
    venue,
    hostCity,
    home: buildMatchSide(home),
    away: buildMatchSide(away),
    status,
    ...(score ? { score } : {}),
  };
}

// ---------- standings ----------

export function mapStandings(raw: unknown): Group[] {
  if (!isRecord(raw) || !Array.isArray(raw['children'])) {
    throw new Error('Standings response did not match expected shape.');
  }
  const children = raw['children'] as readonly unknown[];

  const matchedGroups: { code: GroupCode; group: RawStandingsGroup }[] = [];
  for (const child of children) {
    if (!isRecord(child)) continue;
    const name = typeof child['name'] === 'string' ? child['name'] : '';
    const match = name.match(/^Group ([A-L])$/);
    if (!match) continue;
    const letter = match[1] as GroupCode;
    matchedGroups.push({ code: letter, group: child as unknown as RawStandingsGroup });
  }

  if (matchedGroups.length !== 12) {
    throw new Error(
      `Standings expected 12 group entries matching /^Group ([A-L])$/, got ${matchedGroups.length}.`,
    );
  }

  const groups: Group[] = matchedGroups.map(({ code, group }) => {
    const entries = group.standings?.entries ?? [];
    const teams: Team[] = [];
    const standings: StandingRow[] = [];
    for (const entry of entries) {
      const rawTeam = entry?.team;
      if (!rawTeam?.id || !rawTeam.displayName) continue;
      const position = readNumberStat(entry.stats, 'rank') ?? standings.length + 1;
      const team: Team = {
        id: rawTeam.id,
        name: rawTeam.displayName,
        flag: flagFromAbbreviation(rawTeam.abbreviation),
        confederation: 'unknown',
        groupCode: code,
        seed: position,
      };
      const row: StandingRow = {
        teamId: rawTeam.id,
        played: readNumberStat(entry.stats, 'gamesPlayed') ?? defaultZeroWarn('gamesPlayed', code),
        wins: readNumberStat(entry.stats, 'wins') ?? defaultZeroWarn('wins', code),
        draws: readNumberStat(entry.stats, 'ties', 'draws') ?? defaultZeroWarn('ties/draws', code),
        losses: readNumberStat(entry.stats, 'losses') ?? defaultZeroWarn('losses', code),
        goalsFor: readNumberStat(entry.stats, 'pointsFor') ?? defaultZeroWarn('pointsFor', code),
        goalsAgainst: readNumberStat(entry.stats, 'pointsAgainst') ?? defaultZeroWarn('pointsAgainst', code),
        goalDifference: readNumberStat(entry.stats, 'pointDifferential') ?? defaultZeroWarn('pointDifferential', code),
        points: readNumberStat(entry.stats, 'points') ?? defaultZeroWarn('points', code),
        position,
      };
      teams.push(team);
      standings.push(row);
    }
    standings.sort((a, b) => a.position - b.position);
    teams.sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));
    return { code, teams, standings };
  });

  groups.sort((a, b) => a.code.localeCompare(b.code));
  return groups;
}

function defaultZeroWarn(stat: string, code: GroupCode): number {
  console.warn(`[live-data] standings group ${code} missing stat "${stat}", defaulting to 0`);
  return 0;
}

// ---------- scoreboard → matches ----------

export function mapScoreboardToMatches(raw: unknown): Match[] {
  if (!isRecord(raw) || !Array.isArray(raw['events'])) {
    throw new Error('Scoreboard response did not match expected shape.');
  }
  const rawEvents = raw['events'] as readonly unknown[];
  const matches: Match[] = [];
  for (const event of rawEvents) {
    if (!isRecord(event)) continue;
    const built = buildMatchFromEvent(event as unknown as RawScoreboardEvent);
    if (built) matches.push(built);
  }
  if (matches.length === 0 && rawEvents.length > 0) {
    throw new Error('Scoreboard returned events but none matched the expected shape.');
  }
  return matches;
}

// ---------- scoreboard → bracket ----------

export function mapScoreboardToBracket(raw: unknown): BracketSlot[] {
  if (!isRecord(raw) || !Array.isArray(raw['events'])) {
    throw new Error('Scoreboard response did not match expected shape.');
  }
  const rawEvents = raw['events'] as readonly unknown[];

  type Pair = { round: BracketRound; event: RawScoreboardEvent; match: Match };
  const knockoutPairs: Pair[] = [];
  for (const event of rawEvents) {
    if (!isRecord(event)) continue;
    const ev = event as unknown as RawScoreboardEvent;
    if (ev.season?.type !== 3) continue;
    const round = parseBracketRound(ev);
    if (!round) continue;
    const built = buildMatchFromEvent(ev);
    if (!built) continue;
    knockoutPairs.push({ round, event: ev, match: built });
  }

  // group by round, sort each round by kickoffUtc for stable index
  const byRound = new Map<BracketRound, Pair[]>();
  for (const p of knockoutPairs) {
    const arr = byRound.get(p.round) ?? [];
    arr.push(p);
    byRound.set(p.round, arr);
  }

  const slots: BracketSlot[] = [];
  const orderedRounds: readonly BracketRound[] = ['r32', 'r16', 'qf', 'sf', 'final'];
  for (const round of orderedRounds) {
    const group = byRound.get(round) ?? [];
    group.sort((a, b) => a.match.kickoffUtc.localeCompare(b.match.kickoffUtc));
    group.forEach((p, eventIdx) => {
      const homeIndex = eventIdx * 2;
      const awayIndex = eventIdx * 2 + 1;
      slots.push({
        round,
        index: homeIndex,
        occupant: occupantFor(p.match.home),
        match: p.match,
      });
      slots.push({
        round,
        index: awayIndex,
        occupant: occupantFor(p.match.away),
        match: p.match,
      });
    });
  }
  return slots;
}

function occupantFor(side: MatchSide): BracketOccupant {
  if (side.team) return { kind: 'team', team: side.team };
  if (side.placeholderLabel) return { kind: 'placeholder', label: side.placeholderLabel };
  return { kind: 'empty' };
}

// ---------- summary → events ----------

function parseMinute(displayValue: string | undefined): number {
  if (!displayValue) return 0;
  const m = displayValue.trim().match(/^(\d+)(?:\+(\d+))?'?$/);
  if (!m) return 0;
  const base = parseInt(m[1], 10);
  const stoppage = m[2] ? parseInt(m[2], 10) : 0;
  return base + (stoppage > 0 ? Math.ceil(stoppage) : 0);
}

function classifyEventType(typeText: string | undefined): MatchEventType {
  if (!typeText) return 'info';
  const t = typeText.trim().toLowerCase();
  if (t.startsWith('kick off') || t.startsWith('kickoff') || t.startsWith('start of')) return 'kickoff';
  if (t.startsWith('goal') || t.startsWith('penalty - scored') || t.startsWith('own goal')) return 'goal';
  if (t.startsWith('yellow card')) return 'yellow-card';
  if (t.startsWith('red card') || t.startsWith('second yellow')) return 'red-card';
  if (t.startsWith('substitution')) return 'substitution';
  if (t.startsWith('end of first half') || t.startsWith('half-time') || t.startsWith('halftime')) return 'half-time';
  if (t.startsWith('end of regulation') || t.startsWith('full time') || t.startsWith('full-time')) return 'full-time';
  return 'info';
}

function attributePlayers(
  type: MatchEventType,
  participants: readonly { readonly athlete?: { readonly displayName?: string } }[] | undefined,
): { primaryPlayer?: string; secondaryPlayer?: string } {
  const names = (participants ?? [])
    .map((p) => p?.athlete?.displayName)
    .filter((n): n is string => typeof n === 'string' && n.length > 0);
  if (names.length === 0) return {};
  if (type === 'goal') {
    return { primaryPlayer: names[0], secondaryPlayer: names[1] };
  }
  if (type === 'substitution') {
    // ESPN convention: first participant going OFF, second coming ON.
    return { primaryPlayer: names[0], secondaryPlayer: names[1] };
  }
  if (type === 'yellow-card' || type === 'red-card') {
    return { primaryPlayer: names[0] };
  }
  return { primaryPlayer: names[0], secondaryPlayer: names[1] };
}

export function mapSummaryToEvents(raw: unknown, matchId: string): MatchEvent[] {
  if (!isRecord(raw) || !Array.isArray(raw['plays'])) {
    throw new Error('Summary response did not match expected shape.');
  }
  const plays = raw['plays'] as readonly unknown[];
  const events: MatchEvent[] = [];
  for (const play of plays) {
    if (!isRecord(play)) continue;
    const p = play as unknown as RawSummaryPlay;
    const id = p.id;
    if (!id) continue;
    const period = p.period?.number ?? 1;
    const minute = parseMinute(p.clock?.displayValue);
    const type = classifyEventType(p.type?.text);
    const players = attributePlayers(type, p.participants);
    const description = p.text ?? p.type?.text ?? '';
    events.push({
      id,
      matchId,
      minute,
      period,
      type,
      teamId: p.team?.id,
      ...(players.primaryPlayer ? { primaryPlayer: players.primaryPlayer } : {}),
      ...(players.secondaryPlayer ? { secondaryPlayer: players.secondaryPlayer } : {}),
      description,
    });
  }
  events.sort((a, b) => {
    if (a.period !== b.period) return a.period - b.period;
    return a.minute - b.minute;
  });
  return events;
}

