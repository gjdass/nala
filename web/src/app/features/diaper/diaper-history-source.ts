import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Diaper } from '../../core/diapers/diaper.models';
import { DiaperService } from '../../core/diapers/diaper.service';
import { HistorySource } from '../../core/history/history-source.models';
import { HistoryPage } from '../../core/sections/section.models';
import { DiaperEntryComponent } from './diaper-entry/diaper-entry.component';

/** The Diaper section (spec 07) as History lists it (spec 11): timed by its time. */
@Injectable({ providedIn: 'root' })
export class DiaperHistorySource implements HistorySource<Diaper> {
  private readonly api = inject(DiaperService);
  readonly item = DiaperEntryComponent;

  page(babyId: string, cursor: string | null, limit: number): Observable<HistoryPage<Diaper>> {
    return this.api.page(babyId, cursor, limit);
  }

  time(entry: Diaper): Date {
    return new Date(entry.time);
  }

  readonly kind: (entry: Diaper) => string = () => 'diaper';

  inputs(entry: Diaper): Record<string, unknown> {
    return { diaper: entry };
  }
}
