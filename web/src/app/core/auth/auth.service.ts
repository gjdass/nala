import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { AuthState, FieldErrors, SetupRequest, SetupResult } from './auth.models';

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
}

/** A 400 validation problem (`{ errors: { field: [code] } }`) to one code per field; anything else is `form: unknown`. */
function toFieldErrors(error: HttpErrorResponse): FieldErrors {
  const problem = error.status === 400 ? (error.error?.errors as Record<string, string[]>) : null;
  if (!problem) {
    return { form: 'unknown' };
  }
  return Object.fromEntries(Object.entries(problem).map(([field, codes]) => [field, codes[0]]));
}
