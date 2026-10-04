import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { toDeleteResult } from '../entries/entry-result';
import { toFieldErrors } from '../http/field-errors';
import { SendOutcome } from '../offline/offline-queue.models';
import { OfflineQueueService } from '../offline/offline-queue.service';
import { HistoryPage } from '../sections/section.models';
import {
  BottleDefaults,
  BreastSide,
  BreastfeedState,
  Feed,
  FeedDeleteResult,
  FeedFieldsByKind,
  FeedResult,
  NO_BOTTLE_DEFAULTS,
  NO_BREASTFEED_STATE,
} from './feed.models';

/**
 * A baby's feeds (spec 05); any member can add, edit and delete any feed. Adding, editing, deleting
 * and the breastfeed timer taps go through the offline queue: without a network they are kept on the
 * device and sent later.
 */
@Injectable({ providedIn: 'root' })
export class FeedService {
  private readonly http = inject(HttpClient);
  private readonly queue = inject(OfflineQueueService);

  /** One page of the baby's feeds, newest first; errors when it can't be loaded (the history offers Try again). */
  page(babyId: string, cursor: string | null, limit?: number): Observable<HistoryPage<Feed>> {
    let params = new HttpParams();
    if (cursor !== null) {
      params = params.set('cursor', cursor);
    }
    if (limit !== undefined) {
      params = params.set('limit', limit);
    }
    return this.http.get<HistoryPage<Feed>>(`/api/babies/${babyId}/feeds`, { params });
  }

  /**
   * Adds a feed of the given kind under a client-generated id: sending the same id again returns the
   * stored feed instead of adding a second one.
   */
  create<K extends keyof FeedFieldsByKind>(
    babyId: string,
    kind: K,
    fields: FeedFieldsByKind[K],
    id: string = crypto.randomUUID(),
  ): Observable<FeedResult> {
    return this.queue
      .send<Feed>('POST', '/api/feeds', { id, babyId, kind, ...fields })
      .pipe(map(toFeedResult));
  }

  /** Replaces every field of the feed's kind. */
  update(id: string, fields: FeedFieldsByKind[keyof FeedFieldsByKind]): Observable<FeedResult> {
    return this.queue.send<Feed>('PUT', `/api/feeds/${id}`, fields).pipe(map(toFeedResult));
  }

  delete(id: string): Observable<FeedDeleteResult> {
    return this.queue.send<void>('DELETE', `/api/feeds/${id}`, null).pipe(map(toDeleteResult));
  }

  /**
   * The feed; null once it no longer exists (deleted, e.g. on another device). Errors when it can't be
   * loaded.
   */
  get(id: string): Observable<Feed | null> {
    return this.http
      .get<Feed>(`/api/feeds/${id}`)
      .pipe(
        catchError((error: HttpErrorResponse) =>
          error.status === 404 ? of(null) : throwError(() => error),
        ),
      );
  }

  /** What the Bottle sheet pre-fills; none when they can't be loaded (the sheet still works without). */
  bottleDefaults(babyId: string): Observable<BottleDefaults> {
    return this.http
      .get<BottleDefaults>(`/api/babies/${babyId}/feeds/bottle-defaults`)
      .pipe(catchError(() => of(NO_BOTTLE_DEFAULTS)));
  }

  /** The baby's live breastfeed and last side; none when they can't be loaded. */
  breastfeedState(babyId: string): Observable<BreastfeedState> {
    return this.http
      .get<BreastfeedState>(`/api/babies/${babyId}/feeds/breastfeed`)
      .pipe(catchError(() => of(NO_BREASTFEED_STATE)));
  }

  /**
   * Starts `side` of the breastfeed `feedId` at `at`, stopping the other side. The server creates the
   * live feed when it doesn't exist, and makes a stopped one live again; another live breastfeed of
   * the baby answers `breastfeedInProgress`. Client ids and times make a re-sent tap harmless.
   * Offline, the tap is kept on the device marked `queued`: the server then keeps it as a separate
   * feed even if another one is live by the time it arrives.
   */
  startSide(
    feedId: string,
    babyId: string,
    side: BreastSide,
    at: string,
    segmentId: string = crypto.randomUUID(),
  ): Observable<FeedResult> {
    const body = { babyId, segmentId, side, at };
    return this.queue
      .send<Feed>(
        'POST',
        `/api/feeds/${feedId}/breastfeed/start`,
        { ...body, queued: false },
        {
          queuedBody: { ...body, queued: true },
          quiet: true,
        },
      )
      .pipe(map(toFeedResult));
  }

  /** Stops the running side at `at`, which ends the feed: it is no longer live. */
  stopSide(feedId: string, at: string): Observable<FeedResult> {
    return this.queue
      .send<Feed>('POST', `/api/feeds/${feedId}/breastfeed/stop`, { at }, { quiet: true })
      .pipe(map(toFeedResult));
  }
}

function toFeedResult(outcome: SendOutcome<Feed>): FeedResult {
  if ('error' in outcome) {
    return { ok: false, errors: toFieldErrors(outcome.error) };
  }
  return 'queued' in outcome ? { ok: true, queued: true } : { ok: true, feed: outcome.sent };
}
