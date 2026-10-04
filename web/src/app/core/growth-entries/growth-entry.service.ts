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
import {
  GrowthEntry,
  GrowthKind,
  GrowthLatest,
  MeasurementFields,
  MilestoneFields,
} from './growth-entry.models';

/**
 * A baby's growth entries (spec 10); any member can add, edit and delete any entry. Adding, editing
 * and deleting go through the offline queue: without a network they are kept on the device and sent
 * later.
 */
@Injectable({ providedIn: 'root' })
export class GrowthEntryService {
  private readonly http = inject(HttpClient);
  private readonly queue = inject(OfflineQueueService);

  /**
   * One page of the baby's entries, newest date first; errors when it can't be loaded (the history
   * offers Try again).
   */
  page(
    babyId: string,
    cursor: string | null,
    limit?: number,
  ): Observable<HistoryPage<GrowthEntry>> {
    let params = new HttpParams();
    if (cursor !== null) {
      params = params.set('cursor', cursor);
    }
    if (limit !== undefined) {
      params = params.set('limit', limit);
    }
    return this.http.get<HistoryPage<GrowthEntry>>(`/api/babies/${babyId}/growth-entries`, {
      params,
    });
  }

  /** The latest value of each measure, with the birth fallback; null when it can't be loaded. */
  latest(babyId: string): Observable<GrowthLatest | null> {
    return this.http
      .get<GrowthLatest>(`/api/babies/${babyId}/growth-entries/latest`)
      .pipe(catchError(() => of(null)));
  }

  /**
   * Adds an entry under a client-generated id: sending the same id again returns the stored entry
   * instead of adding a second one.
   */
  create(
    babyId: string,
    kind: GrowthKind,
    fields: MeasurementFields | MilestoneFields,
    id: string = crypto.randomUUID(),
  ): Observable<EntryResult<GrowthEntry>> {
    return this.queue
      .send<GrowthEntry>('POST', '/api/growth-entries', { id, babyId, kind, ...fields })
      .pipe(map(toEntryResult));
  }

  /** Replaces every field of the entry's kind; the kind never changes. */
  update(
    id: string,
    fields: MeasurementFields | MilestoneFields,
  ): Observable<EntryResult<GrowthEntry>> {
    return this.queue
      .send<GrowthEntry>('PUT', `/api/growth-entries/${id}`, fields)
      .pipe(map(toEntryResult));
  }

  delete(id: string): Observable<EntryDeleteResult> {
    return this.queue
      .send<void>('DELETE', `/api/growth-entries/${id}`, null)
      .pipe(map(toDeleteResult));
  }
}
