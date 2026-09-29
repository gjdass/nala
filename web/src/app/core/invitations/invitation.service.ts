import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { toFieldErrors } from '../http/field-errors';
import {
  CreateInvitationResult,
  CreatedInvitation,
  PendingInvitation,
  PendingInvitationsResult,
  RevokeInvitationResult,
  SendInvitationResult,
} from './invitation.models';

/** Invitation links; any member may create, list and revoke them. */
@Injectable({ providedIn: 'root' })
export class InvitationService {
  private readonly http = inject(HttpClient);

  /** A single-use link, valid 7 days. */
  create(): Observable<CreateInvitationResult> {
    return this.http.post<CreatedInvitation>('/api/invitations', null).pipe(
      map((invitation): CreateInvitationResult => ({ ok: true, invitation })),
      catchError((error: HttpErrorResponse) =>
        of<CreateInvitationResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }

  /** Unused, unexpired, unrevoked invitations, newest first. */
  pending(): Observable<PendingInvitationsResult> {
    return this.http.get<PendingInvitation[]>('/api/invitations').pipe(
      map((invitations): PendingInvitationsResult => ({ ok: true, invitations })),
      catchError((error: HttpErrorResponse) =>
        of<PendingInvitationsResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }

  /** Refused with `invitationUsed`, `invitationExpired` or `invitationUnknown`; revoking twice is fine. */
  revoke(id: string): Observable<RevokeInvitationResult> {
    return this.http.post<void>(`/api/invitations/${id}/revoke`, null).pipe(
      map((): RevokeInvitationResult => ({ ok: true })),
      catchError((error: HttpErrorResponse) =>
        of<RevokeInvitationResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }

  /** Emails a new invitation link (SMTP only). Refused with `email` errors or `emailInviteDisabled`. */
  sendByEmail(email: string): Observable<SendInvitationResult> {
    return this.http.post<{ expiresAt: string }>('/api/invitations/email', { email }).pipe(
      map(({ expiresAt }): SendInvitationResult => ({ ok: true, expiresAt })),
      catchError((error: HttpErrorResponse) =>
        of<SendInvitationResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }
}
