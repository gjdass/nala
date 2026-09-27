import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { toFieldErrors } from '../http/field-errors';
import { AdminUser, AdminUserResult, AdminUsersResult } from './admin.models';

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

  /** Disabling also ends every session of the user. */
  setDisabled(id: string, disabled: boolean): Observable<AdminUserResult> {
    const action = disabled ? 'disable' : 'enable';
    return this.http.post<AdminUser>(`/api/admin/users/${id}/${action}`, null).pipe(
      map((user): AdminUserResult => ({ ok: true, user })),
      catchError((error: HttpErrorResponse) =>
        of<AdminUserResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }
}
