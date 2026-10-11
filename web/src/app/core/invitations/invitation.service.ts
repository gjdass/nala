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

/** `null`: the new-family invitations, the instance admin's. */
const invitationsOf = (familyId: string | null) =>
  familyId === null ? '/api/admin/invitations' : `/api/families/${familyId}/invitations`;

/**
 * Join invitations to a family, which any of its members may create, list and revoke; with a `null` family, the
 * new-family invitations, which only the instance admin may (`adminOnly` otherwise).
 */
@Injectable({ providedIn: 'root' })
export class InvitationService {
  private readonly http = inject(HttpClient);

  /** A single-use link, valid 7 days. */
  create(familyId: string | null): Observable<CreateInvitationResult> {
    return this.http.post<CreatedInvitation>(invitationsOf(familyId), null).pipe(
      map((invitation): CreateInvitationResult => ({ ok: true, invitation })),
      catchError((error: HttpErrorResponse) =>
        of<CreateInvitationResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }

  /** Unused, unexpired, unrevoked invitations, newest first. */
  pending(familyId: string | null): Observable<PendingInvitationsResult> {
    return this.http.get<PendingInvitation[]>(invitationsOf(familyId)).pipe(
      map((invitations): PendingInvitationsResult => ({ ok: true, invitations })),
      catchError((error: HttpErrorResponse) =>
        of<PendingInvitationsResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }

  /** Refused with `invitationUsed`, `invitationExpired` or `invitationUnknown`; revoking twice is fine. */
  revoke(familyId: string | null, id: string): Observable<RevokeInvitationResult> {
    return this.http.post<void>(`${invitationsOf(familyId)}/${id}/revoke`, null).pipe(
      map((): RevokeInvitationResult => ({ ok: true })),
      catchError((error: HttpErrorResponse) =>
        of<RevokeInvitationResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }

  /** Emails a new invitation link (SMTP only). Refused with `email` errors or `emailInviteDisabled`. */
  sendByEmail(familyId: string | null, email: string): Observable<SendInvitationResult> {
    const url = `${invitationsOf(familyId)}/email`;
    return this.http.post<{ expiresAt: string }>(url, { email }).pipe(
      map(({ expiresAt }): SendInvitationResult => ({ ok: true, expiresAt })),
      catchError((error: HttpErrorResponse) =>
        of<SendInvitationResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }
}
