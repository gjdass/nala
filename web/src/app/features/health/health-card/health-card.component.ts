import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subscription, filter } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { DosePipe } from '../../../core/health-entries/dose';
import { HealthEntry } from '../../../core/health-entries/health-entry.models';
import { HealthEntryService } from '../../../core/health-entries/health-entry.service';
import { TemperaturePipe } from '../../../core/health-entries/temperature';
import { onReload } from '../../../core/refresh/data-refresh.service';
import { loadRecentEntries } from '../../../core/sections/recent-entries';
import { HighlightDurationPipe } from '../../../core/time/highlight-duration';
import { NowService } from '../../../core/time/now.service';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { HealthEntryComponent } from '../health-entry/health-entry.component';

/**
 * The Health card on home (spec 09): the selected baby's entries of the last 24 hours (at least the
 * 3 most recent) in the shared section card, with "Last entry" and the time since the most recent
 * entry (in hours and minutes only, see `HighlightDurationPipe`), on the right that entry's name with
 * its dose and temperature under it when it has them, or its temperature alone when it has no name,
 * or an empty state without any entry. Reloads after an entry is added,
 * edited or deleted, when another baby is selected, and
 * on the reload signal (spec 04 Refresh on return).
 */
@Component({
  selector: 'nala-health-card',
  imports: [
    EmptyStateComponent,
    HighlightDurationPipe,
    MatIconModule,
    DosePipe,
    HealthEntryComponent,
    SectionCardComponent,
    SectionEntryDirective,
    TemperaturePipe,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './health-card.component.html',
  styleUrl: './health-card.component.scss',
})
export class HealthCardComponent {
  private readonly healthEntries = inject(HealthEntryService);
  private readonly entrySheets = inject(EntrySheetService);
  private readonly store = inject(SelectedBabyService);
  private readonly now = inject(NowService).now;

  /** Newest first; null while loading. */
  protected readonly entries = signal<readonly HealthEntry[] | null>(null);
  /** The dose with the latest time; null without one. */
  protected readonly last = computed(() =>
    (this.entries() ?? []).reduce<HealthEntry | null>(
      (latest, healthEntry) =>
        !latest || Date.parse(healthEntry.time) > Date.parse(latest.time) ? healthEntry : latest,
      null,
    ),
  );
  /** Since the last dose. */
  protected readonly sinceSeconds = computed(() => {
    const last = this.last();
    return last ? Math.floor((this.now() - Date.parse(last.time)) / 1000) : 0;
  });
  private request?: Subscription;

  constructor() {
    effect(() => {
      const baby = this.store.selected();
      untracked(() => {
        this.entries.set(null);
        if (baby) {
          this.load(baby.id);
        }
      });
    });
    onReload(() => this.reload());
  }

  protected reload(): void {
    const baby = this.store.selected();
    if (baby) {
      this.load(baby.id);
    }
  }

  /** The dose and the temperature, those present, joined. */
  protected detail(dose: string, temperature: string): string {
    return [dose, temperature].filter((part) => part !== '').join(' · ');
  }

  protected edit(healthEntry: HealthEntry): void {
    this.entrySheets
      .edit('health', 'health', healthEntry)
      .pipe(filter((result) => result !== undefined))
      .subscribe(() => this.reload());
  }

  private load(babyId: string): void {
    this.request?.unsubscribe();
    this.request = loadRecentEntries(
      (cursor) => this.healthEntries.page(babyId, cursor),
      (healthEntry) => healthEntry.time,
      new Date(),
    ).subscribe({ next: (entries) => this.entries.set(entries) });
  }
}
