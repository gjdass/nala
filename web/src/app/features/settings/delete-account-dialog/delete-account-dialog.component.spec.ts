import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { AccountService } from '../../../core/account/account.service';
import { AccountResult } from '../../../core/auth/auth.models';
import { translocoTesting } from '../../../testing/transloco-testing';
import { DeleteAccountDialogComponent } from './delete-account-dialog.component';

describe('DeleteAccountDialogComponent', () => {
  let fixture: ComponentFixture<DeleteAccountDialogComponent>;
  let deleted: Subject<AccountResult>;
  let account: { deleteAccount: ReturnType<typeof vi.fn> };
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const host = () => fixture.nativeElement as HTMLElement;
  const password = () => host().querySelector<HTMLInputElement>('input[data-testid="password"]')!;
  const button = (testId: string) =>
    host().querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!;
  const error = () => host().querySelector('[data-testid="error-password"]')?.textContent?.trim();
  const type = (value: string) => {
    password().value = value;
    password().dispatchEvent(new Event('input'));
    password().dispatchEvent(new Event('blur'));
  };
  const click = async (element: HTMLElement) => {
    element.click();
    await fixture.whenStable();
  };
  const answer = async (value: AccountResult) => {
    deleted.next(value);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    deleted = new Subject<AccountResult>();
    account = { deleteAccount: vi.fn(() => deleted) };
    dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [DeleteAccountDialogComponent, translocoTesting()],
      providers: [
        { provide: AccountService, useValue: account },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DeleteAccountDialogComponent);
    await fixture.whenStable();
  });

  it('asks for confirmation with a password field', () => {
    expect(host().textContent).toContain(en.settings.delete.dialogTitle);
    expect(host().textContent).toContain(en.settings.delete.dialogText);
    expect(password().type).toBe('password');
    expect(password().autocomplete).toBe('current-password');
  });

  it('requires the password before deleting', async () => {
    await click(button('confirm-delete'));

    expect(error()).toBe(en.auth.errors.password.required);
    expect(account.deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes with the password and closes with true', async () => {
    type('correct horse');
    await click(button('confirm-delete'));

    expect(account.deleteAccount).toHaveBeenCalledWith({ password: 'correct horse' });
    expect(button('confirm-delete').disabled).toBe(true);
    await answer({ ok: true });
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('shows a wrong password under the field and stays open', async () => {
    type('wrong horse');
    await click(button('confirm-delete'));
    await answer({ ok: false, errors: { password: 'incorrect' } });

    expect(error()).toBe(en.auth.errors.password.incorrect);
    expect(button('confirm-delete').disabled).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('shows a form error in the dialog', async () => {
    type('correct horse');
    await click(button('confirm-delete'));
    await answer({ ok: false, errors: { form: 'unknown' } });

    expect(host().querySelector('[data-testid="form-error"]')?.textContent?.trim()).toBe(
      en.auth.errors.form.unknown,
    );
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('Cancel closes without deleting', async () => {
    await click(button('cancel-delete'));

    expect(dialogRef.close).toHaveBeenCalledWith();
    expect(account.deleteAccount).not.toHaveBeenCalled();
  });
});
