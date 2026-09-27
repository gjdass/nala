import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import {
  AccountResult,
  ChangePasswordRequest,
  CurrentUser,
  UpdateAccountRequest,
} from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { toFieldErrors } from '../http/field-errors';

/** The signed-in user's own account. */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /** Saves the given fields; the returned user replaces the signed-in one. */
  update(request: UpdateAccountRequest): Observable<AccountResult> {
    return this.http.patch<CurrentUser>('/api/account', request).pipe(
      tap((user) => this.auth.state.update((state) => ({ setupRequired: false, ...state, user }))),
      map((): AccountResult => ({ ok: true })),
      catchError(failed),
    );
  }

  /** This device stays signed in; the API ends the user's other sessions. */
  changePassword(request: ChangePasswordRequest): Observable<AccountResult> {
    return this.http.post<void>('/api/account/password', request).pipe(
      map((): AccountResult => ({ ok: true })),
      catchError(failed),
    );
  }
}

const failed = (error: HttpErrorResponse) =>
  of<AccountResult>({ ok: false, errors: toFieldErrors(error) });
