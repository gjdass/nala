import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { EntryDeleteResult, EntryResult } from '../../../core/entries/entry-result';
import { GrowthEntry } from '../../../core/growth-entries/growth-entry.models';
import { GrowthEntryService } from '../../../core/growth-entries/growth-entry.service';
import { EntrySheetData } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';
import { aGrowthEntry } from '../../../testing/growth-entries';
import { translocoTesting } from '../../../testing/transloco-testing';
import { GROWTH_SECTION } from '../growth.section';
import { MeasurementSheetComponent } from './measurement-sheet.component';

const NOW = new Date(2026, 9, 3, 12, 0, 0);
const shortTime = (d: Date) => new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(d);
type Field = 'weight' | 'length' | 'head';

describe('MeasurementSheetComponent', () => {
  let fixture: ComponentFixture<MeasurementSheetComponent>;
  let saved: Subject<EntryResult<GrowthEntry>>;
  let deleted: Subject<EntryDeleteResult>;
  let growthEntries: Record<'create' | 'update' | 'delete', ReturnType<typeof vi.fn>>;
  let sheetRef: { close: ReturnType<typeof vi.fn> };
  let confirmed: Subject<boolean | undefined>;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(testId: string) =>
    host().querySelector<T>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const save = () => find<HTMLButtonElement>('sheet-save')!;
  const settle = () => fixture.whenStable();
  const type = async (testId: Field, value: string) => {
    const input = find<HTMLInputElement>(testId)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await settle();
  };
  const date = () => fixture.componentInstance.form.controls.date;
  const setDate = async (value: Date) => {
    date().setValue(value);
    date().markAsTouched();
    await settle();
  };
  const fieldsSent = () => (growthEntries.create.mock.calls.at(-1) ?? [])[2];

  const render = async (entry: GrowthEntry | null = null) => {
    const data: EntrySheetData<GrowthEntry> = {
      section: 'growth',
      kind: GROWTH_SECTION.kinds[0],
      entry,
    };
    TestBed.overrideProvider(SHEET_DATA, { useValue: data });
    fixture = TestBed.createComponent(MeasurementSheetComponent);
    await settle();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    saved = new Subject();
    deleted = new Subject();
    growthEntries = {
      create: vi.fn(() => saved),
      update: vi.fn(() => saved),
      delete: vi.fn(() => deleted),
    };
    sheetRef = { close: vi.fn() };
    confirmed = new Subject();
    await TestBed.configureTestingModule({
      imports: [MeasurementSheetComponent, translocoTesting()],
      providers: [
        provideNativeDateAdapter(),
        { provide: GrowthEntryService, useValue: growthEntries },
        {
          provide: SelectedBabyService,
          useValue: { selected: signal({ id: 'b1', birthDate: '2026-09-01' }) },
        },
        { provide: SheetRef, useValue: sheetRef },
        { provide: SHEET_DATA, useValue: null },
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => confirmed })) } },
      ],
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  describe('adding', () => {
    beforeEach(() => render());

    it('is titled Measurement with the date, one row of weight / length / head, and notes', () => {
      expect(text('sheet-title')).toBe(en.growth.kinds.measurement);
      const rows = host().textContent!;
      expect(rows).toContain(en.entrySheet.date);
      expect(rows).toContain(en.entrySheet.notes);
      expect(host().querySelector('nala-time-row')).toBeTruthy();
      expect(host().querySelectorAll('nala-number-fields-row')).toHaveLength(1);
      const fields = [...host().querySelectorAll('nala-number-fields-row mat-form-field')];
      expect(fields.map((f) => f.querySelector('mat-label')?.textContent?.trim())).toEqual([
        en.growth.sheet.weight,
        en.growth.sheet.length,
        en.growth.sheet.head,
      ]);
      expect(fields.map((f) => f.querySelector('[matTextSuffix]')?.textContent?.trim())).toEqual([
        'kg',
        'cm',
        'cm',
      ]);
      (['weight', 'length', 'head'] as const).forEach((field) =>
        expect(find<HTMLInputElement>(field)!.getAttribute('inputmode')).toBe('decimal'),
      );
    });

    it('opens on today, without a time, every value empty', () => {
      expect(date().value).toEqual(new Date(2026, 9, 3));
      const row = host().querySelector('nala-time-row')!.textContent!;
      expect(row).toContain('Today');
      expect(row).not.toContain(shortTime(NOW));
      (['weight', 'length', 'head'] as const).forEach((field) =>
        expect(find<HTMLInputElement>(field)!.value).toBe(''),
      );
    });

    it('keeps Save disabled until a value is filled', async () => {
      expect(save().disabled).toBe(true);

      await type('head', '38');
      expect(save().disabled).toBe(false);
    });

    it('asks for a value once the last one is cleared', async () => {
      await type('weight', '4.2');
      await type('weight', '');

      expect(save().disabled).toBe(true);
      expect(text('measurements-error')).toBe(en.growth.errors.measurementRequired);
    });

    it('saves the weight typed in kg as grams, with the date as yyyy-MM-dd', async () => {
      await type('weight', '4.25');
      save().click();
      await settle();

      expect(growthEntries.create).toHaveBeenCalledWith(
        'b1',
        'measurement',
        expect.anything(),
        expect.any(String),
      );
      expect(fieldsSent()).toEqual({
        date: '2026-10-03',
        weightG: 4250,
        lengthCm: null,
        headCircumferenceCm: null,
        notes: null,
      });
    });

    it('saves every value', async () => {
      await type('weight', '4.123');
      await type('length', '55.5');
      await type('head', '38');
      save().click();
      await settle();

      expect(fieldsSent()).toMatchObject({
        weightG: 4123,
        lengthCm: 55.5,
        headCircumferenceCm: 38,
      });
    });

    const outOfRange: [Field, string, string][] = [
      ['weight', '0.299', en.growth.errors.weight],
      ['weight', '30.001', en.growth.errors.weight],
      ['length', '19.9', en.growth.errors.length],
      ['length', '130.1', en.growth.errors.length],
      ['head', '14.9', en.growth.errors.head],
      ['head', '60.1', en.growth.errors.head],
    ];
    outOfRange.forEach(([field, value, error]) =>
      it(`refuses a ${field} of ${value}`, async () => {
        await type(field, value);

        expect(save().disabled).toBe(true);
        expect(find(field)!.closest('mat-form-field')!.textContent).toContain(error);
      }),
    );

    const tooPrecise: [Field, string][] = [
      ['weight', '4.2501'],
      ['length', '55.55'],
      ['head', '38.05'],
    ];
    tooPrecise.forEach(([field, value]) =>
      it(`refuses a ${field} of ${value} (too many decimals)`, async () => {
        await type(field, value);

        expect(save().disabled).toBe(true);
      }),
    );

    it('accepts the bounds of each value', async () => {
      await type('weight', '0.3');
      await type('length', '130');
      await type('head', '15');
      expect(save().disabled).toBe(false);

      await type('weight', '30');
      await type('length', '20');
      await type('head', '60');
      expect(save().disabled).toBe(false);
    });

    it('refuses a date after today', async () => {
      await type('weight', '4.2');

      await setDate(new Date(2026, 9, 4));
      expect(save().disabled).toBe(true);

      await setDate(new Date(2026, 9, 3));
      expect(save().disabled).toBe(false);
    });

    it("refuses a date before the baby's birth date", async () => {
      await type('weight', '4.2');

      await setDate(new Date(2026, 7, 31));
      expect(save().disabled).toBe(true);
      expect(host().querySelector('nala-time-row')!.textContent).toContain(
        en.entrySheet.beforeBirth,
      );

      await setDate(new Date(2026, 8, 1));
      expect(save().disabled).toBe(false);
    });

    it('closes with the saved entry', async () => {
      await type('weight', '4.2');
      save().click();
      const entry = aGrowthEntry();
      saved.next({ ok: true, entry });
      await settle();

      expect(sheetRef.close).toHaveBeenCalledWith({ saved: entry });
    });

    it('keeps the same client id when Save is tried again', async () => {
      await type('weight', '4.2');
      save().click();
      saved.next({ ok: false, errors: { form: 'unknown' } });
      await settle();
      save().click();
      await settle();

      const ids = growthEntries.create.mock.calls.map((call) => call[3]);
      expect(ids).toHaveLength(2);
      expect(ids[0]).toBe(ids[1]);
    });

    it('shows the errors sent back by the server on their fields', async () => {
      await type('weight', '4.2');
      save().click();
      saved.next({ ok: false, errors: { date: 'beforeBirth', weightG: 'outOfRange' } });
      await settle();

      expect(host().querySelector('nala-time-row')!.textContent).toContain(
        en.entrySheet.beforeBirth,
      );
      expect(find('weight')!.closest('mat-form-field')!.textContent).toContain(
        en.growth.errors.weight,
      );
      expect(find('form-error')).toBeNull();
    });

    it('shows a form error when saving fails', async () => {
      await type('weight', '4.2');
      save().click();
      saved.next({ ok: false, errors: { form: 'babyNotFound' } });
      await settle();

      expect(text('form-error')).toBe(en.growth.errors.babyNotFound);
      expect(sheetRef.close).not.toHaveBeenCalled();
    });

    it('closes once the entry is kept on the device (offline)', async () => {
      await type('weight', '4.2');
      save().click();
      saved.next({ ok: true, queued: true });
      await settle();

      expect(sheetRef.close).toHaveBeenCalledWith({ queued: true });
    });

    it('shows neither Delete nor who logged it', () => {
      expect(find('entry-delete')).toBeNull();
      expect(host().querySelector('nala-entry-audit')).toBeNull();
    });
  });

  describe('editing', () => {
    const entry = aGrowthEntry({
      id: 'g7',
      date: '2026-09-28',
      weightG: 4250,
      lengthCm: 55.5,
      headCircumferenceCm: null,
      notes: 'doctor',
    });

    it('opens with its values, the weight in kg', async () => {
      await render(entry);

      expect(date().value).toEqual(new Date(2026, 8, 28));
      expect(find<HTMLInputElement>('weight')!.value).toBe('4.25');
      expect(find<HTMLInputElement>('length')!.value).toBe('55.5');
      expect(find<HTMLInputElement>('head')!.value).toBe('');
      expect(find<HTMLTextAreaElement>('notes-input')!.value).toBe('doctor');
    });

    it('replaces its values on Save and closes with the entry', async () => {
      await render(entry);
      await type('weight', '4.4');
      await type('length', '');
      await type('head', '38.5');
      save().click();
      await settle();

      expect(growthEntries.update).toHaveBeenCalledWith('g7', {
        date: '2026-09-28',
        weightG: 4400,
        lengthCm: null,
        headCircumferenceCm: 38.5,
        notes: 'doctor',
      });
      const updated = aGrowthEntry({ ...entry, weightG: 4400 });
      saved.next({ ok: true, entry: updated });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ saved: updated });
    });

    it('discards the form edits on ×', async () => {
      await render(entry);
      await type('weight', '5');

      find<HTMLButtonElement>('sheet-close')!.click();
      confirmed.next(true);
      await settle();

      expect(growthEntries.update).not.toHaveBeenCalled();
      expect(sheetRef.close).toHaveBeenCalledWith();
    });

    it('shows a form error when the entry no longer exists', async () => {
      await render(entry);
      save().click();
      saved.next({ ok: false, errors: { form: 'growthEntryNotFound' } });
      await settle();

      expect(text('form-error')).toBe(en.growth.errors.growthEntryNotFound);
    });

    it('says who logged it and who edited it last, and when', async () => {
      const updatedAt = new Date(2026, 9, 3, 11, 40).toISOString();
      await render(
        aGrowthEntry({ ...entry, updatedBy: { id: 'u2', displayName: 'Ben' }, updatedAt }),
      );

      expect(
        host().querySelector('nala-entry-audit')?.textContent?.replace(/\s+/g, ' ').trim(),
      ).toBe(`Logged by Anna · Edited by Ben, ${shortTime(new Date(updatedAt))}`);
    });

    it('deletes it after confirmation and closes with its id', async () => {
      await render(entry);

      find<HTMLButtonElement>('entry-delete')!.click();
      expect(growthEntries.delete).not.toHaveBeenCalled();
      confirmed.next(true);
      await settle();
      expect(growthEntries.delete).toHaveBeenCalledWith('g7');

      deleted.next({ ok: true });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ deleted: 'g7' });
    });

    it('closes once the delete is kept on the device (offline)', async () => {
      await render(entry);

      find<HTMLButtonElement>('entry-delete')!.click();
      confirmed.next(true);
      deleted.next({ ok: true, queued: true });
      await settle();

      expect(sheetRef.close).toHaveBeenCalledWith({ queued: true });
    });

    it('keeps the sheet open when deleting fails', async () => {
      await render(entry);

      find<HTMLButtonElement>('entry-delete')!.click();
      confirmed.next(true);
      deleted.next({ ok: false, errors: { form: 'unknown' } });
      await settle();

      expect(sheetRef.close).not.toHaveBeenCalled();
      expect(text('form-error')).toBe(en.growth.errors.unknown);
    });
  });
});
