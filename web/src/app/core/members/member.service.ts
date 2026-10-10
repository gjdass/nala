import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject, catchError, map, of, tap } from 'rxjs';
import { toFieldErrors } from '../http/field-errors';
import { Member, MembersResult, RemoveMemberResult } from './member.models';

const membersOf = (familyId: string) => `/api/families/${familyId}/members`;

/**
 * A family's members; any of them may list them, only the family admin may remove one (the API
 * refuses anyone else).
 */
@Injectable({ providedIn: 'root' })
export class MemberService {
  private readonly http = inject(HttpClient);
  private readonly changes = new Subject<void>();

  /**
   * Emits when a member was removed, so every list showing members (or their invitations, which
   * removing revokes) reloads.
   */
  readonly changed$ = this.changes.asObservable();

  /** The family admin first, then by name. */
  list(familyId: string): Observable<MembersResult> {
    return this.http.get<Member[]>(membersOf(familyId)).pipe(
      map((members): MembersResult => ({ ok: true, members })),
      catchError((error: HttpErrorResponse) =>
        of<MembersResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }

  /**
   * Ends their membership of the family and revokes their pending invitations to it; their account
   * and other families are kept. Refused with `familyAdminOnly`, `userNotFound` or `adminCannotRemove`.
   */
  remove(familyId: string, userId: string): Observable<RemoveMemberResult> {
    return this.http.post<void>(`${membersOf(familyId)}/${userId}/remove`, null).pipe(
      map((): RemoveMemberResult => ({ ok: true })),
      tap(() => this.changes.next()),
      catchError((error: HttpErrorResponse) =>
        of<RemoveMemberResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }
}
