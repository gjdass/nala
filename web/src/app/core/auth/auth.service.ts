import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import {
  AcceptInvitationResult,
  AuthState,
  ForgotPasswordRequest,
  ForgotPasswordResult,
  Invitation,
  InvitationLookup,
  LoginRequest,
  LoginResult,
  RegisterRequest,
  RegisterResult,
  ResetLink,
  ResetLinkLookup,
  ResetPasswordRequest,
  ResetPasswordResult,
  SetupRequest,
  SetupResult,
} from './auth.models';
import { toFieldErrors } from '../http/field-errors';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  /** Last known auth state; null until first loaded. */
  readonly state = signal<AuthState | null>(null);

  /** The request in flight, shared by concurrent callers (e.g. several guards on one route). */
  private loading: Observable<AuthState> | null = null;

  load(): Observable<AuthState> {
    const known = this.state();
    if (known) {
      return of(known);
    }
    this.loading ??= this.http.get<AuthState>('/api/auth/state').pipe(
      tap((state) => this.state.set(state)),
      finalize(() => (this.loading = null)),
      shareReplay(1),
    );
    return this.loading;
  }

  setup(request: SetupRequest): Observable<SetupResult> {
    return this.http.post<AuthState>('/api/auth/setup', request).pipe(
      tap((state) => this.state.set(state)),
      map((): SetupResult => ({ ok: true })),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 403) {
          this.signedOut();
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

  lookupInvitation(token: string): Observable<InvitationLookup> {
    return this.http.get<Invitation>(invitationUrl(token)).pipe(
      map((invitation): InvitationLookup => ({ ok: true, invitation })),
      catchError((error: HttpErrorResponse) =>
        of<InvitationLookup>({ ok: false, code: toFieldErrors(error)['form'] ?? 'unknown' }),
      ),
    );
  }

  /** Creates an account from an invitation and signs it in. */
  register(token: string, request: RegisterRequest): Observable<RegisterResult> {
    return this.http.post<AuthState>(`${invitationUrl(token)}/register`, request).pipe(
      tap((state) => this.state.set(state)),
      map((): RegisterResult => ({ ok: true })),
      catchError((error: HttpErrorResponse) =>
        of<RegisterResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }

  /** Accepts an invitation with the signed-in account; `alreadyMember` leaves it unused. */
  acceptInvitation(token: string): Observable<AcceptInvitationResult> {
    return this.http.post<{ familyId: string }>(`${invitationUrl(token)}/accept`, {}).pipe(
      map(({ familyId }): AcceptInvitationResult => ({ ok: true, familyId })),
      catchError((error: HttpErrorResponse) =>
        of<AcceptInvitationResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }

  /** "Forgot password": ok whether or not the email has an account; the API emails the link in the background. */
  requestPasswordReset(request: ForgotPasswordRequest): Observable<ForgotPasswordResult> {
    return this.http.post<void>('/api/auth/password-resets', request).pipe(
      map((): ForgotPasswordResult => ({ ok: true })),
      catchError((error: HttpErrorResponse) =>
        of<ForgotPasswordResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }

  lookupResetLink(token: string): Observable<ResetLinkLookup> {
    return this.http.get<ResetLink>(resetUrl(token)).pipe(
      map((link): ResetLinkLookup => ({ ok: true, link })),
      catchError((error: HttpErrorResponse) =>
        of<ResetLinkLookup>({ ok: false, code: toFieldErrors(error)['form'] ?? 'unknown' }),
      ),
    );
  }

  /** Sets a new password from a reset link; the user's other sessions end and this device is signed in. */
  resetPassword(token: string, request: ResetPasswordRequest): Observable<ResetPasswordResult> {
    return this.http.post<AuthState>(resetUrl(token), request).pipe(
      tap((state) => this.state.set(state)),
      map((): ResetPasswordResult => ({ ok: true })),
      catchError((error: HttpErrorResponse) =>
        of<ResetPasswordResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }

  /** Ends this device's session only. */
  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', null).pipe(tap(() => this.signedOut()));
  }

  /** The session is gone (logout or expiry); the instance itself stays set up and keeps its email setting. */
  signedOut(): void {
    this.state.set({
      setupRequired: false,
      user: null,
      smtpEnabled: this.state()?.smtpEnabled ?? false,
    });
  }
}

const invitationUrl = (token: string) => `/api/auth/invitations/${encodeURIComponent(token)}`;
const resetUrl = (token: string) => `/api/auth/password-resets/${encodeURIComponent(token)}`;
