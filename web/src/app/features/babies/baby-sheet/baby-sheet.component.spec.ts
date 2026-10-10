import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { Baby, BabyDeleteResult, BabyResult } from '../../../core/babies/baby.models';
import { BabyService } from '../../../core/babies/baby.service';
import { CurrentFamilyService } from '../../../core/families/current-family.service';
import { Family } from '../../../core/families/family.models';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';
import { TypeToConfirmDialogComponent } from '../../../shared/ui/type-to-confirm-dialog/type-to-confirm-dialog.component';
import { translocoTesting } from '../../../testing/transloco-testing';
import { BabySheetComponent } from './baby-sheet.component';

/** A CurrentFamilyService over the given families, the first one current. */
const familiesOf = (families: Family[] | null) => {
  const list = signal(families);
  return {
    list,
    current: computed(() => list()?.[0] ?? null),
    isAdminOf: (id: string) => list()?.find((f) => f.id === id)?.isAdmin ?? false,
  };
};
const martins: Family = { id: 'f1', name: 'Martins', isAdmin: true };

describe('BabySheetComponent', () => {
  let fixture: ComponentFixture<BabySheetComponent>;
  let created: Subject<BabyResult>;
  let babies: { create: ReturnType<typeof vi.fn> };
  let sheetRef: { close: ReturnType<typeof vi.fn>; onDismiss?: (() => void) | null };
  let confirmed: Subject<boolean | undefined>;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let families: ReturnType<typeof familiesOf>;

  const lea: Baby = {
    id: 'b1',
    familyId: 'f1',
    name: 'Lea',
    birthDate: '2026-09-01',
    sex: 'unspecified',
    birthWeightG: null,
    birthLengthCm: null,
    birthHeadCircumferenceCm: null,
  };

  const host = () => fixture.nativeElement as HTMLElement;
  const button = (testId: string) =>
    host().querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!;
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
  const click = async (testId: string) => {
    button(testId).click();
    await fixture.whenStable();
  };
  const fillValid = async () => {
    await type('name', 'Lea');
    // The birth date is picked from the calendar; set it on the form directly.
    fixture.componentInstance.form.controls.birthDate.setValue(new Date(2026, 8, 1));
    fixture.componentRef.changeDetectorRef.markForCheck();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    created = new Subject<BabyResult>();
    babies = { create: vi.fn(() => created) };
    families = familiesOf([martins, { id: 'f2', name: 'Durands', isAdmin: false }]);
    sheetRef = { close: vi.fn() };
    confirmed = new Subject<boolean | undefined>();
    dialog = { open: vi.fn(() => ({ afterClosed: () => confirmed })) };
    await TestBed.configureTestingModule({
      imports: [BabySheetComponent, translocoTesting()],
      providers: [
        provideNativeDateAdapter(),
        { provide: BabyService, useValue: babies },
        { provide: SheetRef, useValue: sheetRef },
        { provide: MatDialog, useValue: dialog },
        { provide: CurrentFamilyService, useValue: families },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(BabySheetComponent);
    await fixture.whenStable();
  });

  it('is titled "Add a baby" with the baby form', () => {
    expect(host().querySelector('[data-testid="sheet-title"]')?.textContent?.trim()).toBe(
      en.babies.sheet.addTitle,
    );
    expect(host().querySelector('nala-baby-form')).toBeTruthy();
  });

  it('has no Delete action when adding', () => {
    expect(host().querySelector('[data-testid="delete-baby"]')).toBeNull();
  });

  it('disables Save while required fields are missing', async () => {
    expect(button('sheet-save').disabled).toBe(true);

    await fillValid();
    expect(button('sheet-save').disabled).toBe(false);
  });

  it('disables Save until the current family is known', async () => {
    families.list.set(null);
    await fillValid();

    expect(button('sheet-save').disabled).toBe(true);
  });

  it('adds the baby to the current family and closes with it', async () => {
    await fillValid();
    await click('sheet-save');

    expect(babies.create).toHaveBeenCalledWith('f1', {
      name: 'Lea',
      birthDate: '2026-09-01',
      sex: 'unspecified',
      birthWeightG: null,
      birthLengthCm: null,
      birthHeadCircumferenceCm: null,
    });
    expect(button('sheet-save').disabled).toBe(true);
    created.next({ ok: true, baby: lea });
    await fixture.whenStable();
    expect(sheetRef.close).toHaveBeenCalledWith({ saved: lea });
  });

  it('shows field errors from the API and stays open', async () => {
    await fillValid();
    await click('sheet-save');
    created.next({ ok: false, errors: { birthDate: 'inFuture' } });
    await fixture.whenStable();

    expect(error('birthDate')).toBe(en.babies.errors.birthDate.inFuture);
    expect(sheetRef.close).not.toHaveBeenCalled();
  });

  it('shows a form error from the API', async () => {
    await fillValid();
    await click('sheet-save');
    created.next({ ok: false, errors: { form: 'unknown' } });
    await fixture.whenStable();

    expect(host().querySelector('[data-testid="form-error"]')?.textContent?.trim()).toBe(
      en.auth.errors.form.unknown,
    );
    expect(button('sheet-save').disabled).toBe(false);
  });

  it('closes at once when nothing was entered', async () => {
    await click('sheet-close');

    expect(dialog.open).not.toHaveBeenCalled();
    expect(sheetRef.close).toHaveBeenCalledWith();
  });

  it('asks before discarding what was entered', async () => {
    await type('name', 'Lea');
    await click('sheet-close');

    expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, {
      data: {
        title: en.babies.discard.title,
        text: en.babies.discard.text,
        confirm: en.babies.discard.confirm,
        cancel: en.babies.discard.cancel,
      },
    });
    confirmed.next(false);
    await fixture.whenStable();
    expect(sheetRef.close).not.toHaveBeenCalled();

    await click('sheet-close');
    confirmed.next(true);
    await fixture.whenStable();
    expect(sheetRef.close).toHaveBeenCalledWith();
  });

  it('leaves a tap outside to the sheet service, which discards what was entered without asking', async () => {
    await type('name', 'Lea');

    expect(sheetRef.onDismiss ?? null).toBeNull();
    expect(dialog.open).not.toHaveBeenCalled();
  });
});

describe('BabySheetComponent editing a baby', () => {
  let fixture: ComponentFixture<BabySheetComponent>;
  let updated: Subject<BabyResult>;
  let deleted: Subject<BabyDeleteResult>;
  let babies: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let families: ReturnType<typeof familiesOf>;
  let sheetRef: { close: ReturnType<typeof vi.fn> };
  let confirmed: Subject<boolean | undefined>;
  let dialog: { open: ReturnType<typeof vi.fn> };

  const lea: Baby = {
    id: 'b1',
    familyId: 'f2',
    name: 'Lea',
    birthDate: '2026-09-01',
    sex: 'girl',
    birthWeightG: 3400,
    birthLengthCm: 50.5,
    birthHeadCircumferenceCm: null,
  };

  const host = () => fixture.nativeElement as HTMLElement;
  const button = (testId: string) =>
    host().querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!;
  const input = (field: string) =>
    host().querySelector<HTMLInputElement>(`input[data-testid="${field}"]`)!;
  const type = async (field: string, value: string) => {
    input(field).value = value;
    input(field).dispatchEvent(new Event('input'));
    input(field).dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  };
  const click = async (testId: string) => {
    button(testId).click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    updated = new Subject<BabyResult>();
    deleted = new Subject<BabyDeleteResult>();
    babies = { create: vi.fn(), update: vi.fn(() => updated), delete: vi.fn(() => deleted) };
    // Lea belongs to the Durands, which the user administers; the current family is another one.
    families = familiesOf([
      { id: 'f1', name: 'Martins', isAdmin: false },
      { id: 'f2', name: 'Durands', isAdmin: true },
    ]);
    sheetRef = { close: vi.fn() };
    confirmed = new Subject<boolean | undefined>();
    dialog = { open: vi.fn(() => ({ afterClosed: () => confirmed })) };
    await TestBed.configureTestingModule({
      imports: [BabySheetComponent, translocoTesting()],
      providers: [
        provideNativeDateAdapter(),
        { provide: BabyService, useValue: babies },
        { provide: SheetRef, useValue: sheetRef },
        { provide: SHEET_DATA, useValue: lea },
        { provide: MatDialog, useValue: dialog },
        { provide: CurrentFamilyService, useValue: families },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(BabySheetComponent);
    await fixture.whenStable();
  });

  it('is titled "Edit baby", pre-filled, and can be saved as is', () => {
    expect(host().querySelector('[data-testid="sheet-title"]')?.textContent?.trim()).toBe(
      en.babies.sheet.editTitle,
    );
    const form = fixture.componentInstance.form.getRawValue();
    expect(form.name).toBe('Lea');
    expect(form.birthDate).toEqual(new Date(2026, 8, 1));
    expect(form.sex).toBe('girl');
    expect(form.birthWeightG).toBe(3400);
    expect(form.birthLengthCm).toBe(50.5);
    expect(form.birthHeadCircumferenceCm).toBeNull();
    expect(button('sheet-save').disabled).toBe(false);
  });

  it('saves every field of the baby and closes with the updated baby', async () => {
    await type('name', 'Léa');
    await click('sheet-save');

    expect(babies.create).not.toHaveBeenCalled();
    expect(babies.update).toHaveBeenCalledWith('b1', {
      name: 'Léa',
      birthDate: '2026-09-01',
      sex: 'girl',
      birthWeightG: 3400,
      birthLengthCm: 50.5,
      birthHeadCircumferenceCm: null,
    });
    const saved = { ...lea, name: 'Léa' };
    updated.next({ ok: true, baby: saved });
    await fixture.whenStable();
    expect(sheetRef.close).toHaveBeenCalledWith({ saved });
  });

  it('shows a baby deleted meanwhile as a form error', async () => {
    await click('sheet-save');
    updated.next({ ok: false, errors: { form: 'babyNotFound' } });
    await fixture.whenStable();

    expect(host().querySelector('[data-testid="form-error"]')?.textContent?.trim()).toBe(
      en.auth.errors.form.babyNotFound,
    );
    expect(sheetRef.close).not.toHaveBeenCalled();
  });

  it('closes at once when nothing was changed', async () => {
    await click('sheet-close');

    expect(dialog.open).not.toHaveBeenCalled();
    expect(sheetRef.close).toHaveBeenCalledWith();
  });

  it('asks before discarding changes, with the edit wording', async () => {
    await type('name', 'Léa');
    await click('sheet-close');

    expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, {
      data: {
        title: en.babies.discardEdit.title,
        text: en.babies.discardEdit.text,
        confirm: en.babies.discardEdit.confirm,
        cancel: en.babies.discardEdit.cancel,
      },
    });
  });

  describe('Delete', () => {
    const confirmDelete = async () => {
      await click('delete-baby');
      confirmed.next(true);
      await fixture.whenStable();
    };

    it("is offered to the admin of the baby's family", () => {
      expect(button('delete-baby').textContent?.trim()).toBe(en.babies.delete.action);
    });

    it("is hidden from a member who isn't the family admin, whatever their other families", async () => {
      families.list.set([
        { id: 'f1', name: 'Martins', isAdmin: true },
        { id: 'f2', name: 'Durands', isAdmin: false },
      ]);
      fixture.componentRef.changeDetectorRef.markForCheck();
      await fixture.whenStable();

      expect(host().querySelector('[data-testid="delete-baby"]')).toBeNull();
    });

    it("asks to type the baby's name first, and does nothing when cancelled", async () => {
      await click('delete-baby');

      expect(dialog.open).toHaveBeenCalledWith(TypeToConfirmDialogComponent, {
        data: {
          title: en.babies.delete.title.replace('{{name}}', 'Lea'),
          text: en.babies.delete.text.replace('{{name}}', 'Lea'),
          label: en.babies.delete.label.replace('{{name}}', 'Lea'),
          expected: 'Lea',
          confirm: en.babies.delete.confirm,
          cancel: en.babies.delete.cancel,
        },
      });
      confirmed.next(false);
      await fixture.whenStable();
      expect(babies.delete).not.toHaveBeenCalled();
      expect(sheetRef.close).not.toHaveBeenCalled();
    });

    it('deletes the baby once confirmed and closes with its id', async () => {
      await confirmDelete();

      expect(babies.delete).toHaveBeenCalledWith('b1');
      deleted.next({ ok: true });
      await fixture.whenStable();
      expect(sheetRef.close).toHaveBeenCalledWith({ deleted: 'b1' });
    });

    it('shows a refusal as a form error and stays open', async () => {
      await confirmDelete();
      deleted.next({ ok: false, errors: { form: 'familyAdminOnly' } });
      await fixture.whenStable();

      expect(host().querySelector('[data-testid="form-error"]')?.textContent?.trim()).toBe(
        en.auth.errors.form.familyAdminOnly,
      );
      expect(sheetRef.close).not.toHaveBeenCalled();
    });
  });
});
