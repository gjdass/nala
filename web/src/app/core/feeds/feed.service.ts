import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { toFieldErrors } from '../http/field-errors';
import { HistoryPage } from '../sections/section.models';
import {
  BottleDefaults,
  BottleFields,
  Feed,
  FeedDeleteResult,
  FeedResult,
  NO_BOTTLE_DEFAULTS,
} from './feed.models';

/** A baby's feeds (spec 05); any member can add, edit and delete any feed. */
@Injectable({ providedIn: 'root' })
export class FeedService {
  private readonly http = inject(HttpClient);

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
   * Adds a bottle under a client-generated id: sending the same id again returns the stored feed
   * instead of adding a second one.
   */
  createBottle(
    babyId: string,
    fields: BottleFields,
    id: string = crypto.randomUUID(),
  ): Observable<FeedResult> {
    return this.result(
      this.http.post<Feed>('/api/feeds', { id, babyId, kind: 'bottle', ...fields }),
    );
  }

  /** Replaces every field of the bottle. */
  updateBottle(id: string, fields: BottleFields): Observable<FeedResult> {
    return this.result(this.http.put<Feed>(`/api/feeds/${id}`, fields));
  }

  delete(id: string): Observable<FeedDeleteResult> {
    return this.http.delete<void>(`/api/feeds/${id}`).pipe(
      map((): FeedDeleteResult => ({ ok: true })),
      catchError((error: HttpErrorResponse) =>
        of<FeedDeleteResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }

  /** What the Bottle sheet pre-fills; none when they can't be loaded (the sheet still works without). */
  bottleDefaults(babyId: string): Observable<BottleDefaults> {
    return this.http
      .get<BottleDefaults>(`/api/babies/${babyId}/feeds/bottle-defaults`)
      .pipe(catchError(() => of(NO_BOTTLE_DEFAULTS)));
  }

  private result(request: Observable<Feed>): Observable<FeedResult> {
    return request.pipe(
      map((feed): FeedResult => ({ ok: true, feed })),
      catchError((error: HttpErrorResponse) =>
        of<FeedResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }
}
