import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import {
  EntryDeleteResult,
  EntryResult,
  toDeleteResult,
  toEntryResult,
} from '../entries/entry-result';
import { OfflineQueueService } from '../offline/offline-queue.service';
import { HistoryPage } from '../sections/section.models';
import { HealthEntry, HealthEntryFields, RecentMedicine } from './health-entry.models';

/**
 * A baby's health entry doses (spec 09); any member can add, edit and delete any dose. Adding, editing and
 * deleting go through the offline queue: without a network they are kept on the device and sent later.
 */
@Injectable({ providedIn: 'root' })
export class HealthEntryService {
  private readonly http = inject(HttpClient);
  private readonly queue = inject(OfflineQueueService);

  /** One page of the baby's doses, newest first; errors when it can't be loaded (the history offers Try again). */
  page(babyId: string, cursor: string | null, limit?: number): Observable<HistoryPage<HealthEntry>> {
    let params = new HttpParams();
    if (cursor !== null) {
      params = params.set('cursor', cursor);
    }
    if (limit !== undefined) {
      params = params.set('limit', limit);
    }
    return this.http.get<HistoryPage<HealthEntry>>(`/api/babies/${babyId}/health-entries`, { params });
  }

  /** The baby's recently given names, most recent first, with their last dose; none when they can't be loaded. */
  recent(babyId: string): Observable<RecentMedicine[]> {
    return this.http
      .get<RecentMedicine[]>(`/api/babies/${babyId}/health-entries/recent`)
      .pipe(catchError(() => of([])));
  }

  /**
   * Adds a dose under a client-generated id: sending the same id again returns the stored dose
   * instead of adding a second one.
   */
  create(
    babyId: string,
    fields: HealthEntryFields,
    id: string = crypto.randomUUID(),
  ): Observable<EntryResult<HealthEntry>> {
    return this.queue
      .send<HealthEntry>('POST', '/api/health-entries', { id, babyId, ...fields })
      .pipe(map(toEntryResult));
  }

  /** Replaces every field. */
  update(id: string, fields: HealthEntryFields): Observable<EntryResult<HealthEntry>> {
    return this.queue
      .send<HealthEntry>('PUT', `/api/health-entries/${id}`, fields)
      .pipe(map(toEntryResult));
  }

  delete(id: string): Observable<EntryDeleteResult> {
    return this.queue
      .send<void>('DELETE', `/api/health-entries/${id}`, null)
      .pipe(map(toDeleteResult));
  }
}
