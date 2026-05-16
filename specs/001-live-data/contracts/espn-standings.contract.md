# Contract: ESPN `fifa.world/standings`

**Endpoint**: `GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/standings`

**Auth**: none.

**Used by**: `mapStandings` in `src/app/data/espn.ts`.

**Per-request timeout**: 10 seconds (FR-011, enforced by `AbortController`).

## Required fields

Response root shape:

```ts
{ children: StandingsGroup[] }
```

| Path | Type | Required? | Maps to |
|------|------|-----------|---------|
| `children[].name` | `string` matching `/^Group ([A-L])$/` | yes | `Group.code` |
| `children[].standings.entries[]` | `array` of length 4 | yes | `Group.teams`, `Group.standings` |
| `children[].standings.entries[].team.id` | `string` | yes | `Team.id` |
| `children[].standings.entries[].team.displayName` | `string` | yes | `Team.name` |
| `children[].standings.entries[].team.abbreviation` | `string` | yes | flag emoji derivation |
| `children[].standings.entries[].stats[]` | `array` of `{ name: string; value: number }` | yes | source of `StandingRow` numeric fields |

## Required stat names (`stats[].name`)

The mapper looks up the following stat names within each entry:

| ESPN `stats[].name` | Domain `StandingRow` field |
|---------------------|-----------------------------|
| `gamesPlayed` | `played` |
| `wins` | `wins` |
| `ties` (a.k.a. `draws` in some payloads) | `draws` |
| `losses` | `losses` |
| `pointsFor` | `goalsFor` |
| `pointsAgainst` | `goalsAgainst` |
| `pointDifferential` | `goalDifference` |
| `points` | `points` |
| `rank` | `position` |

Mapper tolerates either `ties` or `draws` for the draws stat (ESPN has
shipped both names historically).

## Drift behaviour

- If the response root is not `{ children: array }`, mapper throws and
  the standings section transitions to `error`.
- If `children` does not contain exactly 12 entries that satisfy
  `/^Group ([A-L])$/`, the standings section transitions to `error`.
  (Edge Case "Source schema drift" — incomplete standings are not
  partially rendered.)
- If a `stats[]` array is missing one of the required names, the
  corresponding `StandingRow` field defaults to `0` and a developer-
  console warning is logged. (Tolerant for non-critical stats; not
  the source of an error transition.)

## Sample minimal response

Illustrative only:

```json
{
  "children": [
    {
      "name": "Group A",
      "standings": {
        "entries": [
          {
            "team": { "id": "203", "displayName": "Mexico", "abbreviation": "MEX" },
            "stats": [
              { "name": "gamesPlayed", "value": 0 },
              { "name": "wins", "value": 0 },
              { "name": "ties", "value": 0 },
              { "name": "losses", "value": 0 },
              { "name": "pointsFor", "value": 0 },
              { "name": "pointsAgainst", "value": 0 },
              { "name": "pointDifferential", "value": 0 },
              { "name": "points", "value": 0 },
              { "name": "rank", "value": 1 }
            ]
          }
        ]
      }
    }
  ]
}
```

