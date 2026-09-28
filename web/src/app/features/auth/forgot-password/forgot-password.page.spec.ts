import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { ForgotPasswordResult } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { translocoTesting } from '../../../testing/transloco-testing';
import { ForgotPasswordPage } from './forgot-password.page';

describe('ForgotPasswordPage', () => {
  let fixture: ComponentFixture<ForgotPasswordPage>;
  let result: Subject<ForgotPasswordResult>;
  let auth: { requestPasswordReset: ReturnType<typeof vi.fn> };

  const host = () => fixture.nativeElement as HTMLElement;
  const input = () => host().querySelector<HTMLInputElement>('input[data-testid="email"]');
  const error = () => host().querySelector('[data-testid="error-email"]')?.textContent?.trim();
  const formError = () => host().querySelector('[data-testid="form-error"]')?.textContent?.trim();
  const submit = () => host().querySelector<HTMLButtonElement>('button[data-testid="submit"]');
  const toLogin = () => host().querySelector<HTMLAnchorElement>('a[data-testid="to-login"]');
  const sent = () => host().querySelector('[data-testid="sent"]')?.textContent?.trim();

  const type = (value: string) => {
    input()!.value = value;
    input()!.dispatchEvent(new Event('input'));
    input()!.dispatchEvent(new Event('blur'));
  };
  const send = async () => {
    submit()!.click();
    await fixture.whenStable();
  };
  const answer = async (value: ForgotPasswordResult) => {
    result.next(value);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    result = new Subject<ForgotPasswordResult>();
    auth = { requestPasswordReset: vi.fn(() => result) };
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordPage, translocoTesting()],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(ForgotPasswordPage);
    await fixture.whenStable();
  });

  it('asks for the account email, with a way back to login', () => {
    expect(host().querySelector('mat-card-title')?.textContent?.trim()).toBe(en.auth.forgot.title);
    expect(host().querySelector('mat-card-subtitle')?.textContent?.trim()).toBe(
      en.auth.forgot.subtitle,
    );
    expect(input()?.type).toBe('email');
    expect(input()?.autocomplete).toBe('username');
    expect(submit()?.textContent?.trim()).toBe(en.auth.forgot.submit);
    expect(toLogin()?.getAttribute('href')).toBe('/login');
  });

  it('refuses an empty or malformed email and sends nothing', async () => {
    await send();
    expect(error()).toBe(en.auth.errors.email.required);

    type('anna');
    await fixture.whenStable();
    expect(error()).toBe(en.auth.errors.email.invalid);
    expect(auth.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('sends the trimmed email and disables submit meanwhile', async () => {
    type(' Anna@Mail.com ');
    await send();

    expect(auth.requestPasswordReset).toHaveBeenCalledWith({ email: 'Anna@Mail.com' });
    expect(submit()?.disabled).toBe(true);
  });

  it('then shows the same confirmation whatever the email, without the form', async () => {
    type(' Anna@Mail.com ');
    await send();
    await answer({ ok: true });

    expect(sent()).toBe(en.auth.forgot.sent.replace('{{email}}', 'Anna@Mail.com'));
    expect(input()).toBeNull();
    expect(submit()).toBeNull();
    expect(toLogin()?.getAttribute('href')).toBe('/login');
  });

  it('shows a field error from the server', async () => {
    type('anna@mail.com');
    await send();
    await answer({ ok: false, errors: { email: 'invalid' } });

    expect(error()).toBe(en.auth.errors.email.invalid);
    expect(submit()?.disabled).toBe(false);
  });

  it.each([
    ['emailResetDisabled', en.auth.errors.form.emailResetDisabled],
    ['unknown', en.auth.errors.form.unknown],
  ])('shows the %s error', async (code, message) => {
    type('anna@mail.com');
    await send();
    await answer({ ok: false, errors: { form: code } });

    expect(formError()).toBe(message);
    expect(sent()).toBeUndefined();
  });
});
