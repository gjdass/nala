import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject, catchError, map, of, tap } from 'rxjs';
import { toFieldErrors } from '../http/field-errors';
import { Member, MembersResult, RemoveMemberResult } from './member.models';

/** The family's members; any member may list them, only the admin may remove one (the API refuses anyone else). */
@Injectable({ providedIn: 'root' })
export class MemberService {
  private readonly http = inject(HttpClient);
  private readonly changes = new Subject<void>();

  /**
   * Emits when a member was removed, disabled or enabled, so every list showing members (or their invitations, which
   * removing revokes) reloads.
   */
  readonly changed$ = this.changes.asObservable();

  /** Enabled members, the admin first, then by name. */
  list(): Observable<MembersResult> {
    return this.http.get<Member[]>('/api/members').pipe(
      map((members): MembersResult => ({ ok: true, members })),
      catchError((error: HttpErrorResponse) =>
        of<MembersResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }

  /** Disables the member: their sessions end and their pending invitations are revoked. Removing twice is fine. */
  remove(id: string): Observable<RemoveMemberResult> {
    return this.http.post<void>(`/api/members/${id}/remove`, null).pipe(
      map((): RemoveMemberResult => ({ ok: true })),
      tap(() => this.notifyChanged()),
      catchError((error: HttpErrorResponse) =>
        of<RemoveMemberResult>({ ok: false, errors: toFieldErrors(error) }),
      ),
    );
  }

  /** For changes made through another service (the admin's disable / enable). */
  notifyChanged(): void {
    this.changes.next();
  }
}
