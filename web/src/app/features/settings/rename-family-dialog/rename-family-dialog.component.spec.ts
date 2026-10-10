import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { Family, FamilyResult } from '../../../core/families/family.models';
import { FamilyService } from '../../../core/families/family.service';
import { translocoTesting } from '../../../testing/transloco-testing';
import {
  RenameFamilyDialogComponent,
  RenameFamilyDialogData,
} from './rename-family-dialog.component';

describe('RenameFamilyDialogComponent', () => {
  let fixture: ComponentFixture<RenameFamilyDialogComponent>;
  let renamed: Subject<FamilyResult>;
  let families: { rename: ReturnType<typeof vi.fn> };
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const martins: Family = { id: 'f1', name: 'Martins', isAdmin: true };

  const host = () => fixture.nativeElement as HTMLElement;
  const name = () => host().querySelector<HTMLInputElement>('input[data-testid="familyName"]')!;
  const button = (testId: string) =>
    host().querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!;
  const error = () => host().querySelector('[data-testid="error-familyName"]')?.textContent?.trim();
  const formError = () => host().querySelector('[data-testid="form-error"]')?.textContent?.trim();
  const type = (value: string) => {
    name().value = value;
    name().dispatchEvent(new Event('input'));
    name().dispatchEvent(new Event('blur'));
  };
  const click = async (element: HTMLElement) => {
    element.click();
    await fixture.whenStable();
  };
  const answer = async (value: FamilyResult) => {
    renamed.next(value);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    renamed = new Subject<FamilyResult>();
    families = { rename: vi.fn(() => renamed) };
    dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [RenameFamilyDialogComponent, translocoTesting()],
      providers: [
        { provide: FamilyService, useValue: families },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { family: martins } satisfies RenameFamilyDialogData },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RenameFamilyDialogComponent);
    await fixture.whenStable();
  });

  it('asks for the new name, starting from the current one', () => {
    expect(host().textContent).toContain(en.families.rename.title);
    expect(name().value).toBe('Martins');
  });

  it.each([
    ['  ', 'required'],
    ['a'.repeat(51), 'tooLong'],
  ] as const)('refuses %j before saving (%s)', async (value, code) => {
    type(value);
    await click(button('save'));

    expect(error()).toBe(en.families.errors.name[code]);
    expect(families.rename).not.toHaveBeenCalled();
  });

  it('saves the trimmed name and closes with the renamed family', async () => {
    type(' The Martins ');
    await click(button('save'));

    expect(families.rename).toHaveBeenCalledWith('f1', 'The Martins');
    expect(button('save').disabled).toBe(true);
    await answer({ ok: true, family: { ...martins, name: 'The Martins' } });
    expect(dialogRef.close).toHaveBeenCalledWith({ ...martins, name: 'The Martins' });
  });

  it("shows the server's name error under the field and stays open", async () => {
    type('The Martins');
    await click(button('save'));
    await answer({ ok: false, errors: { name: 'tooLong' } });

    expect(error()).toBe(en.families.errors.name.tooLong);
    expect(button('save').disabled).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('shows the generic error for any other failure and stays open', async () => {
    type('The Martins');
    await click(button('save'));
    await answer({ ok: false, errors: { form: 'familyAdminOnly' } });

    expect(formError()).toBe(en.auth.errors.form.unknown);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('closes with nothing on Cancel', async () => {
    await click(button('cancel'));

    expect(dialogRef.close).toHaveBeenCalledWith();
    expect(families.rename).not.toHaveBeenCalled();
  });
});
