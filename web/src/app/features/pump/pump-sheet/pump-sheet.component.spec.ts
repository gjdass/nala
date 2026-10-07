import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { EntryDeleteResult, EntryResult } from '../../../core/entries/entry-result';
import { Pump } from '../../../core/pumps/pump.models';
import { PumpService } from '../../../core/pumps/pump.service';
import { PumpSyncService } from '../../../core/pumps/pump-sync.service';
import { NowService } from '../../../core/time/now.service';
import { DurationDialogComponent } from '../../../shared/ui/duration-dialog/duration-dialog.component';
import { EntrySheetData } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';
import { fakePumpSync } from '../../../testing/pump-sync';
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
  let tapped: Subject<EntryResult<Pump>>;
  let now: ReturnType<typeof signal<number>>;
  let pumps: Record<
    'create' | 'update' | 'delete' | 'start' | 'stop' | 'get',
    ReturnType<typeof vi.fn>
  >;
  let sheetRef: { close: ReturnType<typeof vi.fn> };
  let confirmed: Subject<boolean | undefined>;
  let typed: Subject<number | undefined>;
  let sync: ReturnType<typeof fakePumpSync>;
  let snackBar: { open: ReturnType<typeof vi.fn> };

  const host = () => fixture.nativeElement as HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(testId: string) =>
    host().querySelector<T>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const save = () => find<HTMLButtonElement>('sheet-save')!;
  const toggle = () => find<HTMLButtonElement>('timer-toggle')!;
  const click = async (testId: string) => {
    find<HTMLButtonElement>(testId)!.click();
    await settle();
  };
  const respondTimer = async (result: EntryResult<Pump>) => {
    tapped.next(result);
    await settle();
  };
  /** A live session of b1 started `minutes` before NOW, without volumes. */
  const livePump = (minutes: number, overrides: Partial<Pump> = {}) =>
    aPump({
      startTime: new Date(NOW.getTime() - minutes * 60_000).toISOString(),
      endTime: null,
      leftMl: null,
      rightMl: null,
      ...overrides,
    });
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
    tapped = new Subject();
    now = signal(NOW.getTime());
    pumps = {
      create: vi.fn(() => saved),
      update: vi.fn(() => saved),
      delete: vi.fn(() => deleted),
      start: vi.fn(() => tapped),
      stop: vi.fn(() => tapped),
      get: vi.fn(() => of(null)),
    };
    sync = fakePumpSync();
    snackBar = { open: vi.fn() };
    sheetRef = { close: vi.fn() };
    confirmed = new Subject();
    typed = new Subject();
    await TestBed.configureTestingModule({
      imports: [PumpSheetComponent, translocoTesting()],
      providers: [
        provideNativeDateAdapter(),
        { provide: PumpService, useValue: pumps },
        { provide: SelectedBabyService, useValue: { selected: signal({ id: 'b1' }) } },
        { provide: SheetRef, useValue: sheetRef },
        { provide: SHEET_DATA, useValue: null },
        { provide: NowService, useValue: { now } },
        { provide: PumpSyncService, useValue: sync },
        { provide: MatSnackBar, useValue: snackBar },
        {
          provide: MatDialog,
          useValue: {
            open: vi.fn((component: unknown) => ({
              afterClosed: () => (component === DurationDialogComponent ? typed : confirmed),
            })),
          },
        },
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

    it('accepts times in the future', async () => {
      await setTimes(at(13), at(14, 5));

      expect(save().disabled).toBe(false);
      expect(alerts()).toEqual([]);
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

  describe('timer', () => {
    describe('adding', () => {
      beforeEach(() => render());

      it('shows the timer at 0 with Start', () => {
        expect(text('timer-duration')).toBe('0s');
        expect(toggle().textContent?.trim()).toBe(en.timer.start);
        expect(toggle().disabled).toBe(false);
      });

      it('looks for a live session of the baby through the shared live poll', () => {
        expect(sync.refreshes()).toBe(1);
      });

      it('creates the live session for the selected baby on Start, now', async () => {
        await click('timer-toggle');

        expect(pumps.start).toHaveBeenCalledWith(
          expect.stringMatching(/^[0-9a-f-]{36}$/),
          'b1',
          NOW.toISOString(),
        );
        const id = pumps.start.mock.calls[0][0];
        await respondTimer({ ok: true, entry: livePump(0, { id }) });

        expect(toggle().textContent?.trim()).toBe(en.timer.stop);
        expect(form().controls.startTime.value).toEqual(NOW);
        expect(text('pump-end-time')).toContain(en.pump.sheet.pumping);
        expect(rows()).toHaveLength(1);
        expect(find('entry-delete')).not.toBeNull();
      });

      it('ticks from the stored start time while live, and saves volumes keeping it live', async () => {
        await click('timer-toggle');
        const id = pumps.start.mock.calls[0][0];
        await respondTimer({ ok: true, entry: livePump(15, { id }) });

        expect(text('timer-duration')).toBe('15m');
        expect(text('pump-duration')).toBe('15m');
        now.set(NOW.getTime() + 10_000);
        await settle();
        expect(text('timer-duration')).toBe('15m 10s');

        await typeMl('left', '60');
        await typeMl('right', '0');
        expect(text('pump-total')).toBe('60 ml');
        expect(save().disabled).toBe(false);
        save().click();
        await settle();
        expect(pumps.update).toHaveBeenCalledWith(id, {
          startTime: new Date(NOW.getTime() - 15 * 60_000).toISOString(),
          endTime: null,
          leftMl: 60,
          rightMl: 0,
          notes: null,
        });
        expect(pumps.stop).not.toHaveBeenCalled();
      });

      it('opens the live session when Start is refused because one is live', async () => {
        await click('timer-toggle');
        await respondTimer({ ok: false, errors: { form: 'pumpInProgress' } });

        expect(sync.refreshes()).toBe(2);
        sync.inProgress.set([
          livePump(30, { id: 'other', babyId: 'b2' }),
          livePump(20, { id: 'p9' }),
        ]);
        sync.refreshed.next();
        await settle();

        expect(toggle().textContent?.trim()).toBe(en.timer.stop);
        expect(text('timer-duration')).toBe('20m');
      });

      it('keeps the same id when Start is tried again after a failure', async () => {
        await click('timer-toggle');
        await respondTimer({ ok: false, errors: { form: 'unknown' } });
        expect(text('form-error')).toBe(en.pump.errors.unknown);

        await click('timer-toggle');
        const ids = pumps.start.mock.calls.map((call) => call[0]);
        expect(ids[0]).toBe(ids[1]);
      });

      it('keeps Start on once an end time is typed', async () => {
        form().controls.endTime.setValue(at(11));
        form().controls.endTime.markAsDirty();
        await settle();

        expect(toggle().disabled).toBe(false);
      });

      describe('× once Start created the session', () => {
        let id: string;

        beforeEach(async () => {
          await click('timer-toggle');
          id = pumps.start.mock.calls[0][0];
          await respondTimer({ ok: true, entry: livePump(0, { id }) });
          await click('sheet-close');
        });

        it('asks first, then deletes it and closes with its id', async () => {
          expect(pumps.delete).not.toHaveBeenCalled();

          confirmed.next(true);
          await settle();
          expect(pumps.delete).toHaveBeenCalledWith(id);

          deleted.next({ ok: true });
          await settle();
          expect(sheetRef.close).toHaveBeenCalledWith({ deleted: id });
        });

        it('stays open, the session live, when cancelled', async () => {
          confirmed.next(false);
          await settle();

          expect(pumps.delete).not.toHaveBeenCalled();
          expect(sheetRef.close).not.toHaveBeenCalled();
        });
      });
    });

    describe('opened to add while the baby has a live session', () => {
      beforeEach(async () => {
        await render();
        sync.inProgress.set([
          livePump(90, { id: 'tom', babyId: 'b2' }),
          livePump(30, { id: 'p8', leftMl: 40, notes: 'evening' }),
          livePump(10, { id: 'p9' }),
        ]);
        sync.refreshed.next();
        await settle();
      });

      it('opens the oldest live session of the baby, with its volumes and notes', () => {
        expect(text('timer-duration')).toBe('30m');
        expect(toggle().textContent?.trim()).toBe(en.timer.stop);
        expect(ml('left').value).toBe('40');
        expect(ml('right').value).toBe('');
        expect(find<HTMLTextAreaElement>('notes-input')!.value).toBe('evening');
      });

      it('closes on × without deleting it (it was not started here)', async () => {
        await click('sheet-close');

        expect(pumps.delete).not.toHaveBeenCalled();
        expect(sheetRef.close).toHaveBeenCalledWith();
      });
    });

    describe('editing a live session', () => {
      const pump = livePump(20, { id: 'p7' });

      beforeEach(() => render(pump));

      it('does not look for another live session', () => {
        expect(sync.refreshes()).toBe(0);
      });

      it('stops it on Stop: ended now, no longer live, the sheet still open', async () => {
        await click('timer-toggle');

        expect(pumps.stop).toHaveBeenCalledWith('p7', NOW.toISOString());
        await respondTimer({ ok: true, entry: { ...pump, endTime: NOW.toISOString() } });

        expect(toggle().textContent?.trim()).toBe(en.timer.start);
        expect(form().controls.endTime.value).toEqual(NOW);
        expect(rows()).toHaveLength(2);
        expect(text('pump-duration')).toBe('20m');
        expect(text('timer-duration')).toBe('20m');
        expect(toggle().disabled).toBe(false);
        expect(sheetRef.close).not.toHaveBeenCalled();
      });

      it('saves the volumes typed while live first when Stop is tapped, then stops it', async () => {
        await typeMl('left', '80');
        await click('timer-toggle');

        expect(pumps.update).toHaveBeenCalledWith('p7', {
          startTime: pump.startTime,
          endTime: null,
          leftMl: 80,
          rightMl: null,
          notes: null,
        });
        expect(pumps.stop).not.toHaveBeenCalled();
        const corrected = { ...pump, leftMl: 80, updatedAt: NOW.toISOString() };
        saved.next({ ok: true, entry: corrected });
        await settle();

        expect(pumps.stop).toHaveBeenCalledWith('p7', NOW.toISOString());
        await respondTimer({ ok: true, entry: { ...corrected, endTime: NOW.toISOString() } });
        expect(ml('left').value).toBe('80');
        expect(sheetRef.close).not.toHaveBeenCalled();
      });

      it('moves the start to now minus a typed duration and keeps running', async () => {
        find<HTMLButtonElement>('timer-edit')!.click();
        typed.next(25 * 60);
        await settle();

        expect(form().controls.startTime.value).toEqual(new Date(NOW.getTime() - 25 * 60_000));
        expect(text('timer-duration')).toBe('25m');
        expect(text('pump-end-time')).toContain(en.pump.sheet.pumping);
        expect(toggle().textContent?.trim()).toBe(en.timer.stop);
        expect(toggle().disabled).toBe(false);
        now.set(now() + 60_000);
        await settle();
        expect(text('timer-duration')).toBe('26m');
      });

      it('closes on × with the session as the taps left it, discarding the form edits', async () => {
        await click('timer-toggle');
        const stopped = { ...pump, endTime: NOW.toISOString() };
        await respondTimer({ ok: true, entry: stopped });

        await click('sheet-close');

        expect(pumps.update).not.toHaveBeenCalled();
        expect(sheetRef.close).toHaveBeenCalledWith({ saved: stopped });
      });

      it('closes on × without a result when no timer was tapped, leaving it running', async () => {
        await click('sheet-close');

        expect(pumps.stop).not.toHaveBeenCalled();
        expect(sheetRef.close).toHaveBeenCalledWith();
      });

      it('deletes it after confirmation', async () => {
        await click('entry-delete');
        confirmed.next(true);
        await settle();

        expect(pumps.delete).toHaveBeenCalledWith('p7');
        deleted.next({ ok: true });
        await settle();
        expect(sheetRef.close).toHaveBeenCalledWith({ deleted: 'p7' });
        expect(sync.removed).toEqual(['p7']);
      });
    });

    describe('editing a stopped session', () => {
      const pump = aPump({
        id: 'p7',
        startTime: at(8).toISOString(),
        endTime: at(8, 25).toISOString(),
      });

      beforeEach(() => render(pump));

      it('shows its duration on the timer, with Start', () => {
        expect(text('timer-duration')).toBe('25m');
        expect(toggle().textContent?.trim()).toBe(en.timer.start);
        expect(toggle().disabled).toBe(false);
      });

      it('makes it live again on Start, running from its start time', async () => {
        await click('timer-toggle');

        expect(pumps.start).toHaveBeenCalledWith('p7', 'b1', NOW.toISOString());
        await respondTimer({ ok: true, entry: { ...pump, endTime: null } });

        expect(toggle().textContent?.trim()).toBe(en.timer.stop);
        expect(text('timer-duration')).toBe('4h');
        expect(form().controls.endTime.value).toBeNull();
        expect(text('pump-end-time')).toContain(en.pump.sheet.pumping);
      });

      it('keeps Start on once its end time is changed', async () => {
        form().controls.endTime.setValue(at(9));
        form().controls.endTime.markAsDirty();
        await settle();

        expect(toggle().disabled).toBe(false);
      });
    });
  });

  describe('typing the duration', () => {
    beforeEach(() => render());

    it('sets the end to the start plus the typed duration from the timer', async () => {
      form().controls.startTime.setValue(at(9));
      find<HTMLButtonElement>('timer-edit')!.click();
      typed.next(20 * 60);
      await settle();

      expect(form().controls.startTime.value).toEqual(at(9));
      expect(form().controls.endTime.value).toEqual(at(9, 20));
      expect(text('timer-duration')).toBe('20m');
      expect(toggle().disabled).toBe(false);
    });
  });

  describe('offline (taps kept on the device)', () => {
    /** Makes the shared state show `pump` once the sheet applies the waiting taps. */
    const offlineShows = (pump: (id: string) => Pump) =>
      sync.whenApplied(() => sync.inProgress.set([pump(pumps.start.mock.calls.at(-1)?.[0])]));

    it('shows a session started offline running, with its start time', async () => {
      // Offline: the live poll it asked for never answers.
      await render();
      offlineShows((id) => livePump(0, { id }));

      await click('timer-toggle');
      await respondTimer({ ok: true, queued: true });

      expect(sync.applied).toEqual([undefined]);
      expect(toggle().textContent?.trim()).toBe(en.timer.stop);
      expect(form().controls.startTime.value).toEqual(NOW);
      expect(text('pump-end-time')).toContain(en.pump.sheet.pumping);
      now.set(NOW.getTime() + 90_000);
      await settle();
      expect(text('timer-duration')).toBe('1m 30s');
      expect(find('entry-delete')).not.toBeNull();
    });

    it('opens the session started offline when opened to add, without the server', async () => {
      sync.inProgress.set([livePump(10, { notes: 'evening', leftMl: 60 })]);
      await render();

      expect(sync.refreshes()).toBe(0);
      expect(toggle().textContent?.trim()).toBe(en.timer.stop);
      expect(form().controls.notes.value).toBe('evening');
      expect(ml('left').value).toBe('60');
    });

    it('stops offline: the session is shown stopped, no longer live', async () => {
      const pump = livePump(10);
      sync.inProgress.set([pump]);
      await render();
      // Once the stop is applied, the session is no longer in the live list.
      sync.whenApplied(() => sync.inProgress.set([]));

      await click('timer-toggle');
      await respondTimer({ ok: true, queued: true });

      expect(sync.applied).toEqual([pump]);
      expect(toggle().textContent?.trim()).toBe(en.timer.start);
      expect(form().controls.endTime.value).toEqual(NOW);
      now.set(NOW.getTime() + 60_000);
      await settle();
      expect(text('timer-duration')).toBe('10m');
      expect(sheetRef.close).not.toHaveBeenCalled();
      expect(pumps.get).not.toHaveBeenCalled();
    });

    it('makes a stopped session live again offline, from its start time', async () => {
      const pump = aPump({
        id: 'p7',
        startTime: at(8).toISOString(),
        endTime: at(9).toISOString(),
      });
      await render(pump);
      offlineShows(() => ({ ...pump, endTime: null }));

      await click('timer-toggle');
      await respondTimer({ ok: true, queued: true });

      expect(sync.applied).toEqual([pump]);
      expect(toggle().textContent?.trim()).toBe(en.timer.stop);
      expect(text('timer-duration')).toBe('4h');
    });

    it('deletes on × a session started offline in this sheet, after confirmation', async () => {
      await render();
      offlineShows((id) => livePump(0, { id }));
      await click('timer-toggle');
      await respondTimer({ ok: true, queued: true });
      const id = pumps.start.mock.calls[0][0];

      await click('sheet-close');
      confirmed.next(true);
      await settle();
      expect(pumps.delete).toHaveBeenCalledWith(id);

      deleted.next({ ok: true, queued: true });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ queued: true });
    });
  });

  describe('shared live state', () => {
    it('opens the live session the shared state already has, at once', async () => {
      sync.inProgress.set([livePump(25, { id: 'p9' })]);
      await render();

      expect(toggle().textContent?.trim()).toBe(en.timer.stop);
      expect(text('timer-duration')).toBe('25m');
    });

    it('applies Start and Stop to the shared state at once', async () => {
      await render();
      await click('timer-toggle');
      const id = pumps.start.mock.calls[0][0];
      const started = livePump(0, { id });
      await respondTimer({ ok: true, entry: started });
      expect(sync.puts).toEqual([started]);

      tapped = new Subject();
      await click('timer-toggle');
      const ended = { ...started, endTime: NOW.toISOString() };
      await respondTimer({ ok: true, entry: ended });
      expect(sync.puts).toEqual([started, ended]);
    });

    it('applies a saved session to the shared state', async () => {
      const pump = livePump(20, { id: 'p7' });
      await render(pump);
      form().markAsDirty();
      await settle();

      await click('sheet-save');
      saved.next({ ok: true, entry: pump });
      await settle();

      expect(sync.puts).toEqual([pump]);
    });

    describe('changed on another device', () => {
      const pump = livePump(20, { id: 'p7', updatedAt: NOW.toISOString() });
      const later = new Date(NOW.getTime() + 1000).toISOString();

      beforeEach(async () => {
        sync.inProgress.set([pump]);
        await render(pump);
      });

      it('follows its start time, volumes and notes', async () => {
        sync.inProgress.set([
          {
            ...pump,
            startTime: at(11).toISOString(),
            leftMl: 50,
            rightMl: 30,
            notes: 'evening',
            updatedAt: later,
          },
        ]);
        await settle();

        expect(form().controls.startTime.value).toEqual(at(11));
        expect(ml('left').value).toBe('50');
        expect(ml('right').value).toBe('30');
        expect(find<HTMLTextAreaElement>('notes-input')!.value).toBe('evening');
        expect(text('timer-duration')).toBe('1h');
      });

      it('keeps a volume typed in the sheet', async () => {
        await typeMl('left', '70');
        sync.inProgress.set([{ ...pump, leftMl: 50, updatedAt: later }]);
        await settle();

        expect(ml('left').value).toBe('70');
      });

      it('shows it stopped once it leaves the live list stopped', async () => {
        const stopped = { ...pump, endTime: NOW.toISOString(), updatedAt: later };
        pumps.get.mockReturnValue(of(stopped));

        sync.inProgress.set([]);
        await settle();

        expect(pumps.get).toHaveBeenCalledWith('p7');
        expect(toggle().textContent?.trim()).toBe(en.timer.start);
        expect(form().controls.endTime.value).toEqual(NOW);
        expect(sheetRef.close).not.toHaveBeenCalled();
      });

      it('closes with a message once it was deleted', async () => {
        sync.inProgress.set([]);
        await settle();

        expect(snackBar.open).toHaveBeenCalledWith(
          en.pump.sheet.deletedElsewhere,
          undefined,
          expect.anything(),
        );
        expect(sheetRef.close).toHaveBeenCalledWith();
      });
    });

    it('warns "Still pumping?" on a session live for more than 1 hour', async () => {
      await render(livePump(65));

      expect(text('banner-title')).toBe(en.pump.stillPumping.title);
      expect(text('banner-text')).toContain('1h 5m ago');
    });

    it('does not warn on a live session under 1 hour', async () => {
      await render(livePump(59));

      expect(find('banner-title')).toBeNull();
    });
  });
});
