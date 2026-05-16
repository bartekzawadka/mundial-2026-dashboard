/**
 * OpenFootball fallback (DS-B) mapper stubs.
 *
 * Config-only fallback per Clarifications §4. These functions are NEVER
 * invoked at runtime — DS-B is reached only when an operator flips
 * `LiveDataConfig.active` from `'primary'` to `'fallback'` and redeploys.
 * The flip procedure is documented in
 * specs/001-live-data/quickstart.md §"Flip primary ↔ fallback".
 *
 * The typed signatures exist so a future flip is mechanical; the bodies
 * throw to make accidental activation loud (research §R5, YAGNI per
 * Constitution III).
 */

import type { BracketSlot, Group, Match } from './live-data.types';

const NOT_IMPLEMENTED =
  'openfootball mapper not implemented — flip requires authoring this file';

export function mapWorldCupToMatches(_raw: unknown): Match[] {
  throw new Error(NOT_IMPLEMENTED);
}

export function mapWorldCupGroupsToGroups(_raw: unknown): Group[] {
  throw new Error(NOT_IMPLEMENTED);
}

export function mapWorldCupKnockoutToBracket(_raw: unknown): BracketSlot[] {
  throw new Error(NOT_IMPLEMENTED);
}

