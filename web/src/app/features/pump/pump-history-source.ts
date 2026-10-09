import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Pump } from '../../core/pumps/pump.models';
import { PumpService } from '../../core/pumps/pump.service';
import { HistorySource } from '../../core/history/history-source.models';
import { HistoryPage } from '../../core/sections/section.models';
import { PumpEntryComponent } from './pump-entry/pump-entry.component';

/** The Pump section (spec 08) as History lists it (spec 11): timed by its start, a live session included. */
@Injectable({ providedIn: 'root' })
export class PumpHistorySource implements HistorySource<Pump> {
  private readonly api = inject(PumpService);
  readonly item = PumpEntryComponent;

  page(babyId: string, cursor: string | null, limit: number): Observable<HistoryPage<Pump>> {
    return this.api.page(babyId, cursor, limit);
  }

  time(entry: Pump): Date {
    return new Date(entry.startTime);
  }

  readonly kind: (entry: Pump) => string = () => 'pump';

  inputs(entry: Pump): Record<string, unknown> {
    return { pump: entry };
  }
}
