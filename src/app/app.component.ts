import { Component, computed, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { GROUPS } from './tournament.data';

type View = 'groups' | 'knockout';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgClass],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  protected readonly groups = GROUPS;
  protected readonly activeView = signal<View>('groups');
  protected readonly query = signal('');
  protected readonly stats = [
    { value: '48', label: 'qualified nations' },
    { value: '12', label: 'groups of four' },
    { value: '104', label: 'matches' },
    { value: '16', label: 'host cities' }
  ];
  protected readonly filteredGroups = computed(() => {
    const q = this.query().toLowerCase().trim();
    return this.groups.filter(group => !q || `group ${group.code}`.includes(q) || group.teams.some(team => team.name.toLowerCase().includes(q)));
  });
  protected readonly rounds = [
    { title: 'Round of 32', className: 'r32', slots: Array.from({ length: 16 }, (_, i) => `Match ${i + 1}`), date: 'Jun 28 – Jul 3' },
    { title: 'Round of 16', className: 'r16', slots: Array.from({ length: 8 }, (_, i) => `Path ${i + 1}`), date: 'Jul 4 – 7' },
    { title: 'Quarterfinals', className: 'qf', slots: Array.from({ length: 4 }, (_, i) => `Quarter ${i + 1}`), date: 'Jul 9 – 11' },
    { title: 'Semifinals', className: 'sf', slots: Array.from({ length: 2 }, (_, i) => `Semi ${i + 1}`), date: 'Jul 14 – 15' },
    { title: 'Final', className: 'final', slots: ['World Champion'], date: 'Jul 19 · New York/New Jersey' }
  ];

  protected setView(view: View): void { this.activeView.set(view); }
  protected updateQuery(value: string): void { this.query.set(value); }
  protected points(groupIndex: number, teamIndex: number): number { return [7, 5, 3, 1, 6, 4, 4, 2][(groupIndex + teamIndex) % 8]; }
}
