import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  EntryDeleteResult,
  EntryResult,
  toDeleteResult,
  toEntryResult,
} from '../entries/entry-result';
import { OfflineQueueService } from '../offline/offline-queue.service';
import { HistoryPage } from '../sections/section.models';
import { Pump, PumpFields } from './pump.models';

/**
 * A baby's pumping sessions (spec 08); any member can add, edit and delete any session. Adding,
 * editing and deleting go through the offline queue: without a network they are kept on the device
 * and sent later.
 */
@Injectable({ providedIn: 'root' })
export class PumpService {
  private readonly http = inject(HttpClient);
  private readonly queue = inject(OfflineQueueService);

  /** One page of the baby's sessions, newest first; errors when it can't be loaded (the history offers Try again). */
  page(babyId: string, cursor: string | null, limit?: number): Observable<HistoryPage<Pump>> {
    let params = new HttpParams();
    if (cursor !== null) {
      params = params.set('cursor', cursor);
    }
    if (limit !== undefined) {
      params = params.set('limit', limit);
    }
    return this.http.get<HistoryPage<Pump>>(`/api/babies/${babyId}/pumps`, { params });
  }

  /**
   * Adds a session typed by hand under a client-generated id: sending the same id again returns the
   * stored session instead of adding a second one.
   */
  create(
    babyId: string,
    fields: PumpFields,
    id: string = crypto.randomUUID(),
  ): Observable<EntryResult<Pump>> {
    return this.queue
      .send<Pump>('POST', '/api/pumps', { id, babyId, ...fields })
      .pipe(map(toEntryResult));
  }

  /** Replaces the start time, end time, volumes and notes; a live session has no end time and stays live. */
  update(id: string, fields: PumpFields): Observable<EntryResult<Pump>> {
    return this.queue.send<Pump>('PUT', `/api/pumps/${id}`, fields).pipe(map(toEntryResult));
  }

  delete(id: string): Observable<EntryDeleteResult> {
    return this.queue.send<void>('DELETE', `/api/pumps/${id}`, null).pipe(map(toDeleteResult));
  }
}
