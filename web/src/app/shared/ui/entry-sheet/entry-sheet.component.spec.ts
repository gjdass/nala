import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { fakeKind } from '../../../testing/fake-section';
import { translocoTesting } from '../../../testing/transloco-testing';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { FormRowComponent } from '../form-row/form-row.component';
import { NotesRowComponent, notesControl } from '../notes-row/notes-row.component';
import { SHEET_DATA, SheetRef } from '../sheet/sheet-ref';
import { EntrySheetComponent } from './entry-sheet.component';
import { EntrySheetData } from './entry-sheet.models';

/** A kind's sheet as a feature would write it: a required amount and the notes. */
@Component({
  imports: [
    EntrySheetComponent,
    FormRowComponent,
    MatInputModule,
    NotesRowComponent,
    ReactiveFormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-entry-sheet
    [form]="form"
    [saving]="saving()"
    (save)="saves = saves + 1"
    (delete)="deletes = deletes + 1"
  >
    <nala-form-row label="Amount">
      <mat-form-field rowEditor>
        <input matInput [formControl]="form.controls.amount" data-testid="amount" />
        <mat-error data-testid="amount-error">Required</mat-error>
      </mat-form-field>
    </nala-form-row>
    <nala-notes-row [control]="form.controls.notes" />
  </nala-entry-sheet>`,
})
class FakeKindSheet {
  readonly form = new FormGroup({
    amount: new FormControl('', { nonNullable: true, validators: Validators.required }),
    notes: notesControl(),
  });
  readonly saving = signal(false);
  saves = 0;
  deletes = 0;
}

describe('EntrySheetComponent', () => {
  let fixture: ComponentFixture<FakeKindSheet>;
  let sheetRef: { close: ReturnType<typeof vi.fn> };
  let confirmed: Subject<boolean | undefined>;
  let dialog: { open: ReturnType<typeof vi.fn> };

  const bottle = fakeKind('bottle', 'water_full', 'sections.feed');

  const host = () => fixture.nativeElement as HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(testId: string) =>
    host().querySelector<T>(`[data-testid="${testId}"]`);
  const button = (testId: string) => find<HTMLButtonElement>(testId)!;
  const click = async (testId: string) => {
    button(testId).click();
    await fixture.whenStable();
  };
  const typeAmount = async (value: string) => {
    const input = find<HTMLInputElement>('amount')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  };

  const render = async (entry: unknown = null) => {
    const data: EntrySheetData = { section: 'feed', kind: bottle, entry };
    TestBed.overrideProvider(SHEET_DATA, { useValue: data });
    fixture = TestBed.createComponent(FakeKindSheet);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    sheetRef = { close: vi.fn() };
    // Like MatDialog, each dialog's afterClosed() is its own: the latest one is `confirmed`.
    dialog = {
      open: vi.fn(() => {
        confirmed = new Subject();
        return { afterClosed: () => confirmed };
      }),
    };
    await TestBed.configureTestingModule({
      imports: [FakeKindSheet, translocoTesting()],
      providers: [
        { provide: SHEET_DATA, useValue: null },
        { provide: SheetRef, useValue: sheetRef },
        { provide: MatDialog, useValue: dialog },
      ],
    }).compileComponents();
  });

  describe('header', () => {
    beforeEach(() => render());

    it('uses the section colour tokens', () => {
      const style = host().querySelector('mat-toolbar')?.getAttribute('style') ?? '';
      expect(style).toContain('var(--nala-section-feed)');
      expect(style).toContain('var(--nala-on-section-feed)');
    });

    it('has ×, the kind title and Save', () => {
      expect(button('sheet-close').getAttribute('aria-label')).toBe(en.sheet.close);
      expect(find('sheet-title')?.textContent?.trim()).toBe(en.sections.feed);
      expect(button('sheet-save').textContent?.trim()).toBe(en.sheet.save);
    });
  });

  describe('save', () => {
    beforeEach(() => render());

    it('is disabled while a required field is missing, and enabled once valid', async () => {
      expect(button('sheet-save').disabled).toBe(true);

      await typeAmount('90');

      expect(button('sheet-save').disabled).toBe(false);
    });

    it('emits save when tapped', async () => {
      await typeAmount('90');
      await click('sheet-save');

      expect(fixture.componentInstance.saves).toBe(1);
    });

    it('is disabled while saving', async () => {
      await typeAmount('90');
      fixture.componentInstance.saving.set(true);
      await fixture.whenStable();

      expect(button('sheet-save').disabled).toBe(true);
    });

    it('is disabled while notes are too long', async () => {
      await typeAmount('90');
      fixture.componentInstance.form.controls.notes.setValue('x'.repeat(1001));
      await fixture.whenStable();

      expect(button('sheet-save').disabled).toBe(true);
    });

    it('shows the field error once the field was touched', async () => {
      expect(find('amount-error')).toBeNull();

      await typeAmount('');

      expect(find('amount-error')?.textContent?.trim()).toBe('Required');
    });
  });

  describe('close', () => {
    beforeEach(() => render());

    it('closes without a result when nothing changed', async () => {
      await click('sheet-close');

      expect(dialog.open).not.toHaveBeenCalled();
      expect(sheetRef.close).toHaveBeenCalledWith();
    });

    it('asks before discarding changes, and stays open when cancelled', async () => {
      await typeAmount('90');
      await click('sheet-close');

      expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, {
        data: {
          title: en.entrySheet.discard.title,
          text: en.entrySheet.discard.text,
          confirm: en.entrySheet.discard.confirm,
          cancel: en.entrySheet.discard.cancel,
        },
      });
      confirmed.next(false);
      expect(sheetRef.close).not.toHaveBeenCalled();
    });

    it('closes without saving once discarding is confirmed', async () => {
      await typeAmount('90');
      await click('sheet-close');
      confirmed.next(true);

      expect(sheetRef.close).toHaveBeenCalledWith();
      expect(fixture.componentInstance.saves).toBe(0);
    });
  });

  describe('delete', () => {
    it('is not offered when adding', async () => {
      await render(null);

      expect(find('entry-delete')).toBeNull();
    });

    it('is offered when editing, asks first and emits delete only once confirmed', async () => {
      await render({ id: 'f1' });
      expect(button('entry-delete').textContent?.trim()).toBe(en.entrySheet.delete.action);

      await click('entry-delete');
      expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, {
        data: {
          title: en.entrySheet.delete.title,
          text: en.entrySheet.delete.text,
          confirm: en.entrySheet.delete.confirm,
          cancel: en.entrySheet.delete.cancel,
        },
      });
      confirmed.next(false);
      expect(fixture.componentInstance.deletes).toBe(0);

      await click('entry-delete');
      confirmed.next(true);
      expect(fixture.componentInstance.deletes).toBe(1);
    });

    it('is disabled while saving', async () => {
      await render({ id: 'f1' });
      fixture.componentInstance.saving.set(true);
      await fixture.whenStable();

      expect(button('entry-delete').disabled).toBe(true);
    });
  });

  it('only uses Material controls with 48 dp touch targets', async () => {
    await render({ id: 'f1' });

    expect(button('sheet-close').hasAttribute('mat-icon-button')).toBe(true);
    expect(button('sheet-save').hasAttribute('mat-button')).toBe(true);
    expect(button('entry-delete').hasAttribute('mat-stroked-button')).toBe(true);
    const buttons = [...host().querySelectorAll('button')];
    expect(
      buttons.every((b) =>
        ['mat-icon-button', 'mat-button', 'mat-stroked-button', 'mat-list-item'].some((a) =>
          b.hasAttribute(a),
        ),
      ),
    ).toBe(true);
    expect(host().querySelector('[class*="density"]')).toBeNull();
  });
});
