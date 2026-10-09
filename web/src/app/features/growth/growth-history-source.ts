import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SelectedBabyService } from '../../core/babies/selected-baby.service';
import { GrowthEntry } from '../../core/growth-entries/growth-entry.models';
import { GrowthEntryService } from '../../core/growth-entries/growth-entry.service';
import { localDate } from '../../core/growth-entries/measurement';
import { HistorySource } from '../../core/history/history-source.models';
import { HistoryPage } from '../../core/sections/section.models';
import { GrowthEntryComponent } from './growth-entry/growth-entry.component';

/**
 * The Growth section (spec 10) as History lists it (spec 11): an entry is date-only, so it counts as
 * local midnight of its date; its item shows the baby's age on that date. No Birth item.
 */
@Injectable({ providedIn: 'root' })
export class GrowthHistorySource implements HistorySource<GrowthEntry> {
  private readonly api = inject(GrowthEntryService);
  private readonly store = inject(SelectedBabyService);
  readonly item = GrowthEntryComponent;

  page(babyId: string, cursor: string | null, limit: number): Observable<HistoryPage<GrowthEntry>> {
    return this.api.page(babyId, cursor, limit);
  }

  time(entry: GrowthEntry): Date {
    return localDate(entry.date);
  }

  kind(entry: GrowthEntry): string {
    return entry.kind;
  }

  inputs(entry: GrowthEntry): Record<string, unknown> {
    return { growthEntry: entry, birthDate: this.store.selected()?.birthDate ?? null };
  }
}
