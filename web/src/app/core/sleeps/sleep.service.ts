import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import {
  EntryDeleteResult,
  EntryResult,
  toDeleteResult,
  toEntryResult,
} from '../entries/entry-result';
import { OfflineQueueService } from '../offline/offline-queue.service';
import { HistoryPage } from '../sections/section.models';
import { Sleep, SleepFields } from './sleep.models';

/**
 * A baby's sleeps (spec 06); any member can add, edit and delete any sleep. Adding, editing and
 * deleting go through the offline queue: without a network they are kept on the device and sent later.
 */
@Injectable({ providedIn: 'root' })
export class SleepService {
  private readonly http = inject(HttpClient);
  private readonly queue = inject(OfflineQueueService);

  /** One page of the baby's sleeps, newest first; errors when it can't be loaded (the history offers Try again). */
  page(babyId: string, cursor: string | null, limit?: number): Observable<HistoryPage<Sleep>> {
    let params = new HttpParams();
    if (cursor !== null) {
      params = params.set('cursor', cursor);
    }
    if (limit !== undefined) {
      params = params.set('limit', limit);
    }
    return this.http.get<HistoryPage<Sleep>>(`/api/babies/${babyId}/sleeps`, { params });
  }

  /**
   * Adds a sleep typed by hand under a client-generated id: sending the same id again returns the
   * stored sleep instead of adding a second one.
   */
  create(
    babyId: string,
    fields: SleepFields,
    id: string = crypto.randomUUID(),
  ): Observable<EntryResult<Sleep>> {
    return this.queue
      .send<Sleep>('POST', '/api/sleeps', { id, babyId, ...fields })
      .pipe(map(toEntryResult));
  }

  /** Replaces the start time, end time and notes. */
  update(id: string, fields: SleepFields): Observable<EntryResult<Sleep>> {
    return this.queue.send<Sleep>('PUT', `/api/sleeps/${id}`, fields).pipe(map(toEntryResult));
  }

  delete(id: string): Observable<EntryDeleteResult> {
    return this.queue.send<void>('DELETE', `/api/sleeps/${id}`, null).pipe(map(toDeleteResult));
  }

  /** The sleep; null once it no longer exists (deleted, e.g. on another device). Errors when it can't be loaded. */
  get(id: string): Observable<Sleep | null> {
    return this.http
      .get<Sleep>(`/api/sleeps/${id}`)
      .pipe(
        catchError((error: HttpErrorResponse) =>
          error.status === 404 ? of(null) : throwError(() => error),
        ),
      );
  }
}
