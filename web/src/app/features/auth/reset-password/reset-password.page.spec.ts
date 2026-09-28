import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { ResetLinkLookup, ResetPasswordResult } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { translocoTesting } from '../../../testing/transloco-testing';
import { ResetPasswordPage } from './reset-password.page';

describe('ResetPasswordPage', () => {
  let fixture: ComponentFixture<ResetPasswordPage>;
  let lookup: Subject<ResetLinkLookup>;
  let result: Subject<ResetPasswordResult>;
  let auth: { lookupResetLink: ReturnType<typeof vi.fn>; resetPassword: ReturnType<typeof vi.fn> };
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

  const type = (value: string) => {
    input('password')!.value = value;
    input('password')!.dispatchEvent(new Event('input'));
    input('password')!.dispatchEvent(new Event('blur'));
  };
  const found = async () => {
    lookup.next({ ok: true, link: { email: 'ben@mail.com', expiresAt: '2026-09-28T20:00:00Z' } });
    await fixture.whenStable();
  };
  const send = async () => {
    submit()!.click();
    await fixture.whenStable();
  };
  const answer = async (value: ResetPasswordResult) => {
    result.next(value);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    lookup = new Subject<ResetLinkLookup>();
    result = new Subject<ResetPasswordResult>();
    auth = { lookupResetLink: vi.fn(() => lookup), resetPassword: vi.fn(() => result) };
    await TestBed.configureTestingModule({
      imports: [ResetPasswordPage, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ token: 'a-b_c' }) } },
        },
      ],
    }).compileComponents();
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ResetPasswordPage);
    await fixture.whenStable();
  });

  it('looks the link up and shows a loading state meanwhile, without the form', () => {
    expect(auth.lookupResetLink).toHaveBeenCalledWith('a-b_c');
    expect(loading()).not.toBeNull();
    expect(input('password')).toBeNull();
  });

  it('shows the form for the account the link belongs to', async () => {
    await found();

    expect(loading()).toBeNull();
    expect(host().querySelector('mat-card-title')?.textContent?.trim()).toBe(en.auth.reset.title);
    expect(host().querySelector('mat-card-subtitle')?.textContent?.trim()).toBe(
      en.auth.reset.subtitle.replace('{{email}}', 'ben@mail.com'),
    );
    expect(input('password')?.getAttribute('autocomplete')).toBe('new-password');
    // Lets password managers file the new password under the right account.
    const username = host().querySelector<HTMLInputElement>('input[autocomplete="username"]');
    expect(username?.value).toBe('ben@mail.com');
  });

  it.each([
    ['resetLinkUnknown', en.auth.errors.form.resetLinkUnknown],
    ['resetLinkExpired', en.auth.errors.form.resetLinkExpired],
    ['resetLinkUsed', en.auth.errors.form.resetLinkUsed],
    ['accountDisabled', en.auth.errors.form.accountDisabled],
    ['unknown', en.auth.errors.form.unknown],
  ])(
    'an unusable link (%s) shows its message and a way to log in, no form',
    async (code, message) => {
      lookup.next({ ok: false, code });
      await fixture.whenStable();

      expect(message).toBeTruthy();
      expect(formError()).toBe(message);
      expect(input('password')).toBeNull();
      expect(toLogin()?.getAttribute('href')).toBe('/login');
      expect(toLogin()?.textContent?.trim()).toBe(en.auth.reset.toLogin);
    },
  );

  it.each([
    ['', en.auth.errors.password.required],
    ['short', en.auth.errors.password.tooShort],
  ])('checks the password (%j) before sending', async (value, message) => {
    await found();
    type(value);
    await send();

    expect(error('password')).toBe(message);
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });

  it('sends the new password to the link and opens the app once done', async () => {
    await found();
    type('battery staple');
    await send();

    expect(auth.resetPassword).toHaveBeenCalledWith('a-b_c', { password: 'battery staple' });
    expect(submit()!.disabled).toBe(true);
    await answer({ ok: true });

    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('shows a server-side password error under the field', async () => {
    await found();
    type('battery staple');
    await send();
    await answer({ ok: false, errors: { password: 'tooShort' } });

    expect(error('password')).toBe(en.auth.errors.password.tooShort);
    expect(submit()!.disabled).toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it.each(['resetLinkUsed', 'accountDisabled'])(
    'switches to the unusable-link message when the link is refused on submit (%s)',
    async (code) => {
      await found();
      type('battery staple');
      await send();
      await answer({ ok: false, errors: { form: code } });

      expect(formError()).toBe(en.auth.errors.form[code as keyof typeof en.auth.errors.form]);
      expect(input('password')).toBeNull();
      expect(toLogin()).not.toBeNull();
    },
  );

  it('shows a generic error when the request fails, keeping the form', async () => {
    await found();
    type('battery staple');
    await send();
    await answer({ ok: false, errors: { form: 'unknown' } });

    expect(formError()).toBe(en.auth.errors.form.unknown);
    expect(input('password')).not.toBeNull();
  });
});
