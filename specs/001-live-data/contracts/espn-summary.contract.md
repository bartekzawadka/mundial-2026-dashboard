# Contract: ESPN `fifa.world/summary`

**Endpoint**: `GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event={eventId}`

**Auth**: none.

**Used by**: `mapSummaryToEvents` in `src/app/data/espn.ts`.

**Triggered**: lazily, on inline match-row expand (US4 + research §R10).
At most one in-flight at a time (accordion).

**Per-request timeout**: 10 seconds (FR-011, enforced by `AbortController`).

## Required fields

Response root shape (relevant subset):

```ts
{ plays: SummaryPlay[] }
```

| Path | Type | Required? | Maps to |
|------|------|-----------|---------|
| `plays[].id` | `string` | yes | `MatchEvent.id` |
| `plays[].clock.displayValue` | `string` (e.g., `"45'"`, `"45+2'"`) | yes | parsed to `MatchEvent.minute` (number; stoppage time rounds up) |
| `plays[].period.number` | `number` | yes | minute disambiguation across halves / ET |
| `plays[].type.text` | `string` | yes | mapped to `MatchEventType` per table below |
| `plays[].team.id` | `string` | when team-attributable | `MatchEvent.teamId` |
| `plays[].participants[].athlete.displayName` | `string` | when player-attributable | `primaryPlayer` / `secondaryPlayer` |
| `plays[].text` | `string` | yes | `MatchEvent.description` (human-readable, source-derived) |

## Event-type mapping

The mapper performs case-insensitive prefix matching on
`plays[].type.text`:

| ESPN `type.text` (prefix match, case-insensitive) | Domain `MatchEventType` |
|---------------------------------------------------|--------------------------|
| `kick off`, `start of` | `kickoff` |
| `goal`, `penalty - scored`, `own goal` | `goal` |
| `yellow card` | `yellow-card` |
| `red card`, `second yellow` | `red-card` |
| `substitution` | `substitution` |
| `end of first half`, `half-time`, `halftime` | `half-time` |
| `end of regulation`, `full time`, `full-time` | `full-time` |
| anything else | `info` |

The `'info'` catch-all is intentional (research §R3): the timeline
renders unknown ESPN types as neutral chronological entries rather
than dropping them or transitioning to error.

## Drift behaviour

- If the response root is not `{ plays: array }`, mapper throws and
  the timeline section for that match transitions to `error`.
- If `plays` is an empty array AND the parent match `status !==
  'scheduled'`, the timeline section renders an
  "events not yet available" empty state (not an error). This is
  expected for matches that have started but not yet produced
  trackable events.
- If `plays` is an empty array AND the parent match `status ===
  'scheduled'`, the timeline section renders a "match hasn't started"
  empty state.

## Player attribution

For `goal` events: `primaryPlayer` is the scorer, `secondaryPlayer` is
the assister when ESPN provides one (often missing).

For `substitution` events: `primaryPlayer` is the player coming OFF,
`secondaryPlayer` is the player coming ON.

For `yellow-card` / `red-card` events: `primaryPlayer` is the carded
player; `secondaryPlayer` is left undefined.

## Sample minimal response

Illustrative only:

```json
{
  "plays": [
    {
      "id": "p1",
      "clock": { "displayValue": "0'" },
      "period": { "number": 1 },
      "type": { "text": "Kick Off" },
      "team": { "id": "203" },
      "text": "Kick off."
    },
    {
      "id": "p2",
      "clock": { "displayValue": "23'" },
      "period": { "number": 1 },
      "type": { "text": "Goal" },
      "team": { "id": "203" },
      "participants": [{ "athlete": { "displayName": "S. Giménez" } }],
      "text": "Goal scored by S. Giménez (Mexico)."
    }
  ]
}
```

