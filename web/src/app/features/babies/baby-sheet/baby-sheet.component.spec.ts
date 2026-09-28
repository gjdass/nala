import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { Baby, BabyResult } from '../../../core/babies/baby.models';
import { BabyService } from '../../../core/babies/baby.service';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { SheetRef } from '../../../shared/ui/sheet/sheet-ref';
import { translocoTesting } from '../../../testing/transloco-testing';
import { BabySheetComponent } from './baby-sheet.component';

describe('BabySheetComponent', () => {
  let fixture: ComponentFixture<BabySheetComponent>;
  let created: Subject<BabyResult>;
  let babies: { create: ReturnType<typeof vi.fn> };
  let sheetRef: { close: ReturnType<typeof vi.fn> };
  let confirmed: Subject<boolean | undefined>;
  let dialog: { open: ReturnType<typeof vi.fn> };

  const lea: Baby = {
    id: 'b1',
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

  it('disables Save while required fields are missing', async () => {
    expect(button('sheet-save').disabled).toBe(true);

    await fillValid();
    expect(button('sheet-save').disabled).toBe(false);
  });

  it('adds the baby and closes with it', async () => {
    await fillValid();
    await click('sheet-save');

    expect(babies.create).toHaveBeenCalledWith({
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
    expect(sheetRef.close).toHaveBeenCalledWith(lea);
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
});
