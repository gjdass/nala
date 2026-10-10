import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import {
  AcceptInvitationResult,
  AuthState,
  InvitationLookup,
  RegisterResult,
} from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { CurrentFamilyService } from '../../../core/families/current-family.service';
import { translocoTesting } from '../../../testing/transloco-testing';
import { RegisterPage } from './register.page';

describe('RegisterPage', () => {
  let fixture: ComponentFixture<RegisterPage>;
  let lookup: Subject<InvitationLookup>;
  let result: Subject<RegisterResult>;
  let accepted: Subject<AcceptInvitationResult>;
  let auth: {
    lookupInvitation: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    acceptInvitation: ReturnType<typeof vi.fn>;
    state: ReturnType<typeof signal<AuthState | null>>;
  };
  let families: { select: ReturnType<typeof vi.fn> };
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  const host = () => fixture.nativeElement as HTMLElement;
  const input = (field: string) =>
    host().querySelector<HTMLInputElement>(`input[data-testid="${field}"]`);
  const error = (field: string) =>
    host().querySelector(`[data-testid="error-${field}"]`)?.textContent?.trim();
  const formError = () => host().querySelector('[data-testid="form-error"]')?.textContent?.trim();
  const submit = () => host().querySelector<HTMLButtonElement>('button[data-testid="submit"]');
  const toLogin = () => host().querySelector<HTMLAnchorElement>('a[data-testid="to-login"]');
  const loading = () => host().querySelector('mat-progress-bar');
  const existing = () => host().querySelector<HTMLAnchorElement>('a[data-testid="existing-account"]');
  const accept = () => host().querySelector<HTMLButtonElement>('button[data-testid="accept"]');
  const notNow = () => host().querySelector<HTMLButtonElement>('button[data-testid="not-now"]');
  const subtitle = () => host().querySelector('mat-card-subtitle')?.textContent?.trim();

  const type = (field: string, value: string) => {
    input(field)!.value = value;
    input(field)!.dispatchEvent(new Event('input'));
    input(field)!.dispatchEvent(new Event('blur'));
  };
  const fillValid = () => {
    type('email', ' Ben@Mail.com ');
    type('displayName', ' Ben ');
    type('password', 'correct horse');
  };
  const found = async () => {
    lookup.next({
      ok: true,
      invitation: {
        kind: 'join',
        invitedBy: 'Anna',
        familyName: 'Martins',
        expiresAt: '2026-10-04T20:00:00Z',
      },
    });
    await fixture.whenStable();
  };
  const signIn = () =>
    auth.state.set({
      setupRequired: false,
      smtpEnabled: false,
      user: { id: 'u3', email: 'carl@mail.com', displayName: 'Carl', language: 'en', isAdmin: false },
    });
  const send = async () => {
    submit()!.click();
    await fixture.whenStable();
  };
  const answer = async (value: RegisterResult) => {
    result.next(value);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    lookup = new Subject<InvitationLookup>();
    result = new Subject<RegisterResult>();
    accepted = new Subject<AcceptInvitationResult>();
    auth = {
      lookupInvitation: vi.fn(() => lookup),
      register: vi.fn(() => result),
      acceptInvitation: vi.fn(() => accepted),
      state: signal<AuthState | null>({ setupRequired: false, user: null, smtpEnabled: false }),
    };
    families = { select: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [RegisterPage, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: CurrentFamilyService, useValue: families },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ token: 'a-b_c' }) } },
        },
      ],
    }).compileComponents();
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(RegisterPage);
    await fixture.whenStable();
  });

  it('looks the invitation up and shows a loading state meanwhile, without the form', () => {
    expect(auth.lookupInvitation).toHaveBeenCalledWith('a-b_c');
    expect(loading()).not.toBeNull();
    expect(input('email')).toBeNull();
  });

  it('shows the form, naming who sent the invitation and to which family', async () => {
    await found();

    expect(loading()).toBeNull();
    expect(host().querySelector('mat-card-title')?.textContent?.trim()).toBe(
      en.auth.register.title,
    );
    expect(host().querySelector('mat-card-subtitle')?.textContent?.trim()).toBe(
      en.auth.register.subtitle.replace('{{name}}', 'Anna').replace('{{family}}', 'Martins'),
    );
    expect(input('email')).not.toBeNull();
    expect(input('displayName')).not.toBeNull();
    expect(input('password')).not.toBeNull();
  });

  it.each([
    ['invitationUnknown', en.auth.errors.form.invitationUnknown],
    ['invitationExpired', en.auth.errors.form.invitationExpired],
    ['invitationUsed', en.auth.errors.form.invitationUsed],
    ['invitationRevoked', en.auth.errors.form.invitationRevoked],
    ['unknown', en.auth.errors.form.unknown],
  ])(
    'an unusable link (%s) shows its message and a way to log in, no form',
    async (code, message) => {
      lookup.next({ ok: false, code });
      await fixture.whenStable();

      expect(formError()).toBe(message);
      expect(input('email')).toBeNull();
      expect(submit()).toBeNull();
      expect(toLogin()?.getAttribute('href')).toBe('/login');
      expect(toLogin()?.textContent?.trim()).toBe(en.auth.register.toLogin);
    },
  );

  it('checks the fields before sending', async () => {
    await found();
    type('email', 'ben@localhost');
    await send();

    expect(error('email')).toBe(en.auth.errors.email.invalid);
    expect(error('displayName')).toBe(en.auth.errors.displayName.required);
    expect(error('password')).toBe(en.auth.errors.password.required);
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('submits the trimmed values with the active language to the invitation', async () => {
    TestBed.inject(TranslocoService).setActiveLang('fr');
    await found();
    fillValid();
    await send();

    expect(auth.register).toHaveBeenCalledWith('a-b_c', {
      email: 'Ben@Mail.com',
      displayName: 'Ben',
      password: 'correct horse',
      language: 'fr',
    });
    expect(submit()!.disabled).toBe(true);
  });

  it('opens the app once the account is created', async () => {
    await found();
    fillValid();
    await send();
    await answer({ ok: true });

    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('shows a taken email under the email field', async () => {
    await found();
    fillValid();
    await send();
    await answer({ ok: false, errors: { email: 'taken' } });

    expect(error('email')).toBe(en.auth.register.emailTaken);
    expect(existing()).not.toBeNull();
    expect(submit()!.disabled).toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('switches to the unusable-link message when the invitation is refused on submit', async () => {
    await found();
    fillValid();
    await send();
    await answer({ ok: false, errors: { form: 'invitationUsed' } });

    expect(formError()).toBe(en.auth.errors.form.invitationUsed);
    expect(input('email')).toBeNull();
    expect(toLogin()).not.toBeNull();
  });

  it('shows a generic error when the request fails, keeping the form', async () => {
    await found();
    fillValid();
    await send();
    await answer({ ok: false, errors: { form: 'unknown' } });

    expect(formError()).toBe(en.auth.errors.form.unknown);
    expect(input('email')).not.toBeNull();
  });

  it('offers to log in with an existing account and come back to the invitation', async () => {
    await found();

    expect(existing()?.textContent?.trim()).toBe(en.auth.register.existingAccount);
    expect(existing()?.getAttribute('href')).toBe('/login?invite=a-b_c');
  });

  describe('signed in', () => {
    beforeEach(async () => {
      signIn();
      await found();
    });

    it('offers to accept with the current account, without the account fields', () => {
      expect(host().querySelector('mat-card-title')?.textContent?.trim()).toBe(en.auth.accept.title);
      expect(subtitle()).toBe(
        en.auth.accept.subtitle.replace('{{name}}', 'Anna').replace('{{family}}', 'Martins'),
      );
      expect(input('email')).toBeNull();
      expect(accept()?.textContent?.trim()).toBe(en.auth.accept.accept);
      expect(notNow()?.textContent?.trim()).toBe(en.auth.accept.notNow);
    });

    it('accepts, selects the joined family and opens the app', async () => {
      accept()!.click();
      await fixture.whenStable();
      expect(auth.acceptInvitation).toHaveBeenCalledWith('a-b_c');
      expect(accept()!.disabled).toBe(true);

      accepted.next({ ok: true, familyId: 'f2' });
      await fixture.whenStable();

      expect(families.select).toHaveBeenCalledWith('f2');
      expect(navigateByUrl).toHaveBeenCalledWith('/');
    });

    it('Not now opens the app and leaves the invitation unused', async () => {
      notNow()!.click();
      await fixture.whenStable();

      expect(auth.acceptInvitation).not.toHaveBeenCalled();
      expect(navigateByUrl).toHaveBeenCalledWith('/');
    });

    it('says when the user is already in the family, keeping the card', async () => {
      accept()!.click();
      accepted.next({ ok: false, errors: { form: 'alreadyMember' } });
      await fixture.whenStable();

      expect(formError()).toBe(en.auth.errors.form.alreadyMember);
      expect(accept()!.disabled).toBe(false);
      expect(notNow()).not.toBeNull();
      expect(families.select).not.toHaveBeenCalled();
    });

    it('switches to the unusable-link message when the invitation is refused', async () => {
      accept()!.click();
      accepted.next({ ok: false, errors: { form: 'invitationRevoked' } });
      await fixture.whenStable();

      expect(formError()).toBe(en.auth.errors.form.invitationRevoked);
      expect(accept()).toBeNull();
      expect(toLogin()).not.toBeNull();
    });
  });
});
