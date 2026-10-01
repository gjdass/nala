import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LiveEntriesSync } from '../timers/live-entries-sync';
import { Sleep } from './sleep.models';
import { SleepService } from './sleep.service';

/** The live sleeps of every baby, shared by every device (spec 06), on the shared live-entries sync. */
@Injectable({ providedIn: 'root' })
export class SleepSyncService extends LiveEntriesSync<Sleep> {
  private readonly sleeps = inject(SleepService);

  protected load(): Observable<Sleep[]> {
    return this.sleeps.inProgress();
  }
}
