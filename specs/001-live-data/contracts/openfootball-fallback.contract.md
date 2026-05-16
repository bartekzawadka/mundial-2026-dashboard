# Contract: OpenFootball fallback (DS-B)

**Status**: Config-only. **Not contacted at runtime** per Clarifications §4.
URLs live in `src/app/data/live-data.config.ts` under `fallback:` so an
operator can flip `active: 'primary' → 'fallback'` during an extended DS-A
outage and redeploy.

**Implementation state**: `src/app/data/openfootball.ts` ships with
function-signature stubs that throw
`Error('openfootball mapper not implemented — flip requires authoring this file')`.
Per research §R5, this is the deliberate YAGNI posture: the typed contract
exists so a future flip is mechanical, but no executable mapper is built
ahead of need.

## Endpoints when active

- `GET https://raw.githubusercontent.com/openfootball/world-cup.json/master/2026/worldcup.json` — consolidated
- `GET https://raw.githubusercontent.com/openfootball/world-cup.json/master/2026/worldcup.groups.json` — composition
- `GET https://raw.githubusercontent.com/openfootball/world-cup.json/master/2026/worldcup.knockout.json` — bracket

**Auth**: none. `raw.githubusercontent.com` serves
`Access-Control-Allow-Origin: *`.

## Required fields (`worldcup.json`)

Response root shape:

```ts
{
  name: string;
  rounds: Round[];
}

interface Round {
  name: string;            // 'Matchday 1' | 'Round of 32' | 'Quarter-final' | ...
  matches: OFMatch[];
}

interface OFMatch {
  num?: number;
  date: string;            // 'YYYY-MM-DD' wall-clock at venue
  time?: string;           // 'HH:MM' wall-clock at venue
  team1: { name: string; code?: string };
  team2: { name: string; code?: string };
  group?: string;          // 'A'..'L' for group matches
  score?: { ft?: [number, number]; ht?: [number, number] };
}
```

| Path | Maps to |
|------|---------|
| `rounds[].name` | `Stage` (string match: "Matchday 1/2/3" → group; "Round of 32" → r32; etc.) |
| `rounds[].matches[].date` + `.time` | combined with a venue→IANA-zone table → `Match.kickoffUtc` |
| `rounds[].matches[].team1.name` / `.team2.name` | `Team.name` (if literal team) OR `MatchSide.placeholderLabel` (if string like `"Winner Group A"`) |
| `rounds[].matches[].team1.code` / `.team2.code` | flag emoji derivation (ISO-2 when present) |
| `rounds[].matches[].group` | `GroupCode` for group matches |
| `rounds[].matches[].score.ft` | `Score` (full-time only — DS-B does not publish live scores) |

## Required fields (`worldcup.groups.json`)

Provides the 12-group composition independent of standings (useful
pre-tournament). Shape:

```ts
{
  groups: Array<{ name: string; teams: Array<{ name: string; code?: string }> }>
}
```

Used by the fallback mapper to construct empty `Group` rows
(0-played / 0-points) before any match has kicked off.

## Required fields (`worldcup.knockout.json`)

Provides the bracket-only structure. Shape mirrors `worldcup.json`'s
knockout rounds. Used to populate `BracketSlot[]` when DS-B is active.

## Capability gaps vs. DS-A (recorded for the operator)

| Gap | Effect when DS-B is active |
|-----|-----------------------------|
| No live in-progress scores | Matches that have started but not finished render as `scheduled` until DS-B's next commit (typically end-of-matchday). |
| No per-match timelines | US4 reverts to "events not yet available" universally. Inline expand still works; the body shows the empty state. |
| No bracket placeholder labels matching ESPN style | DS-B does carry source-verbatim placeholders (e.g., `"Winner Group A"`) — Clarifications §5 is still satisfied. |
| No UTC kickoff time | Mapper must consult a small venue → IANA-zone lookup table to combine `date`+`time` into UTC. The 16 host venues × their IANA zones is a static map authored at flip time. |
| Lower update cadence | SC-003 ("95% of visible values match official within 60 s") is not achievable under DS-B; this is a known degradation accepted as the price of fallback. |

## Drift behaviour (when active)

Same general rule as the ESPN contracts: required-field violations
throw inside the mapper, the section transitions to `error`, other
sections remain rendered.

## Sample minimal response

Illustrative only:

```json
{
  "name": "World Cup 2026",
  "rounds": [
    {
      "name": "Matchday 1",
      "matches": [
        {
          "num": 1,
          "date": "2026-06-11",
          "time": "18:00",
          "team1": { "name": "Mexico", "code": "MEX" },
          "team2": { "name": "TBD" },
          "group": "A"
        }
      ]
    }
  ]
}
```

