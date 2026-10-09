import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subscription, filter } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import {
  GrowthEntry,
  GrowthLatest,
  LatestMeasure,
} from '../../../core/growth-entries/growth-entry.models';
import { GrowthEntryService } from '../../../core/growth-entries/growth-entry.service';
import { MeasurementPipe, localDate } from '../../../core/growth-entries/measurement';
import { onReload } from '../../../core/refresh/data-refresh.service';
import { loadRecentEntries } from '../../../core/sections/recent-entries';
import { EntryDatePipe } from '../../../core/time/entry-time';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { EntrySheetService } from '../../../shared/ui/entry-sheet/entry-sheet.service';
import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';
import { SectionEntryDirective } from '../../../shared/ui/section-card/section-entry.directive';
import { GrowthEntryComponent } from '../growth-entry/growth-entry.component';

/** One column of the highlight. */
interface Measure {
  key: 'weight' | 'length' | 'head';
  label: string;
  unit: 'g' | 'cm';
  latest: LatestMeasure | null;
}

/**
 * The Growth card on home (spec 10): the selected baby's entries of the last 24 hours (at least the
 * 3 most recent, an entry's date counting as its local midnight) in the shared section card, with the
 * latest weight, length and head circumference side by side (each from its latest measurement or the
 * birth profile, its date or "Birth" under it, "—" without a value), or the empty state when the baby
 * has no value at all. Without the latest values (offline), the entries show without a highlight.
 * Reloads after an entry is added, edited or deleted, when another baby is selected, and
 * on the reload signal (spec 04 Refresh on return).
 */
@Component({
  selector: 'nala-growth-card',
  imports: [
    EmptyStateComponent,
    EntryDatePipe,
    GrowthEntryComponent,
    MeasurementPipe,
    SectionCardComponent,
    SectionEntryDirective,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './growth-card.component.html',
  styleUrl: './growth-card.component.scss',
})
export class GrowthCardComponent {
  private readonly growthEntries = inject(GrowthEntryService);
  private readonly entrySheets = inject(EntrySheetService);
  private readonly store = inject(SelectedBabyService);

  protected readonly birthDate = computed(() => this.store.selected()?.birthDate ?? null);
  /** Newest first; null while loading. */
  private readonly entries = signal<readonly GrowthEntry[] | null>(null);
  /** Undefined while loading, null when it couldn't be loaded. */
  private readonly latest = signal<GrowthLatest | null | undefined>(undefined);
  /** The card body waits for both. */
  protected readonly loaded = computed(() => (this.latest() === undefined ? null : this.entries()));
  /** No value at all, birth included; never empty without the latest values. */
  protected readonly empty = computed(() => {
    const latest = this.latest();
    return latest === undefined
      ? null
      : latest !== null && !latest.weight && !latest.length && !latest.headCircumference;
  });
  protected readonly measures = computed((): Measure[] | null => {
    const latest = this.latest();
    return latest
      ? [
          { key: 'weight', label: 'growth.card.weight', unit: 'g', latest: latest.weight },
          { key: 'length', label: 'growth.card.length', unit: 'cm', latest: latest.length },
          {
            key: 'head',
            label: 'growth.card.head',
            unit: 'cm',
            latest: latest.headCircumference,
          },
        ]
      : null;
  });
  protected readonly localDate = localDate;
  private entriesRequest?: Subscription;
  private latestRequest?: Subscription;

  constructor() {
    effect(() => {
      const baby = this.store.selected();
      untracked(() => {
        this.entries.set(null);
        this.latest.set(undefined);
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

  protected edit(growthEntry: GrowthEntry): void {
    this.entrySheets
      .edit('growth', growthEntry.kind, growthEntry)
      .pipe(filter((result) => result !== undefined))
      .subscribe(() => this.reload());
  }

  private load(babyId: string): void {
    this.entriesRequest?.unsubscribe();
    this.latestRequest?.unsubscribe();
    this.entriesRequest = loadRecentEntries(
      (cursor) => this.growthEntries.page(babyId, cursor),
      (growthEntry) => localDate(growthEntry.date).toISOString(),
      new Date(),
    ).subscribe({ next: (entries) => this.entries.set(entries) });
    this.latestRequest = this.growthEntries
      .latest(babyId)
      .subscribe((latest) => this.latest.set(latest));
  }
}
