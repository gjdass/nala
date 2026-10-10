import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { toFieldErrors } from '../http/field-errors';
import { FamiliesResult, Family } from './family.models';

/** The signed-in user's families, with their role in each. */
@Injectable({ providedIn: 'root' })
export class FamilyService {
  private readonly http = inject(HttpClient);

  /** By name, then by creation. */
  list(): Observable<FamiliesResult> {
    return this.http.get<Family[]>('/api/families').pipe(
      map((families): FamiliesResult => ({ ok: true, families })),
      catchError((error: HttpErrorResponse) =>
        of<FamiliesResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }
}
