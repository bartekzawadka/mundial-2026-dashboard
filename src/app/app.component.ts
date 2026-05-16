import { Component, computed, inject, signal } from '@angular/core';

import { LiveDataService } from './data/live-data.service';
import type {
  BracketOccupant,
  BracketRound,
  BracketSlot,
  Group,
  GroupCode,
  Match,
  SectionState,
} from './data/live-data.types';

type View = 'groups' | 'knockout';

interface BracketPair {
  readonly round: BracketRound;
  readonly home: BracketSlot;
  readonly away: BracketSlot;
  readonly match?: Match;
}

interface BracketColumn {
  readonly round: BracketRound;
  readonly label: string;
  readonly pairs: readonly BracketPair[];
}

const ROUND_LABELS: Record<BracketRound, string> = {
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarterfinals',
  sf: 'Semifinals',
  final: 'Final',
};

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected readonly liveData = inject(LiveDataService);
  protected readonly activeView = signal<View>('groups');
  protected readonly expandedMatchId = signal<string | null>(null);

  protected readonly stats = [
    { value: '48', label: 'qualified nations' },
    { value: '12', label: 'groups of four' },
    { value: '104', label: 'matches' },
    { value: '16', label: 'host cities' },
  ];

  protected readonly skeletonGroupCodes: readonly string[] = Array.from(
    { length: 12 },
    (_, i) => `skeleton-${i}`,
  );

  protected readonly skeletonMatchKeys: readonly string[] = ['m1', 'm2', 'm3'];

  protected readonly skeletonTimelineKeys: readonly string[] = ['t1', 't2', 't3'];

  protected readonly bracketColumns = computed<readonly BracketColumn[]>(() => {
    const state = this.liveData.bracketState();
    const source: readonly BracketSlot[] | null =
      state.status === 'success'
        ? state.data
        : state.status === 'loading'
        ? this.liveData.previousBracket()
        : null;
    if (!source) return [];
    return buildBracketColumns(source);
  });

  protected readonly standingsRefreshing = computed(() => {
    const state = this.liveData.standingsState();
    return state.status === 'loading' && this.liveData.previousStandings() !== null;
  });

  protected readonly matchesRefreshing = computed(() => {
    const state = this.liveData.matchesState();
    return state.status === 'loading' && this.liveData.previousMatches() !== null;
  });

  protected readonly bracketRefreshing = computed(() => {
    const state = this.liveData.bracketState();
    return state.status === 'loading' && this.liveData.previousBracket() !== null;
  });

  protected readonly standingsGroups = computed<readonly Group[]>(() => {
    const state = this.liveData.standingsState();
    if (state.status === 'success') return state.data;
    if (state.status === 'loading') return this.liveData.previousStandings() ?? [];
    return [];
  });

  protected setView(view: View): void {
    if (this.activeView() !== view) {
      this.expandedMatchId.set(null);
    }
    this.activeView.set(view);
  }

  protected toggleExpand(matchId: string): void {
    if (this.expandedMatchId() === matchId) {
      this.expandedMatchId.set(null);
      return;
    }
    this.expandedMatchId.set(matchId);
    const existing = this.liveData.timelineStateByMatchId().get(matchId);
    if (!existing || existing.status === 'idle' || existing.status === 'error') {
      void this.liveData.refreshTimeline(matchId);
    }
  }

  protected matchesForGroup(code: GroupCode): readonly Match[] {
    const state = this.liveData.matchesState();
    let source: readonly Match[] | null = null;
    if (state.status === 'success') source = state.data;
    else if (state.status === 'loading') source = this.liveData.previousMatches();
    if (!source) return [];
    const filtered = source.filter(
      (m): m is Match & { stage: { kind: 'group'; group: GroupCode; matchday: 1 | 2 | 3 } } =>
        m.stage.kind === 'group' && m.stage.group === code,
    );
    return filtered.slice().sort((a, b) => {
      if (a.stage.matchday !== b.stage.matchday) {
        return a.stage.matchday - b.stage.matchday;
      }
      return a.kickoffUtc.localeCompare(b.kickoffUtc);
    });
  }

  protected formatKickoff(iso: string): string {
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZoneName: 'short',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  protected formatBracketDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  protected occupantName(occupant: BracketOccupant): string {
    if (occupant.kind === 'team') return occupant.team.name;
    if (occupant.kind === 'placeholder') return occupant.label;
    return '';
  }

  protected occupantFlag(occupant: BracketOccupant): string {
    return occupant.kind === 'team' ? occupant.team.flag : '';
  }

  protected isMatchClickable(match: Match | undefined): match is Match {
    return !!match?.id;
  }

  protected timelineState(matchId: string): SectionState<readonly import('./data/live-data.types').MatchEvent[]> {
    return this.liveData.timelineFor(matchId);
  }

  protected previousTimeline(matchId: string) {
    return this.liveData.previousTimelineFor(matchId);
  }

  protected timelineRefreshing(matchId: string): boolean {
    return this.timelineState(matchId).status === 'loading' && this.previousTimeline(matchId) !== null;
  }

  protected emptyTimelineLabel(match: Match): string {
    return match.status === 'scheduled'
      ? "Match hasn't started"
      : 'Events not yet available';
  }
}

function buildBracketColumns(slots: readonly BracketSlot[]): readonly BracketColumn[] {
  const order: readonly BracketRound[] = ['r32', 'r16', 'qf', 'sf', 'final'];
  const grouped = new Map<BracketRound, BracketSlot[]>();
  for (const slot of slots) {
    const arr = grouped.get(slot.round) ?? [];
    arr.push(slot);
    grouped.set(slot.round, arr);
  }
  return order
    .map((round): BracketColumn | null => {
      const roundSlots = grouped.get(round);
      if (!roundSlots || roundSlots.length === 0) return null;
      roundSlots.sort((a, b) => a.index - b.index);
      const pairs: BracketPair[] = [];
      for (let i = 0; i < roundSlots.length; i += 2) {
        const home = roundSlots[i];
        const away = roundSlots[i + 1];
        if (!home || !away) continue;
        pairs.push({ round, home, away, match: home.match ?? away.match });
      }
      return { round, label: ROUND_LABELS[round], pairs };
    })
    .filter((c): c is BracketColumn => c !== null);
}

