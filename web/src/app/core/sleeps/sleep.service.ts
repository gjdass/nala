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

  /** Replaces the start time, end time and notes; a live sleep has no end time and stays live. */
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

  /**
   * Starts the timer of the sleep `id` at `at`: the server creates it live for the baby when it
   * doesn't exist, makes a stopped one live again and leaves a live one as it is; another live sleep
   * of the baby answers `sleepInProgress`. Offline, the tap is kept on the device marked `queued`:
   * the server then keeps it as a separate sleep even if another one is live by the time it arrives.
   */
  start(id: string, babyId: string, at: string): Observable<EntryResult<Sleep>> {
    const body = { babyId, at };
    return this.queue
      .send<Sleep>(
        'POST',
        `/api/sleeps/${id}/start`,
        { ...body, queued: false },
        { queuedBody: { ...body, queued: true }, quiet: true },
      )
      .pipe(map(toEntryResult));
  }

  /** Stops the timer at `at`, the sleep's end time: it is no longer live. */
  stop(id: string, at: string): Observable<EntryResult<Sleep>> {
    return this.queue
      .send<Sleep>('POST', `/api/sleeps/${id}/stop`, { at }, { quiet: true })
      .pipe(map(toEntryResult));
  }
}
