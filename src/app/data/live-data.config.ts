// Single configuration surface (FR-008).
// Only the `active` source family is contacted at runtime. The `fallback`
// URLs are config-only per Clarifications §4 and are NEVER fetched at
// runtime — they exist so an operator can flip `active: 'primary' →
// 'fallback'` during an extended DS-A outage and redeploy. See
// specs/001-live-data/quickstart.md §"Flip primary ↔ fallback".

export interface LiveDataConfig {
  readonly active: 'primary' | 'fallback';
  readonly primary: {
    readonly scoreboard: string;
    readonly standings: string;
    readonly summary: (eventId: string) => string;
  };
  readonly fallback: {
    readonly worldcup: string;
    readonly groups: string;
    readonly knockout: string;
  };
  readonly timeoutMs: number;
}

const ESPN_BASE =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';

const OPENFOOTBALL_BASE =
  'https://raw.githubusercontent.com/openfootball/world-cup.json/master/2026';

export const LiveDataConfig: LiveDataConfig = {
  active: 'primary',
  primary: {
    scoreboard: `${ESPN_BASE}/scoreboard?dates=20260611-20260719`,
    standings: `${ESPN_BASE}/standings`,
    summary: (eventId: string) =>
      `${ESPN_BASE}/summary?event=${encodeURIComponent(eventId)}`,
  },
  fallback: {
    worldcup: `${OPENFOOTBALL_BASE}/worldcup.json`,
    groups: `${OPENFOOTBALL_BASE}/worldcup.groups.json`,
    knockout: `${OPENFOOTBALL_BASE}/worldcup.knockout.json`,
  },
  timeoutMs: 10_000,
};

