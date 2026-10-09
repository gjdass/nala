import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Sleep } from '../../core/sleeps/sleep.models';
import { SleepService } from '../../core/sleeps/sleep.service';
import { HistorySource } from '../../core/history/history-source.models';
import { HistoryPage } from '../../core/sections/section.models';
import { SleepEntryComponent } from './sleep-entry/sleep-entry.component';

/** The Sleep section (spec 06) as History lists it (spec 11): timed by its start, a live sleep included. */
@Injectable({ providedIn: 'root' })
export class SleepHistorySource implements HistorySource<Sleep> {
  private readonly api = inject(SleepService);
  readonly item = SleepEntryComponent;

  page(babyId: string, cursor: string | null, limit: number): Observable<HistoryPage<Sleep>> {
    return this.api.page(babyId, cursor, limit);
  }

  time(entry: Sleep): Date {
    return new Date(entry.startTime);
  }

  readonly kind: (entry: Sleep) => string = () => 'sleep';

  inputs(entry: Sleep): Record<string, unknown> {
    return { sleep: entry };
  }
}
