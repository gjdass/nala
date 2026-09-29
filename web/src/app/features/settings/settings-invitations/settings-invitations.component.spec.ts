import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { AuthState } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { formatDateTime } from '../../../core/i18n/date-time';
import {
  CreateInvitationResult,
  PendingInvitation,
  PendingInvitationsResult,
  RevokeInvitationResult,
} from '../../../core/invitations/invitation.models';
import { InvitationService } from '../../../core/invitations/invitation.service';
import { MemberService } from '../../../core/members/member.service';
import { ShareLinkDialogComponent } from '../../../shared/ui/share-link-dialog/share-link-dialog.component';
import { translocoTesting } from '../../../testing/transloco-testing';
import { InviteEmailDialogComponent } from '../invite-email-dialog/invite-email-dialog.component';
import { SettingsInvitationsComponent } from './settings-invitations.component';

describe('SettingsInvitationsComponent', () => {
  let fixture: ComponentFixture<SettingsInvitationsComponent>;
  let invitations: {
    create: ReturnType<typeof vi.fn>;
    pending: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
  };
  let created: Subject<CreateInvitationResult>;
  let revoked: Subject<RevokeInvitationResult>;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };
  let changed: Subject<void>;
  let auth: { state: ReturnType<typeof signal<AuthState | null>> };

  const fromBen: PendingInvitation = {
    id: 'i2',
    createdBy: 'Ben',
    createdAt: '2026-09-27T20:00:00Z',
    expiresAt: '2026-10-04T20:00:00Z',
  };
  const fromAnna: PendingInvitation = {
    id: 'i1',
    createdBy: 'Anna',
    createdAt: '2026-09-25T08:00:00Z',
    expiresAt: '2026-10-02T08:00:00Z',
  };

  const host = () => fixture.nativeElement as HTMLElement;
  const rows = () => [...host().querySelectorAll<HTMLElement>('nala-invitation-list-item')];
  const row = (name: string) => rows().find((r) => r.textContent?.includes(name))!;
  const byTestId = (id: string) => host().querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const click = async (element: HTMLElement) => {
    element.click();
    await fixture.whenStable();
  };
  const answer = async <T>(subject: Subject<T>, value: T) => {
    subject.next(value);
    await fixture.whenStable();
  };

  const render = async (
    result: PendingInvitationsResult = { ok: true, invitations: [fromBen, fromAnna] },
  ) => {
    invitations.pending.mockReturnValue(of(result));
    fixture = TestBed.createComponent(SettingsInvitationsComponent);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    created = new Subject<CreateInvitationResult>();
    revoked = new Subject<RevokeInvitationResult>();
    invitations = {
      create: vi.fn(() => created),
      pending: vi.fn(),
      revoke: vi.fn(() => revoked),
    };
    dialog = { open: vi.fn() };
    changed = new Subject<void>();
    snackBar = { open: vi.fn() };
    auth = {
      state: signal<AuthState | null>({
        setupRequired: false,
        smtpEnabled: false,
        user: {
          id: 'u1',
          email: 'anna@mail.com',
          displayName: 'Anna',
          language: 'en',
          isAdmin: true,
        },
      }),
    };
    await TestBed.configureTestingModule({
      imports: [SettingsInvitationsComponent, translocoTesting()],
      providers: [
        { provide: InvitationService, useValue: invitations },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: AuthService, useValue: auth },
        { provide: MemberService, useValue: { changed$: changed } },
      ],
    }).compileComponents();
  });

  it('lists the pending invitations in the order received, with creator and expiry', async () => {
    await render();

    expect(rows().map((r) => r.querySelector('[matListItemTitle]')?.textContent?.trim())).toEqual([
      en.invitations.invitedBy.replace('{{name}}', 'Ben'),
      en.invitations.invitedBy.replace('{{name}}', 'Anna'),
    ]);
    expect(row('Ben').textContent).toContain(
      en.invitations.expires.replace('{{date}}', formatDateTime(fromBen.expiresAt, 'en')),
    );
    expect(row('Ben').querySelector('[data-testid="revoke"]')?.textContent?.trim()).toBe(
      en.invitations.revoke,
    );
    expect(byTestId('no-invitations')).toBeNull();
  });

  it('says when there is no pending invitation', async () => {
    await render({ ok: true, invitations: [] });

    expect(rows()).toEqual([]);
    expect(byTestId('no-invitations')?.textContent?.trim()).toBe(en.invitations.none);
  });

  it('shows an error when the invitations cannot be loaded, and still offers Invite', async () => {
    await render({ ok: false, errors: { form: 'unknown' } });

    expect(byTestId('invitations-error')?.textContent?.trim()).toBe(en.invitations.loadError);
    expect(byTestId('invite')).not.toBeNull();
  });

  it('reloads the list when the members change (removing a member revokes their invitations)', async () => {
    await render();
    invitations.pending.mockReturnValue(of({ ok: true, invitations: [fromAnna] }));

    changed.next();
    await fixture.whenStable();

    expect(rows().length).toBe(1);
    expect(row('Anna')).toBeDefined();
  });

  describe('invite', () => {
    it('creates a link and hands it over in the share dialog, then reloads the list', async () => {
      await render();
      await click(byTestId('invite')!);
      expect(invitations.create).toHaveBeenCalled();

      invitations.pending.mockReturnValue(of({ ok: true, invitations: [fromBen] }));
      await answer(created, {
        ok: true,
        invitation: { token: 'tok', expiresAt: '2026-10-04T20:00:00Z' },
      });

      expect(dialog.open).toHaveBeenCalledWith(ShareLinkDialogComponent, {
        data: {
          title: en.invitations.shareTitle,
          text: en.invitations.shareText.replace(
            '{{date}}',
            formatDateTime('2026-10-04T20:00:00Z', 'en'),
          ),
          url: `${document.location.origin}/invite/tok`,
        },
      });
      expect(invitations.pending).toHaveBeenCalledTimes(2);
      expect(rows()).toHaveLength(1);
    });

    it('ignores taps while a link is being created', async () => {
      await render();
      await click(byTestId('invite')!);
      await click(byTestId('invite')!);

      expect(invitations.create).toHaveBeenCalledTimes(1);
    });

    it('tells when the link cannot be created', async () => {
      await render();
      await click(byTestId('invite')!);
      await answer(created, { ok: false, errors: { form: 'unknown' } });

      expect(dialog.open).not.toHaveBeenCalled();
      expect(snackBar.open).toHaveBeenCalledWith(en.auth.errors.form.unknown, undefined, {
        duration: 3000,
      });
    });
  });

  describe('invite by email', () => {
    const enableSmtp = () => auth.state.update((state) => ({ ...state!, smtpEnabled: true }));

    it('is not offered without SMTP', async () => {
      await render();

      expect(byTestId('invite-by-email')).toBeNull();
    });

    it('opens the email dialog when SMTP is configured', async () => {
      enableSmtp();
      dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      await render();

      await click(byTestId('invite-by-email')!);

      expect(dialog.open).toHaveBeenCalledWith(InviteEmailDialogComponent);
      expect(snackBar.open).not.toHaveBeenCalled();
      expect(invitations.pending).toHaveBeenCalledTimes(1);
    });

    it('confirms the sent email and reloads the list', async () => {
      enableSmtp();
      dialog.open.mockReturnValue({ afterClosed: () => of('ben@mail.com') });
      await render({ ok: true, invitations: [fromAnna] });
      invitations.pending.mockReturnValue(of({ ok: true, invitations: [fromBen, fromAnna] }));

      await click(byTestId('invite-by-email')!);

      expect(snackBar.open).toHaveBeenCalledWith(
        en.invitations.emailSent.replace('{{email}}', 'ben@mail.com'),
        undefined,
        { duration: 3000 },
      );
      expect(rows()).toHaveLength(2);
    });
  });

  describe('revoke', () => {
    it('revokes at once, removes the row and confirms with a snackbar', async () => {
      await render();
      await click(row('Ben').querySelector<HTMLElement>('[data-testid="revoke"]')!);
      expect(invitations.revoke).toHaveBeenCalledWith('i2');

      await answer(revoked, { ok: true });

      expect(rows().map((r) => r.textContent)).toEqual([expect.stringContaining('Anna')]);
      expect(snackBar.open).toHaveBeenCalledWith(en.invitations.revoked, undefined, {
        duration: 3000,
      });
    });

    it.each(['invitationUsed', 'invitationExpired', 'invitationUnknown'] as const)(
      'explains a %s refusal and reloads the list',
      async (code) => {
        await render();
        await click(row('Ben').querySelector<HTMLElement>('[data-testid="revoke"]')!);
        invitations.pending.mockReturnValue(of({ ok: true, invitations: [fromAnna] }));
        await answer(revoked, { ok: false, errors: { form: code } });

        expect(snackBar.open).toHaveBeenCalledWith(en.invitations.errors[code], undefined, {
          duration: 3000,
        });
        expect(invitations.pending).toHaveBeenCalledTimes(2);
        expect(rows()).toHaveLength(1);
      },
    );

    it('shows the generic error when offline', async () => {
      await render();
      await click(row('Ben').querySelector<HTMLElement>('[data-testid="revoke"]')!);
      await answer(revoked, { ok: false, errors: { form: 'unknown' } });

      expect(snackBar.open).toHaveBeenCalledWith(en.auth.errors.form.unknown, undefined, {
        duration: 3000,
      });
      expect(rows()).toHaveLength(2);
    });
  });
});
