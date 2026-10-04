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
import { Medication, MedicationFields } from './medication.models';

/**
 * A baby's medication doses (spec 09); any member can add, edit and delete any dose. Adding, editing and
 * deleting go through the offline queue: without a network they are kept on the device and sent later.
 */
@Injectable({ providedIn: 'root' })
export class MedicationService {
  private readonly http = inject(HttpClient);
  private readonly queue = inject(OfflineQueueService);

  /** One page of the baby's doses, newest first; errors when it can't be loaded (the history offers Try again). */
  page(babyId: string, cursor: string | null, limit?: number): Observable<HistoryPage<Medication>> {
    let params = new HttpParams();
    if (cursor !== null) {
      params = params.set('cursor', cursor);
    }
    if (limit !== undefined) {
      params = params.set('limit', limit);
    }
    return this.http.get<HistoryPage<Medication>>(`/api/babies/${babyId}/medications`, { params });
  }

  /**
   * Adds a dose under a client-generated id: sending the same id again returns the stored dose
   * instead of adding a second one.
   */
  create(
    babyId: string,
    fields: MedicationFields,
    id: string = crypto.randomUUID(),
  ): Observable<EntryResult<Medication>> {
    return this.queue
      .send<Medication>('POST', '/api/medications', { id, babyId, ...fields })
      .pipe(map(toEntryResult));
  }

  /** Replaces every field. */
  update(id: string, fields: MedicationFields): Observable<EntryResult<Medication>> {
    return this.queue
      .send<Medication>('PUT', `/api/medications/${id}`, fields)
      .pipe(map(toEntryResult));
  }

  delete(id: string): Observable<EntryDeleteResult> {
    return this.queue
      .send<void>('DELETE', `/api/medications/${id}`, null)
      .pipe(map(toDeleteResult));
  }
}
