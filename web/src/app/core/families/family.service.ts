import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { toFieldErrors } from '../http/field-errors';
import { FamiliesResult, Family, FamilyResult } from './family.models';

/** The signed-in user's families, with their role in each; the family admin renames one. */
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

  /** `name` errors under the field; `familyNotFound` / `familyAdminOnly` as form codes. */
  rename(id: string, name: string): Observable<FamilyResult> {
    return this.http.patch<Family>(`/api/families/${id}`, { name }).pipe(
      map((family): FamilyResult => ({ ok: true, family })),
      catchError((error: HttpErrorResponse) =>
        of<FamilyResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }
}
