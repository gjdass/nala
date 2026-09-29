import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { AuthState } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { Member, MembersResult, RemoveMemberResult } from '../../../core/members/member.models';
import { MemberService } from '../../../core/members/member.service';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { translocoTesting } from '../../../testing/transloco-testing';
import { SettingsMembersComponent } from './settings-members.component';

describe('SettingsMembersComponent', () => {
  let fixture: ComponentFixture<SettingsMembersComponent>;
  let members: {
    list: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    changed$: Subject<void>;
  };
  let removed: Subject<RemoveMemberResult>;
  let dialogClosed: Subject<boolean | undefined>;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };
  let auth: { state: ReturnType<typeof signal<AuthState | null>> };

  const anna: Member = { id: 'u1', displayName: 'Anna', email: 'anna@mail.com', isAdmin: true };
  const ben: Member = { id: 'u2', displayName: 'Ben', email: 'ben@mail.com', isAdmin: false };
  const chloe: Member = { id: 'u3', displayName: 'Chloe', email: 'chloe@mail.com', isAdmin: false };

  const host = () => fixture.nativeElement as HTMLElement;
  const rows = () => [...host().querySelectorAll<HTMLElement>('nala-member-list-item')];
  const row = (name: string) => rows().find((r) => r.textContent?.includes(name))!;
  const removeButton = (name: string) =>
    row(name).querySelector<HTMLButtonElement>('[data-testid="remove"]');
  const settle = () => fixture.whenStable();

  const signIn = (isAdmin: boolean) =>
    auth.state.set({
      setupRequired: false,
      smtpEnabled: false,
      user: {
        id: isAdmin ? 'u1' : 'u2',
        email: isAdmin ? 'anna@mail.com' : 'ben@mail.com',
        displayName: isAdmin ? 'Anna' : 'Ben',
        language: 'en',
        isAdmin,
      },
    });

  const render = async (result: MembersResult = { ok: true, members: [anna, ben, chloe] }) => {
    members.list.mockReturnValue(of(result));
    fixture = TestBed.createComponent(SettingsMembersComponent);
    await settle();
  };

  /** Taps Remove on Ben's row and confirms. */
  const confirmRemoveBen = async () => {
    removeButton('Ben')!.click();
    await settle();
    dialogClosed.next(true);
    await settle();
  };

  beforeEach(async () => {
    removed = new Subject<RemoveMemberResult>();
    members = { list: vi.fn(), remove: vi.fn(() => removed), changed$: new Subject<void>() };
    dialogClosed = new Subject<boolean | undefined>();
    dialog = { open: vi.fn(() => ({ afterClosed: () => dialogClosed })) };
    snackBar = { open: vi.fn() };
    auth = { state: signal<AuthState | null>(null) };
    signIn(true);
    await TestBed.configureTestingModule({
      imports: [SettingsMembersComponent, translocoTesting()],
      providers: [
        { provide: MemberService, useValue: members },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();
  });

  it('lists the members under a Members heading, with name, email and admin badge', async () => {
    await render();

    expect(host().querySelector('h3')?.textContent?.trim()).toBe(en.members.title);
    expect(rows().map((r) => r.querySelector('[matListItemTitle]')?.textContent?.trim())).toEqual([
      expect.stringContaining('Anna'),
      expect.stringContaining('Ben'),
      expect.stringContaining('Chloe'),
    ]);
    expect(row('Ben').textContent).toContain('ben@mail.com');
    expect(row('Anna').querySelector('[data-testid="admin-badge"]')).not.toBeNull();
    expect(row('Ben').querySelector('[data-testid="admin-badge"]')).toBeNull();
  });

  it('shows no Remove action to a non-admin member', async () => {
    signIn(false);
    await render();

    expect(host().querySelector('[data-testid="remove"]')).toBeNull();
  });

  it('shows Remove to the admin on every row but their own', async () => {
    await render();

    expect(removeButton('Anna')).toBeNull();
    expect(removeButton('Ben')?.textContent?.trim()).toBe(en.members.remove);
    expect(removeButton('Chloe')).not.toBeNull();
  });

  it('shows an error when the members cannot be loaded', async () => {
    await render({ ok: false, errors: { form: 'unknown' } });

    expect(rows()).toEqual([]);
    expect(host().querySelector('[data-testid="members-error"]')?.textContent?.trim()).toBe(
      en.members.loadError,
    );
  });

  it('reloads when the members change elsewhere', async () => {
    await render();
    members.list.mockReturnValue(of({ ok: true, members: [anna, chloe] }));

    members.changed$.next();
    await settle();

    expect(rows().length).toBe(2);
    expect(rows().some((r) => r.textContent?.includes('Ben'))).toBe(false);
  });

  describe('remove', () => {
    it('asks for confirmation first, naming the member', async () => {
      await render();
      removeButton('Ben')!.click();
      await settle();

      expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, {
        data: {
          title: en.members.removeTitle.replace('{{name}}', 'Ben'),
          text: en.members.removeText.replace(/{{name}}/g, 'Ben'),
          confirm: en.members.confirm,
          cancel: en.members.cancel,
        },
      });
      expect(members.remove).not.toHaveBeenCalled();
    });

    it('does nothing when cancelled', async () => {
      await render();
      removeButton('Ben')!.click();
      await settle();
      dialogClosed.next(false);
      await settle();

      expect(members.remove).not.toHaveBeenCalled();
    });

    it('removes once confirmed, drops the row and confirms with a snackbar', async () => {
      await render();
      await confirmRemoveBen();

      expect(members.remove).toHaveBeenCalledWith('u2');
      removed.next({ ok: true });
      await settle();

      expect(rows().some((r) => r.textContent?.includes('Ben'))).toBe(false);
      expect(snackBar.open).toHaveBeenCalledWith(
        en.members.removed.replace('{{name}}', 'Ben'),
        undefined,
        { duration: 3000 },
      );
    });

    it('shows a refusal in a snackbar and keeps the row', async () => {
      await render();
      await confirmRemoveBen();
      removed.next({ ok: false, errors: { form: 'adminOnly' } });
      await settle();

      expect(row('Ben')).toBeDefined();
      expect(snackBar.open).toHaveBeenCalledWith(en.auth.errors.form.adminOnly, undefined, {
        duration: 3000,
      });
    });
  });
});
