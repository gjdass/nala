import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { SetupResult } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { translocoTesting } from '../../../testing/transloco-testing';
import { SetupPage } from './setup.page';

describe('SetupPage', () => {
  let fixture: ComponentFixture<SetupPage>;
  let result: Subject<SetupResult>;
  let auth: { setup: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  const host = () => fixture.nativeElement as HTMLElement;
  const input = (field: string) =>
    host().querySelector<HTMLInputElement>(`input[data-testid="${field}"]`)!;
  const error = (field: string) =>
    host().querySelector(`[data-testid="error-${field}"]`)?.textContent?.trim();
  const submit = () => host().querySelector<HTMLButtonElement>('button[data-testid="submit"]')!;

  const type = (field: string, value: string) => {
    input(field).value = value;
    input(field).dispatchEvent(new Event('input'));
    input(field).dispatchEvent(new Event('blur'));
  };
  const fillValid = () => {
    type('email', ' Anna@Mail.com ');
    type('displayName', '  Anna ');
    type('password', 'correct horse');
    type('familyName', '  The Martins ');
  };
  const send = async () => {
    submit().click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    result = new Subject<SetupResult>();
    auth = { setup: vi.fn(() => result) };
    router = { navigateByUrl: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [SetupPage, translocoTesting()],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SetupPage);
    await fixture.whenStable();
  });

  it('shows the translated title and the four fields', () => {
    expect(host().querySelector('mat-card-title')?.textContent?.trim()).toBe(en.auth.setup.title);
    expect(input('email').type).toBe('email');
    expect(input('displayName').type).toBe('text');
    expect(input('password').type).toBe('password');
    expect(input('familyName').type).toBe('text');
  });

  it('shows a required error per empty field on submit, and sends nothing', async () => {
    await send();

    expect(error('email')).toBe(en.auth.errors.email.required);
    expect(error('displayName')).toBe(en.auth.errors.displayName.required);
    expect(error('password')).toBe(en.auth.errors.password.required);
    expect(error('familyName')).toBe(en.families.errors.name.required);
    expect(auth.setup).not.toHaveBeenCalled();
  });

  it.each(['anna', 'anna@localhost', 'a@b@c.com'])('refuses the email "%s"', async (email) => {
    type('email', email);
    await fixture.whenStable();
    expect(error('email')).toBe(en.auth.errors.email.invalid);
  });

  it('refuses a password shorter than 8 characters', async () => {
    type('password', '1234567');
    await fixture.whenStable();
    expect(error('password')).toBe(en.auth.errors.password.tooShort);
  });

  it('refuses a display name longer than 50 characters', async () => {
    type('displayName', 'a'.repeat(51));
    await fixture.whenStable();
    expect(error('displayName')).toBe(en.auth.errors.displayName.tooLong);
  });

  it('refuses a family name longer than 50 characters', async () => {
    type('familyName', 'a'.repeat(51));
    await fixture.whenStable();
    expect(error('familyName')).toBe(en.families.errors.name.tooLong);
  });

  it('submits the trimmed values with the active language', async () => {
    TestBed.inject(TranslocoService).setActiveLang('fr');
    fillValid();
    await send();

    expect(auth.setup).toHaveBeenCalledWith({
      email: 'Anna@Mail.com',
      displayName: 'Anna',
      password: 'correct horse',
      language: 'fr',
      familyName: 'The Martins',
    });
  });

  it('disables submit while the request is pending', async () => {
    fillValid();
    await send();
    expect(submit().disabled).toBe(true);

    result.next({ ok: false, errors: { form: 'unknown' } });
    await fixture.whenStable();
    expect(submit().disabled).toBe(false);
  });

  it('goes to the home page once the admin is created', async () => {
    fillValid();
    await send();
    result.next({ ok: true });
    await fixture.whenStable();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it("shows the server's field errors", async () => {
    fillValid();
    await send();
    result.next({ ok: false, errors: { email: 'invalid' } });
    await fixture.whenStable();

    expect(error('email')).toBe(en.auth.errors.email.invalid);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it("shows the server's family name error under its field", async () => {
    fillValid();
    await send();
    result.next({ ok: false, errors: { familyName: 'tooLong' } });
    await fixture.whenStable();

    expect(error('familyName')).toBe(en.families.errors.name.tooLong);
  });

  it('when the instance is already set up, says so and goes home', async () => {
    fillValid();
    await send();
    result.next({ ok: false, errors: { form: 'alreadySetUp' } });
    await fixture.whenStable();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('shows a generic error when the request fails', async () => {
    fillValid();
    await send();
    result.next({ ok: false, errors: { form: 'unknown' } });
    await fixture.whenStable();

    expect(host().querySelector('[data-testid="form-error"]')?.textContent?.trim()).toBe(
      en.auth.errors.form.unknown,
    );
  });
});
