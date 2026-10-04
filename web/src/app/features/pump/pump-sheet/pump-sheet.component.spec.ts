import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { EntryDeleteResult, EntryResult } from '../../../core/entries/entry-result';
import { Pump } from '../../../core/pumps/pump.models';
import { PumpService } from '../../../core/pumps/pump.service';
import { EntrySheetData } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';
import { aPump } from '../../../testing/pumps';
import { translocoTesting } from '../../../testing/transloco-testing';
import { PUMP_SECTION } from '../pump.section';
import { PumpSheetComponent } from './pump-sheet.component';

const NOW = new Date(2026, 9, 3, 12, 0, 0);
const at = (h: number, m = 0) => new Date(2026, 9, 3, h, m);
const shortTime = (d: Date) => new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(d);

describe('PumpSheetComponent', () => {
  let fixture: ComponentFixture<PumpSheetComponent>;
  let saved: Subject<EntryResult<Pump>>;
  let deleted: Subject<EntryDeleteResult>;
  let pumps: Record<'create' | 'update' | 'delete', ReturnType<typeof vi.fn>>;
  let sheetRef: { close: ReturnType<typeof vi.fn> };
  let confirmed: Subject<boolean | undefined>;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(testId: string) =>
    host().querySelector<T>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const save = () => find<HTMLButtonElement>('sheet-save')!;
  const settle = () => fixture.whenStable();
  const form = () => fixture.componentInstance.form;
  const rows = () => [...host().querySelectorAll('nala-time-row')];
  const alerts = () =>
    [...host().querySelectorAll('[role="alert"]')].map((e) => e.textContent?.trim());
  const setTimes = async (start: Date, end: Date | null) => {
    form().controls.startTime.setValue(start);
    form().controls.endTime.setValue(end);
    form().controls.startTime.markAsTouched();
    form().controls.endTime.markAsTouched();
    form().markAsDirty();
    await settle();
  };

  const fieldErrors = () =>
    [...host().querySelectorAll('mat-error')].map((e) => e.textContent?.trim());
  const ml = (side: 'left' | 'right') => find<HTMLInputElement>(`pump-${side}`)!;
  const typeMl = async (side: 'left' | 'right', value: string) => {
    ml(side).value = value;
    ml(side).dispatchEvent(new Event('input'));
    ml(side).dispatchEvent(new Event('blur'));
    await settle();
  };

  const render = async (entry: Pump | null = null) => {
    const data: EntrySheetData<Pump> = { section: 'pump', kind: PUMP_SECTION.kinds[0], entry };
    TestBed.overrideProvider(SHEET_DATA, { useValue: data });
    fixture = TestBed.createComponent(PumpSheetComponent);
    await settle();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    saved = new Subject();
    deleted = new Subject();
    pumps = {
      create: vi.fn(() => saved),
      update: vi.fn(() => saved),
      delete: vi.fn(() => deleted),
    };
    sheetRef = { close: vi.fn() };
    confirmed = new Subject();
    await TestBed.configureTestingModule({
      imports: [PumpSheetComponent, translocoTesting()],
      providers: [
        provideNativeDateAdapter(),
        { provide: PumpService, useValue: pumps },
        { provide: SelectedBabyService, useValue: { selected: signal({ id: 'b1' }) } },
        { provide: SheetRef, useValue: sheetRef },
        { provide: SHEET_DATA, useValue: null },
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => confirmed })) } },
      ],
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  describe('adding', () => {
    beforeEach(() => render());

    it('is titled Pump with the start time, end time, duration, left and right ml, and notes rows', () => {
      expect(text('sheet-title')).toBe(en.pump.kinds.pump);
      const body = host().textContent!;
      expect(body).toContain(en.entrySheet.startTime);
      expect(body).toContain(en.pump.sheet.endTime);
      expect(body).toContain(en.pump.sheet.duration);
      expect(body).toContain(en.pump.sheet.left);
      expect(body).toContain(en.pump.sheet.right);
      expect(body).toContain(en.entrySheet.notes);
      expect(ml('left').value).toBe('');
      expect(ml('right').value).toBe('');
    });

    it('shows the total only once a side has a volume, an empty side counting as 0', async () => {
      expect(find('pump-total')).toBeNull();

      await typeMl('left', '90');
      expect(text('pump-total')).toBe('90 ml');
      expect(host().textContent).toContain(en.pump.sheet.total);

      await typeMl('right', '85');
      expect(text('pump-total')).toBe('175 ml');

      await typeMl('left', '');
      await typeMl('right', '');
      expect(find('pump-total')).toBeNull();
    });

    it('accepts 0 to 500 ml per side', async () => {
      await setTimes(at(9), at(9, 20));
      await typeMl('left', '0');
      await typeMl('right', '500');

      expect(save().disabled).toBe(false);
    });

    it('refuses a volume outside 0 to 500 ml or not a whole number', async () => {
      await setTimes(at(9), at(9, 20));

      for (const value of ['-1', '501', '90.5']) {
        await typeMl('left', value);
        expect(save().disabled).toBe(true);
        expect(fieldErrors()).toContain(en.pump.sheet.volumeRange);
      }

      await typeMl('left', '90');
      expect(save().disabled).toBe(false);
    });

    it('sends each typed volume, an empty side as none', async () => {
      await setTimes(at(9), at(9, 20));
      await typeMl('right', '120');
      save().click();
      await settle();

      expect(pumps.create).toHaveBeenCalledWith(
        'b1',
        expect.objectContaining({ leftMl: null, rightMl: 120 }),
        expect.any(String),
      );
    });

    it('starts now and has no end yet, which it offers to add', () => {
      expect(form().controls.startTime.value).toEqual(NOW);
      expect(form().controls.endTime.value).toBeNull();
      expect(rows()[0].textContent).toContain(`Today ${shortTime(NOW)}`);
      expect(rows()[1].textContent).toContain(en.entrySheet.add);
      expect(text('pump-duration')).toBe('');
    });

    it('keeps Save disabled until there is an end', async () => {
      expect(save().disabled).toBe(true);

      await setTimes(at(9), at(10, 30));

      expect(save().disabled).toBe(false);
    });

    it('shows the duration from the start to the end', async () => {
      await setTimes(at(9), at(10, 30));

      expect(text('pump-duration')).toBe('1h 30m');
    });

    it('refuses an end before the start, or at the same time', async () => {
      await setTimes(at(10), at(9, 30));
      expect(save().disabled).toBe(true);
      expect(alerts()).toContain(en.entrySheet.beforeStart);

      await setTimes(at(10), at(10));
      expect(save().disabled).toBe(true);
    });

    it('checks the end again when the start moves past it', async () => {
      await setTimes(at(9), at(10));
      expect(save().disabled).toBe(false);

      form().controls.startTime.setValue(at(10, 15));
      await settle();

      expect(save().disabled).toBe(true);
      expect(alerts()).toContain(en.entrySheet.beforeStart);
    });

    it('refuses an end in the future', async () => {
      await setTimes(at(11), at(12, 5));

      expect(save().disabled).toBe(true);
      expect(alerts()).toContain(en.entrySheet.inFuture);
    });

    it('adds the session for the selected baby and closes with it', async () => {
      await setTimes(at(9), at(10, 30));
      save().click();
      await settle();

      expect(pumps.create).toHaveBeenCalledWith(
        'b1',
        {
          startTime: at(9).toISOString(),
          endTime: at(10, 30).toISOString(),
          leftMl: null,
          rightMl: null,
          notes: null,
        },
        expect.stringMatching(/^[0-9a-f-]{36}$/),
      );
      expect(save().disabled).toBe(true);

      const pump = aPump();
      saved.next({ ok: true, entry: pump });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ saved: pump });
    });

    it('keeps the same client id when Save is tried again', async () => {
      await setTimes(at(9), at(10, 30));
      save().click();
      saved.next({ ok: false, errors: { form: 'unknown' } });
      await settle();
      save().click();
      await settle();

      const ids = pumps.create.mock.calls.map((call) => call[2]);
      expect(ids).toHaveLength(2);
      expect(ids[0]).toBe(ids[1]);
    });

    it('shows the errors the server sends back', async () => {
      await setTimes(at(9), at(10, 30));
      save().click();
      saved.next({ ok: false, errors: { endTime: 'beforeStart' } });
      await settle();

      expect(alerts()).toContain(en.entrySheet.beforeStart);
      expect(sheetRef.close).not.toHaveBeenCalled();
    });

    it('shows a form error when saving fails', async () => {
      await setTimes(at(9), at(10, 30));
      save().click();
      saved.next({ ok: false, errors: { form: 'babyNotFound' } });
      await settle();

      expect(text('form-error')).toBe(en.pump.errors.babyNotFound);
    });

    it('closes once the session is kept on the device (offline)', async () => {
      await setTimes(at(9), at(10, 30));
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
    const pump = aPump({
      id: 'p7',
      startTime: at(8).toISOString(),
      endTime: at(9, 45).toISOString(),
      leftMl: 90,
      rightMl: 0,
      notes: 'evening',
    });

    it('is pre-filled with the session', async () => {
      await render(pump);

      expect(form().controls.startTime.value).toEqual(at(8));
      expect(form().controls.endTime.value).toEqual(at(9, 45));
      expect(ml('left').value).toBe('90');
      expect(ml('right').value).toBe('0');
      expect(text('pump-total')).toBe('90 ml');
      expect(find<HTMLTextAreaElement>('notes-input')!.value).toBe('evening');
      expect(text('pump-duration')).toBe('1h 45m');
      expect(save().disabled).toBe(false);
    });

    it('saves the changes and closes with the session', async () => {
      await render(pump);
      await setTimes(at(8), at(10));
      save().click();
      await settle();

      expect(pumps.update).toHaveBeenCalledWith('p7', {
        startTime: at(8).toISOString(),
        endTime: at(10).toISOString(),
        leftMl: 90,
        rightMl: 0,
        notes: 'evening',
      });
      const updated = aPump({ ...pump, endTime: at(10).toISOString() });
      saved.next({ ok: true, entry: updated });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ saved: updated });
    });

    it('says who logged it and who edited it last', async () => {
      const updatedAt = at(11, 40).toISOString();
      await render(aPump({ ...pump, updatedBy: { id: 'u2', displayName: 'Ben' }, updatedAt }));

      expect(
        host().querySelector('nala-entry-audit')?.textContent?.replace(/\s+/g, ' ').trim(),
      ).toBe(`Logged by Anna · Edited by Ben, ${shortTime(at(11, 40))}`);
    });

    it('shows that it no longer exists', async () => {
      await render(pump);
      await setTimes(at(8), at(10));
      save().click();
      saved.next({ ok: false, errors: { form: 'pumpNotFound' } });
      await settle();

      expect(text('form-error')).toBe(en.pump.errors.pumpNotFound);
    });

    it('deletes it after confirmation and closes with its id', async () => {
      await render(pump);

      find<HTMLButtonElement>('entry-delete')!.click();
      confirmed.next(true);
      await settle();
      expect(pumps.delete).toHaveBeenCalledWith('p7');

      deleted.next({ ok: true });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ deleted: 'p7' });
    });

    it('closes once the delete is kept on the device (offline)', async () => {
      await render(pump);

      find<HTMLButtonElement>('entry-delete')!.click();
      confirmed.next(true);
      deleted.next({ ok: true, queued: true });
      await settle();

      expect(sheetRef.close).toHaveBeenCalledWith({ queued: true });
    });

    it('keeps the sheet open when deleting fails', async () => {
      await render(pump);

      find<HTMLButtonElement>('entry-delete')!.click();
      confirmed.next(true);
      deleted.next({ ok: false, errors: { form: 'unknown' } });
      await settle();

      expect(sheetRef.close).not.toHaveBeenCalled();
      expect(text('form-error')).toBe(en.pump.errors.unknown);
    });
  });
});
