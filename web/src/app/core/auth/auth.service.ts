import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import {
  AuthState,
  FieldErrors,
  LoginRequest,
  LoginResult,
  SetupRequest,
  SetupResult,
} from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  /** Last known auth state; null until first loaded. */
  readonly state = signal<AuthState | null>(null);

  load(): Observable<AuthState> {
    const known = this.state();
    if (known) {
      return of(known);
    }
    return this.http.get<AuthState>('/api/auth/state').pipe(tap((state) => this.state.set(state)));
  }

  setup(request: SetupRequest): Observable<SetupResult> {
    return this.http.post<AuthState>('/api/auth/setup', request).pipe(
      tap((state) => this.state.set(state)),
      map((): SetupResult => ({ ok: true })),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 403) {
          this.state.set({ setupRequired: false, user: null });
          return of<SetupResult>({ ok: false, errors: { form: 'alreadySetUp' } });
        }
        return of<SetupResult>({ ok: false, errors: toFieldErrors(error) });
      }),
    );
  }

  login(request: LoginRequest): Observable<LoginResult> {
    return this.http.post<AuthState>('/api/auth/login', request).pipe(
      tap((state) => this.state.set(state)),
      map((): LoginResult => ({ ok: true })),
      catchError((error: HttpErrorResponse) =>
        of<LoginResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }

  /** Ends this device's session only. */
  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', null).pipe(tap(() => this.signedOut()));
  }

  /** The session is gone (logout or expiry); the instance itself stays set up. */
  signedOut(): void {
    this.state.set({ setupRequired: false, user: null });
  }
}

/** Form-level codes the API answers with, by status. */
const FORM_ERRORS: Partial<Record<number, string>> = {
  401: 'invalidCredentials',
  429: 'tooManyAttempts',
};

/**
 * A 400 validation problem (`{ errors: { field: [code] } }`) to one code per field; a known status
 * to its form code; anything else is `form: unknown`.
 */
function toFieldErrors(error: HttpErrorResponse): FieldErrors {
  const problem = error.status === 400 ? (error.error?.errors as Record<string, string[]>) : null;
  if (!problem) {
    return { form: FORM_ERRORS[error.status] ?? 'unknown' };
  }
  return Object.fromEntries(Object.entries(problem).map(([field, codes]) => [field, codes[0]]));
}
