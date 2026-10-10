import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import fr from '../../../../public/i18n/fr.json';
import { AccountService } from '../../core/account/account.service';
import { AdminService } from '../../core/admin/admin.service';
import { BabyService } from '../../core/babies/baby.service';
import { FamiliesResult } from '../../core/families/family.models';
import { FamilyService } from '../../core/families/family.service';
import { InvitationService } from '../../core/invitations/invitation.service';
import { MemberService } from '../../core/members/member.service';
import { AccountResult, AuthState } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeMode, ThemeService } from '../../core/theme/theme.service';
import { SECTIONS, SectionDefinition } from '../../core/sections/section.models';
import { SectionPreferencesService } from '../../core/sections/section-preferences.service';
import { fakeSection } from '../../testing/fake-section';
import { translocoTesting } from '../../testing/transloco-testing';
import { DeleteAccountDialogComponent } from './delete-account-dialog/delete-account-dialog.component';
import { SettingsPage } from './settings.page';

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let updated: Subject<AccountResult>;
  let passwordChanged: Subject<AccountResult>;
  let account: { update: ReturnType<typeof vi.fn>; changePassword: ReturnType<typeof vi.fn> };
  let auth: {
    state: ReturnType<typeof signal<AuthState | null>>;
    logout: ReturnType<typeof vi.fn>;
  };
  let theme: { mode: ReturnType<typeof signal<ThemeMode>>; setMode: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };
  let dialogClosed: Subject<boolean | undefined>;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let router: Router;
  let families: FamiliesResult;
  /** The built sections; empty until a feature registers one. */
  const registered: SectionDefinition[] = [];

  const host = () => fixture.nativeElement as HTMLElement;
  const input = (field: string) =>
    host().querySelector<HTMLInputElement>(`input[data-testid="${field}"]`)!;
  const button = (testId: string) =>
    host().querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!;
  const toggle = (testId: string) =>
    host().querySelector<HTMLButtonElement>(`mat-button-toggle[data-testid="${testId}"] button`)!;
  const checked = (prefix: string) =>
    host()
      .querySelector(`mat-button-toggle.mat-button-toggle-checked[data-testid^="${prefix}"]`)
      ?.getAttribute('data-testid');
  const error = (field: string) =>
    host().querySelector(`[data-testid="error-${field}"]`)?.textContent?.trim();

  const type = (field: string, value: string) => {
    input(field).value = value;
    input(field).dispatchEvent(new Event('input'));
    input(field).dispatchEvent(new Event('blur'));
  };
  const click = async (element: HTMLElement) => {
    element.click();
    await fixture.whenStable();
  };
  const answer = async (subject: Subject<AccountResult>, value: AccountResult) => {
    subject.next(value);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    registered.length = 0;
    updated = new Subject<AccountResult>();
    passwordChanged = new Subject<AccountResult>();
    account = { update: vi.fn(() => updated), changePassword: vi.fn(() => passwordChanged) };
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
      logout: vi.fn(() => of(undefined)),
    };
    theme = { mode: signal<ThemeMode>('system'), setMode: vi.fn() };
    snackBar = { open: vi.fn() };
    dialogClosed = new Subject<boolean | undefined>();
    dialog = { open: vi.fn(() => ({ afterClosed: () => dialogClosed })) };
    families = { ok: true, families: [{ id: 'f1', name: 'Martins', isAdmin: true }] };
    await TestBed.configureTestingModule({
      imports: [SettingsPage, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: AccountService, useValue: account },
        { provide: AuthService, useValue: auth },
        { provide: ThemeService, useValue: theme },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: MatDialog, useValue: dialog },
        { provide: SECTIONS, useValue: registered },
        {
          provide: SectionPreferencesService,
          useValue: { preferences: signal(null), load: vi.fn(), save: vi.fn() },
        },
        { provide: AdminService, useValue: { users: vi.fn(() => of({ ok: true, users: [] })) } },
        { provide: BabyService, useValue: { list: vi.fn(() => of({ ok: true, babies: [] })) } },
        { provide: FamilyService, useValue: { list: vi.fn(() => of(families)) } },
        {
          provide: InvitationService,
          useValue: { pending: vi.fn(() => of({ ok: true, invitations: [] })) },
        },
        {
          provide: MemberService,
          useValue: {
            list: vi.fn(() => of({ ok: true, members: [] })),
            changed$: new Subject<void>(),
          },
        },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
  });

  const sectionTitles = () =>
    [...host().querySelectorAll('mat-card-title')].map((t) => t.textContent?.trim());

  it('shows the Family, Babies, Members & invitations, Account, Admin and Appearance sections to the admin', () => {
    expect(sectionTitles()).toEqual([
      en.settings.family.title,
      en.settings.babies.title,
      en.settings.members.title,
      en.settings.account.title,
      en.settings.admin.title,
      en.settings.appearance.title,
    ]);
    expect(host().querySelector('nala-admin-users')).not.toBeNull();
  });

  it('hides the Admin section from a member', async () => {
    auth.state.update((state) => ({ ...state!, user: { ...state!.user!, isAdmin: false } }));
    await fixture.whenStable();

    expect(sectionTitles()).toEqual([
      en.settings.family.title,
      en.settings.babies.title,
      en.settings.members.title,
      en.settings.account.title,
      en.settings.appearance.title,
    ]);
    expect(host().querySelector('nala-admin-users')).toBeNull();
    expect(host().querySelector('nala-settings-family')).not.toBeNull();
    expect(host().querySelector('nala-settings-babies')).not.toBeNull();
    expect(host().querySelector('nala-settings-invitations')).not.toBeNull();
  });

  it('loads the families: the family sections and the baby sheet need them, and settings can be opened first', () => {
    expect(TestBed.inject(FamilyService).list).toHaveBeenCalledOnce();
  });

  it('hides Family, Babies and Members & invitations from a user in no family', async () => {
    families = { ok: true, families: [] };
    fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();

    expect(sectionTitles()).toEqual([
      en.settings.account.title,
      en.settings.admin.title,
      en.settings.appearance.title,
    ]);
    expect(host().querySelector('nala-settings-family')).toBeNull();
    expect(host().querySelector('nala-settings-babies')).toBeNull();
    expect(host().querySelector('nala-settings-members')).toBeNull();
    expect(host().querySelector('nala-settings-invitations')).toBeNull();
  });

  it('hides the Home sections section while no section is built', () => {
    expect(host().querySelector('nala-settings-sections')).toBeNull();
    expect(sectionTitles()).not.toContain(en.settings.sections.title);
  });

  it('shows the Home sections section after Members & invitations once a section is built', async () => {
    registered.push(fakeSection('feed', 'restaurant'));
    fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();

    expect(sectionTitles().slice(0, 4)).toEqual([
      en.settings.family.title,
      en.settings.babies.title,
      en.settings.members.title,
      en.settings.sections.title,
    ]);
    expect(host().querySelector('nala-settings-sections')).not.toBeNull();
  });

  it('shows the members before the invitations in the Members & invitations section', () => {
    const section = [...host().querySelectorAll('nala-settings-section')][2];
    const parts = [...section.querySelectorAll('nala-settings-members, nala-settings-invitations')];

    expect(parts.map((p) => p.tagName.toLowerCase())).toEqual([
      'nala-settings-members',
      'nala-settings-invitations',
    ]);
  });

  it('has no back link: settings is a bottom navigation destination', () => {
    expect(host().querySelector('[data-testid="back"]')).toBeNull();
  });

  describe('display name', () => {
    it('starts with the current display name', () => {
      expect(input('displayName').value).toBe('Anna');
    });

    it('saves the trimmed name and confirms with a snackbar', async () => {
      type('displayName', '  Anna B. ');
      await click(button('save-profile'));

      expect(account.update).toHaveBeenCalledWith({ displayName: 'Anna B.' });
      await answer(updated, { ok: true });
      expect(snackBar.open).toHaveBeenCalledWith(en.settings.saved, undefined, { duration: 3000 });
    });

    it('shows a field error for an empty or too long name and sends nothing', async () => {
      type('displayName', ' ');
      await click(button('save-profile'));
      expect(error('displayName')).toBe(en.auth.errors.displayName.required);

      type('displayName', 'a'.repeat(51));
      await fixture.whenStable();
      expect(error('displayName')).toBe(en.auth.errors.displayName.tooLong);
      expect(account.update).not.toHaveBeenCalled();
    });

    it('shows a server field error under the field', async () => {
      type('displayName', 'Anna B.');
      await click(button('save-profile'));
      await answer(updated, { ok: false, errors: { displayName: 'tooLong' } });

      expect(error('displayName')).toBe(en.auth.errors.displayName.tooLong);
    });
  });

  describe('language', () => {
    it("selects the user's language", () => {
      expect(checked('lang-')).toBe('lang-en');
    });

    it('saves the chosen language', async () => {
      await click(toggle('lang-fr'));

      expect(account.update).toHaveBeenCalledWith({ language: 'fr' });
    });

    it('confirms in the newly chosen language', async () => {
      await click(toggle('lang-fr'));
      await answer(updated, { ok: true });
      await vi.waitFor(() => expect(snackBar.open).toHaveBeenCalled());

      expect(snackBar.open).toHaveBeenCalledWith(fr.settings.saved, undefined, { duration: 3000 });
    });

    it('goes back to the saved language and says so when saving fails', async () => {
      await click(toggle('lang-fr'));
      await answer(updated, { ok: false, errors: { form: 'unknown' } });

      expect(checked('lang-')).toBe('lang-en');
      expect(snackBar.open).toHaveBeenCalledWith(en.auth.errors.form.unknown, undefined, {
        duration: 3000,
      });
    });
  });

  describe('password', () => {
    const fill = (current: string, next: string) => {
      type('currentPassword', current);
      type('newPassword', next);
    };

    it('uses password fields with the right autocomplete hints', () => {
      expect(input('currentPassword').type).toBe('password');
      expect(input('currentPassword').autocomplete).toBe('current-password');
      expect(input('newPassword').type).toBe('password');
      expect(input('newPassword').autocomplete).toBe('new-password');
    });

    it('changes the password, clears the form and confirms', async () => {
      fill('correct horse', 'battery staple');
      await click(button('change-password'));

      expect(account.changePassword).toHaveBeenCalledWith({
        currentPassword: 'correct horse',
        newPassword: 'battery staple',
      });
      await answer(passwordChanged, { ok: true });
      expect(input('currentPassword').value).toBe('');
      expect(input('newPassword').value).toBe('');
      expect(error('currentPassword')).toBeUndefined();
      expect(snackBar.open).toHaveBeenCalledWith(en.settings.password.changed, undefined, {
        duration: 3000,
      });
    });

    it('requires both fields and a new password of 8 characters', async () => {
      await click(button('change-password'));
      expect(error('currentPassword')).toBe(en.auth.errors.currentPassword.required);
      expect(error('newPassword')).toBe(en.auth.errors.newPassword.required);

      fill('correct horse', 'short');
      await click(button('change-password'));
      expect(error('newPassword')).toBe(en.auth.errors.newPassword.tooShort);
      expect(account.changePassword).not.toHaveBeenCalled();
    });

    it('shows an incorrect current password under its field', async () => {
      fill('wrong horse', 'battery staple');
      await click(button('change-password'));
      await answer(passwordChanged, { ok: false, errors: { currentPassword: 'incorrect' } });

      expect(error('currentPassword')).toBe(en.auth.errors.currentPassword.incorrect);
    });
  });

  describe('theme', () => {
    it('marks the current theme as selected', () => {
      expect(checked('theme-')).toBe('theme-system');
    });

    it('selecting Dark sets the theme to dark', async () => {
      await click(toggle('theme-dark'));
      expect(theme.setMode).toHaveBeenCalledWith('dark');
    });
  });

  it('logs out and opens the login screen', async () => {
    await click(button('logout'));

    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('says so when logging out fails', async () => {
    auth.logout.mockReturnValue(throwError(() => new Error('offline')));
    await click(button('logout'));

    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(snackBar.open).toHaveBeenCalledWith(en.auth.errors.form.unknown, undefined, {
      duration: 3000,
    });
  });

  it('ends with the version: the commit the app was built from (dev outside a Docker build)', () => {
    const version = host().querySelector('[data-testid="version"]');

    expect(version?.textContent?.trim()).toBe('Version dev');
    expect(host().querySelector('main')!.lastElementChild).toBe(version);
  });

  describe('delete account', () => {
    const signedInAs = async (isAdmin: boolean) => {
      auth.state.update((state) => ({ ...state!, user: { ...state!.user!, isAdmin } }));
      await fixture.whenStable();
    };

    it('the admin sees why their account cannot be deleted, and no delete action', async () => {
      await signedInAs(true);

      expect(host().querySelector('[data-testid="delete-account"]')).toBeNull();
      expect(host().querySelector('[data-testid="delete-admin-notice"]')?.textContent?.trim()).toBe(
        en.settings.delete.adminNotice,
      );
    });

    it('a member opens the confirmation dialog', async () => {
      await signedInAs(false);
      expect(host().textContent).toContain(en.settings.delete.warning);

      await click(button('delete-account'));

      expect(dialog.open).toHaveBeenCalledWith(DeleteAccountDialogComponent, expect.anything());
    });

    it('once deleted, opens the login screen and confirms', async () => {
      await signedInAs(false);
      await click(button('delete-account'));
      dialogClosed.next(true);
      await fixture.whenStable();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
      expect(snackBar.open).toHaveBeenCalledWith(en.settings.delete.done, undefined, {
        duration: 3000,
      });
    });

    it('does nothing when the dialog is cancelled', async () => {
      await signedInAs(false);
      await click(button('delete-account'));
      dialogClosed.next(undefined);
      await fixture.whenStable();

      expect(router.navigateByUrl).not.toHaveBeenCalled();
      expect(snackBar.open).not.toHaveBeenCalled();
    });
  });
});
