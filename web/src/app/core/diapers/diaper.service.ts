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
import { Diaper, DiaperFields } from './diaper.models';

/**
 * A baby's diapers (spec 07); any member can add, edit and delete any diaper. Adding, editing and
 * deleting go through the offline queue: without a network they are kept on the device and sent later.
 */
@Injectable({ providedIn: 'root' })
export class DiaperService {
  private readonly http = inject(HttpClient);
  private readonly queue = inject(OfflineQueueService);

  /** One page of the baby's diapers, newest first; errors when it can't be loaded (the history offers Try again). */
  page(babyId: string, cursor: string | null, limit?: number): Observable<HistoryPage<Diaper>> {
    let params = new HttpParams();
    if (cursor !== null) {
      params = params.set('cursor', cursor);
    }
    if (limit !== undefined) {
      params = params.set('limit', limit);
    }
    return this.http.get<HistoryPage<Diaper>>(`/api/babies/${babyId}/diapers`, { params });
  }

  /**
   * Adds a diaper under a client-generated id: sending the same id again returns the stored diaper
   * instead of adding a second one.
   */
  create(
    babyId: string,
    fields: DiaperFields,
    id: string = crypto.randomUUID(),
  ): Observable<EntryResult<Diaper>> {
    return this.queue
      .send<Diaper>('POST', '/api/diapers', { id, babyId, ...fields })
      .pipe(map(toEntryResult));
  }

  /** Replaces every field. */
  update(id: string, fields: DiaperFields): Observable<EntryResult<Diaper>> {
    return this.queue.send<Diaper>('PUT', `/api/diapers/${id}`, fields).pipe(map(toEntryResult));
  }

  delete(id: string): Observable<EntryDeleteResult> {
    return this.queue.send<void>('DELETE', `/api/diapers/${id}`, null).pipe(map(toDeleteResult));
  }
}
