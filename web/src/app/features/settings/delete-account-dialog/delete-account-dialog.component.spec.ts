import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { AccountService } from '../../../core/account/account.service';
import { AccountResult } from '../../../core/auth/auth.models';
import { Baby } from '../../../core/babies/baby.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { CurrentFamilyService } from '../../../core/families/current-family.service';
import { Family } from '../../../core/families/family.models';
import { translocoTesting } from '../../../testing/transloco-testing';
import { DeleteAccountDialogComponent } from './delete-account-dialog.component';

describe('DeleteAccountDialogComponent', () => {
  let fixture: ComponentFixture<DeleteAccountDialogComponent>;
  let deleted: Subject<AccountResult>;
  let account: { deleteAccount: ReturnType<typeof vi.fn> };
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let families: ReturnType<typeof signal<Family[] | null>>;
  let babies: ReturnType<typeof signal<Baby[] | null>>;

  const baby = (name: string, familyId: string): Baby => ({
    id: `${name}-id`,
    familyId,
    name,
    birthDate: '2026-09-01',
    sex: 'unspecified',
    birthWeightG: null,
    birthLengthCm: null,
    birthHeadCircumferenceCm: null,
  });
  const render = async () => {
    fixture = TestBed.createComponent(DeleteAccountDialogComponent);
    await fixture.whenStable();
  };
  const warning = () => host().querySelector('[data-testid="families-warning"]');
  const doomedFamilies = () =>
    Array.from(host().querySelectorAll('[data-testid="doomed-family"]')).map((f) => ({
      name: f.querySelector('[data-testid="doomed-family-name"]')?.textContent?.trim(),
      babies: f.querySelector('[data-testid="doomed-family-babies"]')?.textContent?.trim(),
    }));

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
    families = signal<Family[] | null>([{ id: 'f1', name: 'Martins', isAdmin: false }]);
    babies = signal<Baby[] | null>([baby('Lea', 'f1')]);
    await TestBed.configureTestingModule({
      imports: [DeleteAccountDialogComponent, translocoTesting()],
      providers: [
        { provide: AccountService, useValue: account },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: CurrentFamilyService, useValue: { families } },
        { provide: SelectedBabyService, useValue: { babies } },
      ],
    }).compileComponents();
    await render();
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

  describe('as a family admin', () => {
    beforeEach(async () => {
      families.set([
        { id: 'f1', name: 'Martins', isAdmin: false },
        { id: 'f2', name: 'Others', isAdmin: true },
        { id: 'f3', name: 'Cousins', isAdmin: true },
      ]);
      babies.set([baby('Lea', 'f1'), baby('Tom', 'f2'), baby('Zoe', 'f2')]);
      await render();
    });

    it('warns that each family they administer will be deleted, with its babies', () => {
      expect(warning()?.textContent).toContain(en.settings.delete.familiesWarning);
      expect(warning()?.getAttribute('role')).toBe('alert');
      expect(doomedFamilies()).toEqual([
        { name: 'Others', babies: 'Tom, Zoe' },
        { name: 'Cousins', babies: en.settings.delete.noBaby },
      ]);
    });

    it('the button reads "Delete my account and my families"', () => {
      expect(button('confirm-delete').textContent?.trim()).toBe(
        en.settings.delete.confirmWithFamilies,
      );
    });
  });

  it('a user who administers no family sees no warning and the plain Delete button', () => {
    expect(warning()).toBeNull();
    expect(button('confirm-delete').textContent?.trim()).toBe(en.settings.delete.confirm);
  });
});
