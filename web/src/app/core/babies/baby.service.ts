import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { toFieldErrors } from '../http/field-errors';
import { BabiesResult, Baby, BabyFields, BabyResult } from './baby.models';

/** The family's babies; every member can list and add them. */
@Injectable({ providedIn: 'root' })
export class BabyService {
  private readonly http = inject(HttpClient);

  /** Oldest first. */
  list(): Observable<BabiesResult> {
    return this.http.get<Baby[]>('/api/babies').pipe(
      map((babies): BabiesResult => ({ ok: true, babies })),
      catchError((error: HttpErrorResponse) =>
        of<BabiesResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }

  create(fields: BabyFields): Observable<BabyResult> {
    return this.http.post<Baby>('/api/babies', fields).pipe(
      map((baby): BabyResult => ({ ok: true, baby })),
      catchError((error: HttpErrorResponse) =>
        of<BabyResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }
}
