import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import { AccountFieldsComponent, createAccountForm } from './account-fields.component';

@Component({
  imports: [AccountFieldsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-account-fields [form]="form" />`,
})
class HostComponent {
  readonly form = createAccountForm();
}

describe('AccountFieldsComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  const host = () => fixture.nativeElement as HTMLElement;
  const input = (field: string) =>
    host().querySelector<HTMLInputElement>(`input[data-testid="${field}"]`)!;
  const error = (field: string) =>
    host().querySelector(`[data-testid="error-${field}"]`)?.textContent?.trim();
  const type = async (field: string, value: string) => {
    input(field).value = value;
    input(field).dispatchEvent(new Event('input'));
    input(field).dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('renders the email, display name and new password fields', () => {
    expect(input('email').type).toBe('email');
    expect(input('email').autocomplete).toBe('email');
    expect(input('displayName').type).toBe('text');
    expect(input('password').type).toBe('password');
    expect(input('password').autocomplete).toBe('new-password');
    expect(host().textContent).toContain(en.auth.fields.passwordHint);
  });

  it('binds the inputs to the form', async () => {
    await type('email', 'ben@mail.com');
    await type('displayName', 'Ben');
    await type('password', 'correct horse');

    expect(fixture.componentInstance.form.getRawValue()).toEqual({
      email: 'ben@mail.com',
      displayName: 'Ben',
      password: 'correct horse',
    });
  });

  it('shows required errors once the form is touched', async () => {
    fixture.componentInstance.form.markAllAsTouched();
    fixture.componentRef.changeDetectorRef.markForCheck();
    await fixture.whenStable();

    expect(error('email')).toBe(en.auth.errors.email.required);
    expect(error('displayName')).toBe(en.auth.errors.displayName.required);
    expect(error('password')).toBe(en.auth.errors.password.required);
  });

  it('shows a server error code set on a control', async () => {
    const email = fixture.componentInstance.form.controls.email;
    email.setValue('anna@mail.com');
    email.markAsTouched();
    email.setErrors({ server: 'taken' });
    fixture.componentRef.changeDetectorRef.markForCheck();
    await fixture.whenStable();

    expect(error('email')).toBe(en.auth.errors.email.taken);
  });
});
