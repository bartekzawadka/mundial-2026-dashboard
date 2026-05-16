# Contract: ESPN `fifa.world/scoreboard`

**Endpoint**: `GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719`

**Auth**: none.

**Used by**: `mapScoreboardToMatches`, `mapScoreboardToBracket` in
`src/app/data/espn.ts`.

**Per-request timeout**: 10 seconds (FR-011, enforced by `AbortController`).

## Required fields

Response root shape:

```ts
{ events: ScoreboardEvent[] }
```

| Path | Type | Required? | Maps to |
|------|------|-----------|---------|
| `events[].id` | `string` | yes | `Match.id` |
| `events[].date` | ISO-8601 UTC string | yes | `Match.kickoffUtc` |
| `events[].status.type.state` | `'pre' \| 'in' \| 'post'` | yes | `MatchStatus` (`pre→scheduled`, `in→live`, `post→finished`) |
| `events[].season.type` | `number` (2 = group, 3 = knockout) | yes | `Stage.kind` discriminator |
| `events[].week.number` | `number` | when `season.type === 2` | matchday `1 \| 2 \| 3` |
| `events[].notes[].headline` | `string` | when `season.type === 3` | knockout stage hint (`"Round of 32"`, `"Round of 16"`, `"Quarterfinal"`, `"Semifinal"`, `"Final"`) |
| `events[].competitions[0].venue.fullName` | `string` | yes | `Match.venue` |
| `events[].competitions[0].venue.address.city` | `string` | yes | `Match.hostCity` |
| `events[].competitions[0].competitors[]` | `array` of length 2 | yes | `Match.home`, `Match.away` (sorted by `homeAway`) |
| `events[].competitions[0].competitors[].homeAway` | `'home' \| 'away'` | yes | side selector |
| `events[].competitions[0].competitors[].team.id` | `string` | yes | `Team.id` |
| `events[].competitions[0].competitors[].team.displayName` | `string` | yes | `Team.name` OR placeholder label (when pre-resolution) |
| `events[].competitions[0].competitors[].team.abbreviation` | `string` | yes | flag emoji derivation key (ISO-2) |
| `events[].competitions[0].competitors[].score` | `string` (parseable to int) | when state in `'in' \| 'post'` | `Score.home` / `Score.away` |

## Placeholder rule

When `competitor.team.id` is missing or unstable and
`competitor.team.displayName` is something like `"Winner Group A"`,
`"Runner-up Group B"`, or `"3B/E/F"`, the mapper sets
`MatchSide.placeholderLabel = displayName` and leaves `team` undefined
(per Clarifications §5: verbatim from source). When both `team.id` and a
displayable name are present, `team` is populated and
`placeholderLabel` is left undefined.

## Drift behaviour

- If the response root is not an object with `events: array`, the
  mapper throws and the matches section transitions to `error`.
- If a single event is missing a required field above, that event is
  dropped from the populated set. The section continues with the
  remaining valid events.
- If ALL events are invalid, the section transitions to `error`
  (Edge Case "Source schema drift").

## Sample minimal response

Illustrative only (subset of fields, not normative):

```json
{
  "events": [
    {
      "id": "725347",
      "date": "2026-06-11T00:00Z",
      "status": { "type": { "state": "pre" } },
      "season": { "type": 2 },
      "week": { "number": 1 },
      "competitions": [{
        "venue": {
          "fullName": "Estadio Azteca",
          "address": { "city": "Mexico City" }
        },
        "competitors": [
          {
            "homeAway": "home",
            "team": { "id": "203", "displayName": "Mexico", "abbreviation": "MEX" },
            "score": "0"
          },
          {
            "homeAway": "away",
            "team": { "id": "208", "displayName": "TBD", "abbreviation": "TBD" },
            "score": "0"
          }
        ]
      }]
    }
  ]
}
```

