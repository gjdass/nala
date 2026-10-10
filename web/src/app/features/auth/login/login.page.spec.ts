import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { AuthState, LoginResult } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { translocoTesting } from '../../../testing/transloco-testing';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let result: Subject<LoginResult>;
  let auth: { login: ReturnType<typeof vi.fn>; state: ReturnType<typeof signal<AuthState | null>> };
  let router: { navigateByUrl: ReturnType<typeof vi.spyOn> };
  let route: { snapshot: { queryParamMap: ReturnType<typeof convertToParamMap> } };

  const host = () => fixture.nativeElement as HTMLElement;
  const input = (field: string) =>
    host().querySelector<HTMLInputElement>(`input[data-testid="${field}"]`)!;
  const error = (field: string) =>
    host().querySelector(`[data-testid="error-${field}"]`)?.textContent?.trim();
  const formError = () => host().querySelector('[data-testid="form-error"]')?.textContent?.trim();
  const submit = () => host().querySelector<HTMLButtonElement>('button[data-testid="submit"]')!;
  const forgot = () => host().querySelector<HTMLAnchorElement>('a[data-testid="forgot"]');
  const askAdmin = () => host().querySelector('[data-testid="ask-admin"]')?.textContent?.trim();
  const smtp = async (enabled: boolean) => {
    auth.state.set({ setupRequired: false, user: null, smtpEnabled: enabled });
    await fixture.whenStable();
  };

  const type = (field: string, value: string) => {
    input(field).value = value;
    input(field).dispatchEvent(new Event('input'));
    input(field).dispatchEvent(new Event('blur'));
  };
  const fillValid = () => {
    type('email', ' Anna@Mail.com ');
    type('password', 'short');
  };
  const send = async () => {
    submit().click();
    await fixture.whenStable();
  };
  const answer = async (value: LoginResult) => {
    result.next(value);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    result = new Subject<LoginResult>();
    auth = { login: vi.fn(() => result), state: signal<AuthState | null>(null) };
    route = { snapshot: { queryParamMap: convertToParamMap({}) } };
    await TestBed.configureTestingModule({
      imports: [LoginPage, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: route },
      ],
    }).compileComponents();
    router = {
      navigateByUrl: vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true),
    };
    fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
  });

  it('shows the translated title and the email and password fields', () => {
    expect(host().querySelector('mat-card-title')?.textContent?.trim()).toBe(en.auth.login.title);
    expect(input('email').type).toBe('email');
    expect(input('email').autocomplete).toBe('username');
    expect(input('password').type).toBe('password');
    expect(input('password').autocomplete).toBe('current-password');
    expect(submit().textContent?.trim()).toBe(en.auth.login.submit);
  });

  it('shows a required error per empty field on submit, and sends nothing', async () => {
    await send();

    expect(error('email')).toBe(en.auth.errors.email.required);
    expect(error('password')).toBe(en.auth.errors.password.required);
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('refuses a malformed email', async () => {
    type('email', 'anna');
    await fixture.whenStable();
    expect(error('email')).toBe(en.auth.errors.email.invalid);
  });

  it('submits the trimmed email and the password as typed, whatever its length', async () => {
    fillValid();
    await send();

    expect(auth.login).toHaveBeenCalledWith({ email: 'Anna@Mail.com', password: 'short' });
  });

  it('disables submit while the request is pending', async () => {
    fillValid();
    await send();
    expect(submit().disabled).toBe(true);

    await answer({ ok: false, errors: { form: 'invalidCredentials' } });
    expect(submit().disabled).toBe(false);
  });

  it('opens the app once logged in', async () => {
    fillValid();
    await send();
    await answer({ ok: true });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it.each([
    ['invalidCredentials', en.auth.errors.form.invalidCredentials],
    ['tooManyAttempts', en.auth.errors.form.tooManyAttempts],
    ['unknown', en.auth.errors.form.unknown],
  ])('shows the %s error', async (code, message) => {
    fillValid();
    await send();
    await answer({ ok: false, errors: { form: code } });

    expect(formError()).toBe(message);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('clears the previous error on a new attempt', async () => {
    fillValid();
    await send();
    await answer({ ok: false, errors: { form: 'invalidCredentials' } });

    await send();

    expect(formError()).toBeUndefined();
  });

  it('offers "Forgot password" when the instance can email reset links', async () => {
    await smtp(true);

    expect(forgot()?.textContent?.trim()).toBe(en.auth.login.forgot);
    expect(forgot()?.getAttribute('href')).toBe('/forgot');
    expect(askAdmin()).toBeUndefined();
  });

  it('hides "Forgot password" and says to ask the admin when it cannot', async () => {
    await smtp(false);

    expect(forgot()).toBeNull();
    expect(askAdmin()).toBe(en.auth.login.askAdmin);
  });

  it('comes back to the invitation it was opened from once logged in', async () => {
    route.snapshot.queryParamMap = convertToParamMap({ invite: 'a-b_c' });
    fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
    fillValid();
    await send();
    await answer({ ok: true });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/invite/a-b_c');
  });
});
