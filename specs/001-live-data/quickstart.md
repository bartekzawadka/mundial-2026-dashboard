# Quickstart — 001-live-data

## Run the dashboard locally

```bash
npm install     # only if not done already
npm run start   # ng serve, http://localhost:4200
```

Open `http://localhost:4200` in a desktop browser AND in a 375 × 812 px
mobile viewport (Chrome DevTools device toolbar). Per Constitution
§Development Workflow & Quality Gates, both viewports MUST be verified
before requesting review.

## Manual smoke test

Run through these on first load. Each step references the spec
requirement(s) it covers.

### 1. Loading state visible (FR-015)

On a throttled connection (DevTools → Network → "Slow 4G"), each of the
three eager sections (group standings, match schedule, bracket)
displays a distinct loading skeleton before any data arrives. The
skeletons are visually distinguishable from the empty/error state.

### 2. Populated state (FR-001 a/b/c/d, SC-002)

On an unthrottled connection, within 5 seconds all three eager sections
render concrete data. The group cards show real points, GD, and
matches-played. The match rows show real teams and either kickoff
times (scheduled) or scores (live/finished). The bracket shows real
team names where resolved and source-verbatim placeholder labels
where not.

### 3. Per-section Refresh (FR-004)

In success state, each section's "Refresh" button is visible. Click
it: the section shows an inline "refreshing" indicator (research §R12)
while the previous data stays visible, then re-populates. No global
Refresh All button exists.

### 4. Inline timeline expander (US4, research §R10)

Click any match row inside the Group dashboard. The row expands in
place; a lazy `GET …/summary?event={id}` request fires (visible in
DevTools Network); events appear chronologically inside the expanded
body. Click the same row again to collapse. Click a *different* row
in the same tab — the first collapses (accordion). Repeat in the
Elimination ladder tab; the same behaviour applies.

### 5. Time-zone display (FR-013, research §R8)

Kickoff times render in the viewer's local zone with the short
abbreviation. Example on a US-Pacific machine:
`Jun 11, 2026, 4:00 PM PST`. To verify: DevTools → Sensors → "Override"
the location/timezone to Tokyo; reload; the times now render in JST.

### 6. Match-state visual distinction (FR-014)

Identify a scheduled match (future kickoff), a finished match (final
score), and — during the tournament window — a live match (running
score + visible live indicator). All three render with visually
distinct treatments. The live indicator carries `aria-live="polite"`.

### 7. Error path (FR-010, SC-006)

In DevTools → Network, right-click the `/scoreboard` request and
"Block request URL." Hard-reload (`Cmd-Shift-R`). The matches section
enters error state with a brief explanation; the standings and the
bracket section (which is derived from the same `/scoreboard` response)
both also error; the page chrome (hero, nav, tabs) still renders.
Click the in-section Refresh on standings; the request retries, still
blocked, and the error persists. Unblock the URL and click Refresh;
the affected sections re-populate. Verifies error isolation and
manual retry per Clarifications §3.

### 8. Pre-tournament rendering (Edge Case, research §R11)

Today is 2026-05-15. Until the first match kicks off, every standings
row shows 0 played / 0 points, every match row shows the scheduled
state, and every bracket slot shows a source-provided placeholder
label (or empty if the source omitted it). No section shows an error
state.

## Storage audit (FR-002, SC-004)

After a normal visit, in the DevTools console:

```js
JSON.stringify(localStorage);                  // → "{}"
JSON.stringify(sessionStorage);                // → "{}"
await indexedDB.databases();                   // → []
await caches.keys();                           // → []
```

No entry should contain tournament fixtures, standings, bracket slots,
or timeline events.

## Bundle audit (SC-005)

```bash
npm run build
grep -RIn "api[-_]?key\|bearer\|x-rapidapi" dist/ || echo "OK — no secrets in build output"
```

Expect "OK". Any match is a release blocker.

## Flip primary ↔ fallback (Clarifications §4)

**Pre-conditions**: DS-A (`site.api.espn.com`) confirmed unavailable
for the foreseeable future. Routine transient errors should NOT
trigger a flip — per Clarifications §4 the affected section's error
state and Refresh button are the user-facing retry path.

Procedure:

1. Open `src/app/data/live-data.config.ts`.
2. Change `active: 'primary'` to `active: 'fallback'`.
3. Implement the DS-B mapper stubs in `src/app/data/openfootball.ts` —
   the file currently throws by design. Field mappings are in
   `./contracts/openfootball-fallback.contract.md`. At minimum you
   need:
   - `mapWorldCupToMatches` → `Match[]`
   - `mapWorldCupGroupsToGroups` → `Group[]`
   - `mapWorldCupKnockoutToBracket` → `BracketSlot[]`
   - A venue → IANA-zone table to combine `date`+`time` into UTC.
4. `npm run build && docker build .` — verify both succeed.
5. Deploy. Re-run the smoke test above against the OpenFootball-backed
   data. Expected degradations are documented in the OpenFootball
   contract's "Capability gaps" table.

To flip back: change `active` to `'primary'` and redeploy. No mapper
rewrite needed (the ESPN mapper is the always-shipped path).

## Deletion checklist (FR-003)

The merge that lands this feature MUST delete:

- `src/app/tournament.data.ts`

…and remove the corresponding import in `src/app/app.component.ts`.
After merge:

```bash
grep -rn "tournament.data" src/   # expect: no matches
```

## What this feature does NOT add

Per `spec.md` Assumptions §"All currently rendered views remain in
scope":

- No squad pages, player statistics, top scorers, venues, or stadium
  detail views.
- No new top-level tab beyond the existing Group dashboard + Elimination
  ladder.
- No service worker, PWA manifest, push notifications, or share APIs.
- No in-session polling. Users must reload to see new values
  (FR-004); a small in-page hint informs them.

