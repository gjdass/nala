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
import { Pump, PumpFields } from './pump.models';

/**
 * A baby's pumping sessions (spec 08); any member can add, edit and delete any session, and start or
 * stop its timer. Changes and timer taps go through the offline queue: without a network they are
 * kept on the device and sent later.
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

  /** The session; null once it no longer exists (deleted, e.g. on another device). Errors when it can't be loaded. */
  get(id: string): Observable<Pump | null> {
    return this.http
      .get<Pump>(`/api/pumps/${id}`)
      .pipe(
        catchError((error: HttpErrorResponse) =>
          error.status === 404 ? of(null) : throwError(() => error),
        ),
      );
  }

  /**
   * Starts the timer of the session `id` at `at`: the server creates it live for the baby when it
   * doesn't exist, makes a stopped one live again and leaves a live one as it is; another live
   * session of the baby answers `pumpInProgress`. Offline, the tap is kept on the device marked
   * `queued`: the server then keeps it as a separate session even if another one is live by the time
   * it arrives.
   */
  start(id: string, babyId: string, at: string): Observable<EntryResult<Pump>> {
    const body = { babyId, at };
    return this.queue
      .send<Pump>(
        'POST',
        `/api/pumps/${id}/start`,
        { ...body, queued: false },
        { queuedBody: { ...body, queued: true }, quiet: true },
      )
      .pipe(map(toEntryResult));
  }

  /** Stops the timer at `at`, the session's end time: it is no longer live. */
  stop(id: string, at: string): Observable<EntryResult<Pump>> {
    return this.queue
      .send<Pump>('POST', `/api/pumps/${id}/stop`, { at }, { quiet: true })
      .pipe(map(toEntryResult));
  }
}
