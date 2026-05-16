import { Injectable, signal, type WritableSignal } from '@angular/core';

import { LiveDataConfig } from './live-data.config';
import {
  mapScoreboardToBracket,
  mapScoreboardToMatches,
  mapStandings,
  mapSummaryToEvents,
} from './espn';
import type {
  BracketSlot,
  Group,
  Match,
  MatchEvent,
  SectionState,
} from './live-data.types';

@Injectable({ providedIn: 'root' })
export class LiveDataService {
  readonly standingsState = signal<SectionState<readonly Group[]>>({ status: 'idle' });
  readonly matchesState = signal<SectionState<readonly Match[]>>({ status: 'idle' });
  readonly bracketState = signal<SectionState<readonly BracketSlot[]>>({ status: 'idle' });
  readonly timelineStateByMatchId = signal<
    ReadonlyMap<string, SectionState<readonly MatchEvent[]>>
  >(new Map());

  readonly previousStandings = signal<readonly Group[] | null>(null);
  readonly previousMatches = signal<readonly Match[] | null>(null);
  readonly previousBracket = signal<readonly BracketSlot[] | null>(null);
  readonly previousTimelineByMatchId = signal<ReadonlyMap<string, readonly MatchEvent[]>>(new Map());

  private lastScoreboardRaw: unknown = null;

  constructor() {
    this.kickOffEagerLoads();
  }

  private kickOffEagerLoads(): void {
    void this.refreshStandings();
    void this.refreshScoreboardSections();
  }

  async refreshStandings(): Promise<void> {
    this.transitionToLoading(this.standingsState, this.previousStandings);
    try {
      const raw = await this.fetchWithTimeout(LiveDataConfig.primary.standings);
      const data = mapStandings(raw);
      this.standingsState.set({ status: 'success', data, fetchedAt: Date.now() });
    } catch (err) {
      this.standingsState.set({ status: 'error', message: errorMessage(err) });
    }
  }

  async refreshMatches(): Promise<void> {
    return this.refreshScoreboardSections();
  }

  async refreshBracket(): Promise<void> {
    return this.refreshScoreboardSections();
  }

  private async refreshScoreboardSections(): Promise<void> {
    this.transitionToLoading(this.matchesState, this.previousMatches);
    this.transitionToLoading(this.bracketState, this.previousBracket);
    try {
      const raw = await this.fetchWithTimeout(LiveDataConfig.primary.scoreboard);
      this.applyScoreboard(raw);
    } catch (err) {
      const message = errorMessage(err);
      this.matchesState.set({ status: 'error', message });
      this.bracketState.set({ status: 'error', message });
    }
  }

  private applyScoreboard(raw: unknown): void {
    this.lastScoreboardRaw = raw;
    const now = Date.now();
    try {
      const matches = mapScoreboardToMatches(raw);
      this.matchesState.set({ status: 'success', data: matches, fetchedAt: now });
    } catch (err) {
      this.matchesState.set({ status: 'error', message: errorMessage(err) });
    }
    try {
      const bracket = mapScoreboardToBracket(raw);
      this.bracketState.set({ status: 'success', data: bracket, fetchedAt: now });
    } catch (err) {
      this.bracketState.set({ status: 'error', message: errorMessage(err) });
    }
  }

  async refreshTimeline(matchId: string): Promise<void> {
    const current = this.timelineStateByMatchId().get(matchId) ?? { status: 'idle' as const };
    if (current.status === 'success') {
      const prev = new Map(this.previousTimelineByMatchId());
      prev.set(matchId, current.data);
      this.previousTimelineByMatchId.set(prev);
    }
    const loadingMap = new Map(this.timelineStateByMatchId());
    loadingMap.set(matchId, { status: 'loading' });
    this.timelineStateByMatchId.set(loadingMap);

    try {
      const raw = await this.fetchWithTimeout(LiveDataConfig.primary.summary(matchId));
      const events = mapSummaryToEvents(raw, matchId);
      const successMap = new Map(this.timelineStateByMatchId());
      successMap.set(matchId, { status: 'success', data: events, fetchedAt: Date.now() });
      this.timelineStateByMatchId.set(successMap);
    } catch (err) {
      const errorMap = new Map(this.timelineStateByMatchId());
      errorMap.set(matchId, { status: 'error', message: errorMessage(err) });
      this.timelineStateByMatchId.set(errorMap);
    }
  }

  timelineFor(matchId: string): SectionState<readonly MatchEvent[]> {
    return this.timelineStateByMatchId().get(matchId) ?? { status: 'idle' };
  }

  previousTimelineFor(matchId: string): readonly MatchEvent[] | null {
    return this.previousTimelineByMatchId().get(matchId) ?? null;
  }

  private transitionToLoading<T>(
    state: WritableSignal<SectionState<T>>,
    previous: WritableSignal<T | null>,
  ): void {
    const current = state();
    if (current.status === 'success') {
      previous.set(current.data);
    }
    state.set({ status: 'loading' });
  }

  private async fetchWithTimeout<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LiveDataConfig.timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText || ''}`.trim());
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return `Request timed out after ${LiveDataConfig.timeoutMs / 1000} seconds.`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

