import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HealthEntry } from '../../core/health-entries/health-entry.models';
import { HealthEntryService } from '../../core/health-entries/health-entry.service';
import { HistorySource } from '../../core/history/history-source.models';
import { HistoryPage } from '../../core/sections/section.models';
import { HealthEntryComponent } from './health-entry/health-entry.component';

/** The Health section (spec 09) as History lists it (spec 11): timed by its time. */
@Injectable({ providedIn: 'root' })
export class HealthHistorySource implements HistorySource<HealthEntry> {
  private readonly api = inject(HealthEntryService);
  readonly item = HealthEntryComponent;

  page(babyId: string, cursor: string | null, limit: number): Observable<HistoryPage<HealthEntry>> {
    return this.api.page(babyId, cursor, limit);
  }

  time(entry: HealthEntry): Date {
    return new Date(entry.time);
  }

  readonly kind: (entry: HealthEntry) => string = () => 'health';

  inputs(entry: HealthEntry): Record<string, unknown> {
    return { healthEntry: entry };
  }
}
