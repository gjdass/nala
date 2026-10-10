import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { toFieldErrors } from '../http/field-errors';
import { AdminUser, AdminUsersResult, ResetLinkResult, ResetLinkToken } from './admin.models';

/** The admin's management of the instance's users; the API refuses anyone else. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  /** Every non-deleted user, the admin first, then by name. */
  users(): Observable<AdminUsersResult> {
    return this.http.get<AdminUser[]>('/api/admin/users').pipe(
      map((users): AdminUsersResult => ({ ok: true, users })),
      catchError((error: HttpErrorResponse) =>
        of<AdminUsersResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }

  /** A one-time link, valid 24 hours, that lets the user set a new password; replaces their earlier links. */
  createResetLink(id: string): Observable<ResetLinkResult> {
    return this.http.post<ResetLinkToken>(`/api/admin/users/${id}/reset-link`, null).pipe(
      map((link): ResetLinkResult => ({ ok: true, link })),
      catchError((error: HttpErrorResponse) =>
        of<ResetLinkResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }
}
