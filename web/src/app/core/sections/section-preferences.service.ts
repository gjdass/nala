import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { toFieldErrors } from '../http/field-errors';
import { SectionPreference, SectionsSaveResult } from './section.models';

/** The signed-in user's order and visibility of the home sections, saved on the server (same on every device). */
@Injectable({ providedIn: 'root' })
export class SectionPreferencesService {
  private readonly http = inject(HttpClient);
  private readonly list = signal<SectionPreference[] | null>(null);

  /** Every section in the user's order; null until loaded. */
  readonly preferences = this.list.asReadonly();

  load(): void {
    this.http
      .get<SectionPreference[]>('/api/account/sections')
      .subscribe({ next: (sections) => this.list.set(sections), error: () => undefined });
  }

  /** Replaces the whole list; shown right away, and put back if the server refuses it. */
  save(sections: SectionPreference[]): Observable<SectionsSaveResult> {
    const previous = this.list();
    this.list.set(sections);
    return this.http.put<SectionPreference[]>('/api/account/sections', sections).pipe(
      map((saved): SectionsSaveResult => {
        this.list.set(saved);
        return { ok: true };
      }),
      catchError((error: HttpErrorResponse) => {
        this.list.set(previous);
        return of<SectionsSaveResult>({ ok: false, errors: toFieldErrors(error) });
      }),
    );
  }
}
