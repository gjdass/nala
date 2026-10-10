import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { EntryDeleteResult, EntryResult } from '../../../core/entries/entry-result';
import { Sleep } from '../../../core/sleeps/sleep.models';
import { SleepService } from '../../../core/sleeps/sleep.service';
import { SleepSyncService } from '../../../core/sleeps/sleep-sync.service';
import { NowService } from '../../../core/time/now.service';
import { DurationDialogComponent } from '../../../shared/ui/duration-dialog/duration-dialog.component';
import { EntrySheetData } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';
import { fakeSleepSync } from '../../../testing/sleep-sync';
import { aSleep } from '../../../testing/sleeps';
import { translocoTesting } from '../../../testing/transloco-testing';
import { SLEEP_SECTION } from '../sleep.section';
import { SleepSheetComponent } from './sleep-sheet.component';

const NOW = new Date(2026, 8, 30, 12, 0, 0);
const at = (h: number, m = 0) => new Date(2026, 8, 30, h, m);
const shortTime = (d: Date) => new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(d);

describe('SleepSheetComponent', () => {
  let fixture: ComponentFixture<SleepSheetComponent>;
  let saved: Subject<EntryResult<Sleep>>;
  let deleted: Subject<EntryDeleteResult>;
  let tapped: Subject<EntryResult<Sleep>>;
  let now: ReturnType<typeof signal<number>>;
  let sleeps: Record<
    'create' | 'update' | 'delete' | 'start' | 'stop' | 'get',
    ReturnType<typeof vi.fn>
  >;
  let sheetRef: { close: ReturnType<typeof vi.fn>; onDismiss?: (() => void) | null };
  let confirmed: Subject<boolean | undefined>;
  let typed: Subject<number | undefined>;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let sync: ReturnType<typeof fakeSleepSync>;
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
  const respondTimer = async (result: EntryResult<Sleep>) => {
    tapped.next(result);
    await settle();
  };
  /** A live sleep of b1 started `minutes` before NOW. */
  const liveSleep = (minutes: number, overrides: Partial<Sleep> = {}) =>
    aSleep({
      startTime: new Date(NOW.getTime() - minutes * 60_000).toISOString(),
      endTime: null,
      ...overrides,
    });
  const settle = () => fixture.whenStable();
  /** Taps the timer's duration and answers the duration dialog with `seconds` (undefined: Cancel). */
  const typeDuration = async (seconds: number | undefined) => {
    await click('timer-edit');
    typed.next(seconds);
    await settle();
  };
  const form = () => fixture.componentInstance.form;
  /** A tap outside the sheet, or Escape, as `SheetService` handles it. */
  const tapOutside = async () => {
    (sheetRef.onDismiss ?? (() => (sheetRef.close as () => void)()))();
    await settle();
  };
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

  const render = async (entry: Sleep | null = null) => {
    const data: EntrySheetData<Sleep> = { section: 'sleep', kind: SLEEP_SECTION.kinds[0], entry };
    TestBed.overrideProvider(SHEET_DATA, { useValue: data });
    fixture = TestBed.createComponent(SleepSheetComponent);
    await settle();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    saved = new Subject();
    deleted = new Subject();
    tapped = new Subject();
    now = signal(NOW.getTime());
    sleeps = {
      create: vi.fn(() => saved),
      update: vi.fn(() => saved),
      delete: vi.fn(() => deleted),
      start: vi.fn(() => tapped),
      stop: vi.fn(() => tapped),
      get: vi.fn(() => of(null)),
    };
    sync = fakeSleepSync();
    snackBar = { open: vi.fn() };
    sheetRef = { close: vi.fn() };
    confirmed = new Subject();
    typed = new Subject();
    dialog = {
      open: vi.fn((component: unknown) => ({
        afterClosed: () => (component === DurationDialogComponent ? typed : confirmed),
      })),
    };
    await TestBed.configureTestingModule({
      imports: [SleepSheetComponent, translocoTesting()],
      providers: [
        provideNativeDateAdapter(),
        { provide: SleepService, useValue: sleeps },
        { provide: SelectedBabyService, useValue: { selected: signal({ id: 'b1' }) } },
        { provide: SheetRef, useValue: sheetRef },
        { provide: SHEET_DATA, useValue: null },
        { provide: NowService, useValue: { now } },
        { provide: SleepSyncService, useValue: sync },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: MatDialog, useValue: dialog },
      ],
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  describe('adding', () => {
    beforeEach(() => render());

    it('is titled Sleep with the start time, end time, duration and notes rows', () => {
      expect(text('sheet-title')).toBe(en.sleep.kinds.sleep);
      const body = host().textContent!;
      expect(body).toContain(en.entrySheet.startTime);
      expect(body).toContain(en.sleep.sheet.endTime);
      expect(body).toContain(en.sleep.sheet.duration);
      expect(body).toContain(en.entrySheet.notes);
    });

    it('starts now and has no end yet, which it offers to add', () => {
      expect(form().controls.startTime.value).toEqual(NOW);
      expect(form().controls.endTime.value).toBeNull();
      expect(rows()[0].textContent).toContain(`Today ${shortTime(NOW)}`);
      expect(rows()[1].textContent).toContain(en.entrySheet.add);
      expect(text('sleep-duration')).toBe('');
    });

    it('keeps Save disabled until there is an end', async () => {
      expect(save().disabled).toBe(true);

      await setTimes(at(9), at(10, 30));

      expect(save().disabled).toBe(false);
    });

    it('shows the duration from the start to the end', async () => {
      await setTimes(at(9), at(10, 30));

      expect(text('sleep-duration')).toBe('1h 30m');
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

    it('adds the sleep for the selected baby and closes with it', async () => {
      await setTimes(at(9), at(10, 30));
      save().click();
      await settle();

      expect(sleeps.create).toHaveBeenCalledWith(
        'b1',
        { startTime: at(9).toISOString(), endTime: at(10, 30).toISOString(), notes: null },
        expect.stringMatching(/^[0-9a-f-]{36}$/),
      );
      expect(save().disabled).toBe(true);

      const sleep = aSleep();
      saved.next({ ok: true, entry: sleep });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ saved: sleep });
    });

    it('keeps the same client id when Save is tried again', async () => {
      await setTimes(at(9), at(10, 30));
      save().click();
      saved.next({ ok: false, errors: { form: 'unknown' } });
      await settle();
      save().click();
      await settle();

      const ids = sleeps.create.mock.calls.map((call) => call[2]);
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

      expect(text('form-error')).toBe(en.sleep.errors.babyNotFound);
    });

    it('closes once the sleep is kept on the device (offline)', async () => {
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
    const sleep = aSleep({
      id: 's7',
      startTime: at(8).toISOString(),
      endTime: at(9, 45).toISOString(),
      notes: 'stroller',
    });

    it('is pre-filled with the sleep', async () => {
      await render(sleep);

      expect(form().controls.startTime.value).toEqual(at(8));
      expect(form().controls.endTime.value).toEqual(at(9, 45));
      expect(find<HTMLTextAreaElement>('notes-input')!.value).toBe('stroller');
      expect(text('sleep-duration')).toBe('1h 45m');
      expect(save().disabled).toBe(false);
    });

    it('saves the changes and closes with the sleep', async () => {
      await render(sleep);
      await setTimes(at(8), at(10));
      save().click();
      await settle();

      expect(sleeps.update).toHaveBeenCalledWith('s7', {
        startTime: at(8).toISOString(),
        endTime: at(10).toISOString(),
        notes: 'stroller',
      });
      const updated = aSleep({ ...sleep, endTime: at(10).toISOString() });
      saved.next({ ok: true, entry: updated });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ saved: updated });
    });

    it('says who logged it and who edited it last', async () => {
      const updatedAt = at(11, 40).toISOString();
      await render(aSleep({ ...sleep, updatedBy: { id: 'u2', displayName: 'Ben' }, updatedAt }));

      expect(
        host().querySelector('nala-entry-audit')?.textContent?.replace(/\s+/g, ' ').trim(),
      ).toBe(`Logged by Anna · Edited by Ben, ${shortTime(at(11, 40))}`);
    });

    it('shows that it no longer exists', async () => {
      await render(sleep);
      await setTimes(at(8), at(10));
      save().click();
      saved.next({ ok: false, errors: { form: 'sleepNotFound' } });
      await settle();

      expect(text('form-error')).toBe(en.sleep.errors.sleepNotFound);
    });

    it('deletes it after confirmation and closes with its id', async () => {
      await render(sleep);

      find<HTMLButtonElement>('entry-delete')!.click();
      confirmed.next(true);
      await settle();
      expect(sleeps.delete).toHaveBeenCalledWith('s7');

      deleted.next({ ok: true });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ deleted: 's7' });
    });

    it('closes once the delete is kept on the device (offline)', async () => {
      await render(sleep);

      find<HTMLButtonElement>('entry-delete')!.click();
      confirmed.next(true);
      deleted.next({ ok: true, queued: true });
      await settle();

      expect(sheetRef.close).toHaveBeenCalledWith({ queued: true });
    });

    it('keeps the sheet open when deleting fails', async () => {
      await render(sleep);

      find<HTMLButtonElement>('entry-delete')!.click();
      confirmed.next(true);
      deleted.next({ ok: false, errors: { form: 'unknown' } });
      await settle();

      expect(sheetRef.close).not.toHaveBeenCalled();
      expect(text('form-error')).toBe(en.sleep.errors.unknown);
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

      it('looks for a live sleep of the baby through the shared live poll', () => {
        expect(sync.refreshes()).toBe(1);
      });

      it('creates the live sleep for the selected baby on Start, now', async () => {
        await click('timer-toggle');

        expect(sleeps.start).toHaveBeenCalledWith(
          expect.stringMatching(/^[0-9a-f-]{36}$/),
          'b1',
          NOW.toISOString(),
        );
        const id = sleeps.start.mock.calls[0][0];
        await respondTimer({ ok: true, entry: liveSleep(0, { id }) });

        expect(toggle().textContent?.trim()).toBe(en.timer.stop);
        expect(form().controls.startTime.value).toEqual(NOW);
        expect(text('sleep-end-time')).toContain(en.sleep.sheet.sleeping);
        expect(rows()).toHaveLength(1);
        expect(find('entry-delete')).not.toBeNull();
      });

      it('ticks from the stored start time while live, and Save keeps it live', async () => {
        await click('timer-toggle');
        const id = sleeps.start.mock.calls[0][0];
        await respondTimer({ ok: true, entry: liveSleep(45, { id }) });

        expect(text('timer-duration')).toBe('45m');
        expect(text('sleep-duration')).toBe('45m');
        now.set(NOW.getTime() + 10_000);
        await settle();
        expect(text('timer-duration')).toBe('45m 10s');

        expect(save().disabled).toBe(false);
        save().click();
        await settle();
        expect(sleeps.update).toHaveBeenCalledWith(id, {
          startTime: new Date(NOW.getTime() - 45 * 60_000).toISOString(),
          endTime: null,
          notes: null,
        });
        expect(sleeps.stop).not.toHaveBeenCalled();
      });

      it('opens the live sleep when Start is refused because one is live', async () => {
        await click('timer-toggle');
        await respondTimer({ ok: false, errors: { form: 'sleepInProgress' } });

        expect(sync.refreshes()).toBe(2);
        sync.inProgress.set([
          liveSleep(30, { id: 'other', babyId: 'b2' }),
          liveSleep(20, { id: 's9' }),
        ]);
        sync.refreshed.next();
        await settle();

        expect(toggle().textContent?.trim()).toBe(en.timer.stop);
        expect(text('timer-duration')).toBe('20m');
      });

      it('keeps the same id when Start is tried again after a failure', async () => {
        await click('timer-toggle');
        await respondTimer({ ok: false, errors: { form: 'unknown' } });
        expect(text('form-error')).toBe(en.sleep.errors.unknown);

        await click('timer-toggle');
        const ids = sleeps.start.mock.calls.map((call) => call[0]);
        expect(ids[0]).toBe(ids[1]);
      });

      it('keeps Start on once an end time is typed', async () => {
        form().controls.endTime.setValue(at(11));
        form().controls.endTime.markAsDirty();
        await settle();

        expect(toggle().disabled).toBe(false);
      });

      it('creates the typed sleep first on Start, then starts it', async () => {
        await setTimes(at(9), at(10));
        form().controls.endTime.markAsDirty();
        await click('timer-toggle');

        const id = sleeps.create.mock.calls[0][2];
        expect(sleeps.create).toHaveBeenCalledWith(
          'b1',
          { startTime: at(9).toISOString(), endTime: at(10).toISOString(), notes: null },
          id,
        );
        expect(sleeps.start).not.toHaveBeenCalled();
        saved.next({
          ok: true,
          entry: aSleep({ id, startTime: at(9).toISOString(), endTime: at(10).toISOString() }),
        });
        await settle();

        expect(sleeps.start).toHaveBeenCalledWith(id, 'b1', NOW.toISOString());
        expect(sheetRef.close).not.toHaveBeenCalled();
      });

      it('starts alone when the typed times would be refused', async () => {
        await setTimes(at(10), at(9));
        form().controls.endTime.markAsDirty();
        await click('timer-toggle');

        expect(sleeps.create).not.toHaveBeenCalled();
        expect(sleeps.start).toHaveBeenCalled();
      });

      describe('× once Start created the sleep', () => {
        let id: string;

        beforeEach(async () => {
          await click('timer-toggle');
          id = sleeps.start.mock.calls[0][0];
          await respondTimer({ ok: true, entry: liveSleep(0, { id }) });
          await click('sheet-close');
        });

        it('asks first, then deletes it and closes with its id', async () => {
          expect(sleeps.delete).not.toHaveBeenCalled();

          confirmed.next(true);
          await settle();
          expect(sleeps.delete).toHaveBeenCalledWith(id);

          deleted.next({ ok: true });
          await settle();
          expect(sheetRef.close).toHaveBeenCalledWith({ deleted: id });
        });

        it('stays open, the sleep live, when cancelled', async () => {
          confirmed.next(false);
          await settle();

          expect(sleeps.delete).not.toHaveBeenCalled();
          expect(sheetRef.close).not.toHaveBeenCalled();
        });
      });

      it('keeps the sleep its Start created live on a tap outside, without asking', async () => {
        await click('timer-toggle');
        const live = liveSleep(0, { id: sleeps.start.mock.calls[0][0] });
        await respondTimer({ ok: true, entry: live });
        form().controls.notes.setValue('typed');
        form().controls.notes.markAsDirty();

        await tapOutside();

        expect(dialog.open).not.toHaveBeenCalled();
        expect(sleeps.delete).not.toHaveBeenCalled();
        expect(sleeps.stop).not.toHaveBeenCalled();
        expect(sleeps.update).not.toHaveBeenCalled();
        expect(sheetRef.close).toHaveBeenCalledWith({ saved: live });
      });
    });

    describe('opened to add while the baby has a live sleep', () => {
      beforeEach(async () => {
        await render();
        sync.inProgress.set([
          liveSleep(90, { id: 'tom', babyId: 'b2' }),
          liveSleep(30, { id: 's8', notes: 'cot' }),
          liveSleep(10, { id: 's9' }),
        ]);
        sync.refreshed.next();
        await settle();
      });

      it('opens the oldest live sleep of the baby', () => {
        expect(text('timer-duration')).toBe('30m');
        expect(toggle().textContent?.trim()).toBe(en.timer.stop);
        expect(find<HTMLTextAreaElement>('notes-input')!.value).toBe('cot');
      });

      it('closes on × without deleting it (it was not started here)', async () => {
        await click('sheet-close');

        expect(sleeps.delete).not.toHaveBeenCalled();
        expect(sheetRef.close).toHaveBeenCalledWith();
      });
    });

    describe('editing a live sleep', () => {
      const sleep = liveSleep(60, { id: 's7' });

      beforeEach(() => render(sleep));

      it('does not look for another live sleep', () => {
        expect(sync.refreshes()).toBe(0);
      });

      it('stops it on Stop: ended now, no longer live, the sheet still open', async () => {
        await click('timer-toggle');

        expect(sleeps.stop).toHaveBeenCalledWith('s7', NOW.toISOString());
        await respondTimer({ ok: true, entry: { ...sleep, endTime: NOW.toISOString() } });

        expect(toggle().textContent?.trim()).toBe(en.timer.start);
        expect(form().controls.endTime.value).toEqual(NOW);
        expect(rows()).toHaveLength(2);
        expect(text('sleep-duration')).toBe('1h');
        expect(text('timer-duration')).toBe('1h');
        expect(toggle().disabled).toBe(false);
        expect(sheetRef.close).not.toHaveBeenCalled();
      });

      it('closes on × with the sleep as the taps left it, discarding the form edits', async () => {
        await click('timer-toggle');
        const stopped = { ...sleep, endTime: NOW.toISOString() };
        await respondTimer({ ok: true, entry: stopped });

        await click('sheet-close');

        expect(sleeps.update).not.toHaveBeenCalled();
        expect(sheetRef.close).toHaveBeenCalledWith({ saved: stopped });
      });

      it('closes on × without a result when no timer was tapped', async () => {
        await click('sheet-close');

        expect(sheetRef.close).toHaveBeenCalledWith();
      });

      it('closes on a tap outside with the sleep as the taps left it, discarding the form edits', async () => {
        await click('timer-toggle');
        const stopped = { ...sleep, endTime: NOW.toISOString() };
        await respondTimer({ ok: true, entry: stopped });
        form().controls.notes.setValue('typed');
        form().controls.notes.markAsDirty();

        await tapOutside();

        expect(dialog.open).not.toHaveBeenCalled();
        expect(sleeps.update).not.toHaveBeenCalled();
        expect(sheetRef.close).toHaveBeenCalledWith({ saved: stopped });
      });

      it('closes on a tap outside without a result and without asking when no timer was tapped', async () => {
        form().controls.notes.setValue('typed');
        form().controls.notes.markAsDirty();

        await tapOutside();

        expect(dialog.open).not.toHaveBeenCalled();
        expect(sleeps.update).not.toHaveBeenCalled();
        expect(sheetRef.close).toHaveBeenCalledWith();
      });
    });

    describe('editing a stopped sleep', () => {
      const sleep = aSleep({
        id: 's7',
        startTime: at(8).toISOString(),
        endTime: at(9, 45).toISOString(),
      });

      beforeEach(() => render(sleep));

      it('shows its duration on the timer, with Start', () => {
        expect(text('timer-duration')).toBe('1h 45m');
        expect(toggle().textContent?.trim()).toBe(en.timer.start);
        expect(toggle().disabled).toBe(false);
      });

      it('makes it live again on Start, running from its start time', async () => {
        await click('timer-toggle');

        expect(sleeps.start).toHaveBeenCalledWith('s7', 'b1', NOW.toISOString());
        await respondTimer({ ok: true, entry: { ...sleep, endTime: null } });

        expect(toggle().textContent?.trim()).toBe(en.timer.stop);
        expect(text('timer-duration')).toBe('4h');
        expect(form().controls.endTime.value).toBeNull();
        expect(text('sleep-end-time')).toContain(en.sleep.sheet.sleeping);
        expect(find('entry-delete')).not.toBeNull();
      });

      it('keeps Start on once its end time is changed', async () => {
        form().controls.endTime.setValue(at(10));
        form().controls.endTime.markAsDirty();
        await settle();

        expect(toggle().disabled).toBe(false);
      });

      it('saves a changed end time first on Start, then makes it live again', async () => {
        await typeDuration(100 * 60);
        await click('timer-toggle');

        expect(sleeps.update).toHaveBeenCalledWith('s7', {
          startTime: at(8).toISOString(),
          endTime: at(9, 40).toISOString(),
          notes: null,
        });
        expect(sleeps.start).not.toHaveBeenCalled();
        const corrected = {
          ...sleep,
          endTime: at(9, 40).toISOString(),
          updatedAt: NOW.toISOString(),
        };
        saved.next({ ok: true, entry: corrected });
        await settle();

        expect(sleeps.start).toHaveBeenCalledWith('s7', 'b1', NOW.toISOString());
        await respondTimer({ ok: true, entry: { ...corrected, endTime: null } });

        expect(toggle().textContent?.trim()).toBe(en.timer.stop);
        expect(text('timer-duration')).toBe('4h');
        expect(sheetRef.close).not.toHaveBeenCalled();
      });

      it('shows the save error and does not start when saving first is refused', async () => {
        await typeDuration(100 * 60);
        await click('timer-toggle');
        saved.next({ ok: false, errors: { form: 'sleepNotFound' } });
        await settle();

        expect(sleeps.start).not.toHaveBeenCalled();
        expect(text('form-error')).toBe(en.sleep.errors.sleepNotFound);
      });
    });
  });

  describe('typing the duration', () => {
    describe('adding', () => {
      beforeEach(() => render());

      it('opens the duration dialog from the timer, with its duration', async () => {
        await click('timer-edit');

        expect(dialog.open).toHaveBeenCalledWith(DurationDialogComponent, {
          data: { title: en.timer.duration, seconds: 0 },
          panelClass: 'nala-scheme-sleep',
        });
      });

      it('sets the end to the start plus the duration, never moving the start', async () => {
        form().controls.startTime.setValue(at(9));
        await typeDuration(90 * 60);

        expect(form().controls.startTime.value).toEqual(at(9));
        expect(form().controls.endTime.value).toEqual(at(10, 30));
        expect(text('timer-duration')).toBe('1h 30m');
        expect(text('sleep-duration')).toBe('1h 30m');
        expect(toggle().disabled).toBe(false);
        expect(save().disabled).toBe(false);
      });

      it('changes nothing when the dialog is cancelled', async () => {
        await typeDuration(undefined);

        expect(form().controls.endTime.value).toBeNull();
        expect(toggle().disabled).toBe(false);
        expect(save().disabled).toBe(true);
      });

      it('saves the typed sleep', async () => {
        form().controls.startTime.setValue(at(9));
        await typeDuration(90 * 60);
        save().click();
        await settle();

        expect(sleeps.create).toHaveBeenCalledWith(
          'b1',
          { startTime: at(9).toISOString(), endTime: at(10, 30).toISOString(), notes: null },
          expect.any(String),
        );
      });
    });

    describe('on a live sleep', () => {
      const sleep = liveSleep(33, { id: 's7' });
      const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

      beforeEach(() => render(sleep));

      it('moves the start earlier for a longer duration and keeps running', async () => {
        await typeDuration(34 * 60);

        expect(form().controls.startTime.value).toEqual(minutesAgo(34));
        expect(form().controls.endTime.value).toBeNull();
        expect(text('timer-duration')).toBe('34m');
        expect(text('sleep-end-time')).toContain(en.sleep.sheet.sleeping);
        expect(toggle().textContent?.trim()).toBe(en.timer.stop);
        expect(toggle().disabled).toBe(false);
        now.set(now() + 60_000);
        await settle();
        expect(text('timer-duration')).toBe('35m');
        expect(text('sleep-duration')).toBe('35m');
      });

      it('moves the start later for a shorter duration and keeps running', async () => {
        await typeDuration(32 * 60);

        expect(form().controls.startTime.value).toEqual(minutesAgo(32));
        expect(text('timer-duration')).toBe('32m');
        expect(toggle().textContent?.trim()).toBe(en.timer.stop);
        expect(save().disabled).toBe(false);
      });

      it('keeps the typed start when the live sleep is polled again', async () => {
        await typeDuration(34 * 60);
        sync.inProgress.set([{ ...sleep, updatedAt: '2026-09-30T11:59:00Z' }]);
        await settle();

        expect(form().controls.startTime.value).toEqual(minutesAgo(34));
        expect(text('timer-duration')).toBe('34m');
      });

      it('saves the moved start on Save and keeps it live', async () => {
        await typeDuration(34 * 60);
        save().click();
        await settle();

        expect(sleeps.stop).not.toHaveBeenCalled();
        expect(sleeps.update).toHaveBeenCalledWith('s7', {
          startTime: minutesAgo(34).toISOString(),
          endTime: null,
          notes: null,
        });
        const stored = { ...sleep, startTime: minutesAgo(34).toISOString() };
        saved.next({ ok: true, entry: stored });
        await settle();
        expect(sheetRef.close).toHaveBeenCalledWith({ saved: stored });
      });

      it('saves the moved start first on Stop, then stops it now', async () => {
        await typeDuration(34 * 60);
        await click('timer-toggle');

        expect(sleeps.update).toHaveBeenCalledWith('s7', {
          startTime: minutesAgo(34).toISOString(),
          endTime: null,
          notes: null,
        });
        expect(sleeps.stop).not.toHaveBeenCalled();
        const corrected = {
          ...sleep,
          startTime: minutesAgo(34).toISOString(),
          updatedAt: NOW.toISOString(),
        };
        saved.next({ ok: true, entry: corrected });
        await settle();

        expect(sleeps.stop).toHaveBeenCalledWith('s7', NOW.toISOString());
        await respondTimer({ ok: true, entry: { ...corrected, endTime: NOW.toISOString() } });
        expect(toggle().textContent?.trim()).toBe(en.timer.start);
        expect(text('timer-duration')).toBe('34m');
      });

      it('discards the typed duration on × and leaves it running', async () => {
        await typeDuration(34 * 60);
        await click('sheet-close');
        confirmed.next(true);
        await settle();

        expect(sleeps.stop).not.toHaveBeenCalled();
        expect(sleeps.update).not.toHaveBeenCalled();
        expect(sheetRef.close).toHaveBeenCalled();
      });
    });
  });

  describe('offline (taps kept on the device)', () => {
    /** Makes the shared state show `sleep` once the sheet applies the waiting taps. */
    const offlineShows = (sleep: (id: string) => Sleep) =>
      sync.whenApplied(() => sync.inProgress.set([sleep(sleeps.start.mock.calls.at(-1)?.[0])]));

    it('shows a sleep started offline running, with its start time', async () => {
      // Offline: the live poll it asked for never answers.
      await render();
      offlineShows((id) => liveSleep(0, { id }));

      await click('timer-toggle');
      await respondTimer({ ok: true, queued: true });

      expect(sync.applied).toEqual([undefined]);
      expect(toggle().textContent?.trim()).toBe(en.timer.stop);
      expect(form().controls.startTime.value).toEqual(NOW);
      expect(text('sleep-end-time')).toContain(en.sleep.sheet.sleeping);
      now.set(NOW.getTime() + 90_000);
      await settle();
      expect(text('timer-duration')).toBe('1m 30s');
      expect(find('entry-delete')).not.toBeNull();
    });

    it('opens the sleep started offline when opened to add, without the server', async () => {
      sync.inProgress.set([liveSleep(10, { notes: 'cot' })]);
      await render();

      expect(sync.refreshes()).toBe(0);
      expect(toggle().textContent?.trim()).toBe(en.timer.stop);
      expect(form().controls.notes.value).toBe('cot');
    });

    it('stops offline: the sleep is shown stopped, no longer live', async () => {
      const sleep = liveSleep(10);
      sync.inProgress.set([sleep]);
      await render();
      // Once the stop is applied, the sleep is no longer in the live list.
      sync.whenApplied(() => sync.inProgress.set([]));

      await click('timer-toggle');
      await respondTimer({ ok: true, queued: true });

      expect(sync.applied).toEqual([sleep]);
      expect(toggle().textContent?.trim()).toBe(en.timer.start);
      expect(form().controls.endTime.value).toEqual(NOW);
      now.set(NOW.getTime() + 60_000);
      await settle();
      expect(text('timer-duration')).toBe('10m');
      expect(sheetRef.close).not.toHaveBeenCalled();
      expect(sleeps.get).not.toHaveBeenCalled();
    });

    it('makes a stopped sleep live again offline, from its start time', async () => {
      const sleep = aSleep({
        id: 's7',
        startTime: at(8).toISOString(),
        endTime: at(9).toISOString(),
      });
      await render(sleep);
      offlineShows(() => ({ ...sleep, endTime: null }));

      await click('timer-toggle');
      await respondTimer({ ok: true, queued: true });

      expect(sync.applied).toEqual([sleep]);
      expect(toggle().textContent?.trim()).toBe(en.timer.stop);
      expect(text('timer-duration')).toBe('4h');
    });

    it('deletes on × a sleep started offline in this sheet, after confirmation', async () => {
      await render();
      offlineShows((id) => liveSleep(0, { id }));
      await click('timer-toggle');
      await respondTimer({ ok: true, queued: true });
      const id = sleeps.start.mock.calls[0][0];

      await click('sheet-close');
      confirmed.next(true);
      await settle();
      expect(sleeps.delete).toHaveBeenCalledWith(id);

      deleted.next({ ok: true, queued: true });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ queued: true });
    });
  });

  describe('shared live state', () => {
    it('opens the live sleep the shared state already has, at once', async () => {
      sync.inProgress.set([liveSleep(25, { id: 's9' })]);
      await render();

      expect(toggle().textContent?.trim()).toBe(en.timer.stop);
      expect(text('timer-duration')).toBe('25m');
    });

    it('applies Start and Stop to the shared state at once', async () => {
      await render();
      await click('timer-toggle');
      const id = sleeps.start.mock.calls[0][0];
      const started = liveSleep(0, { id });
      await respondTimer({ ok: true, entry: started });
      expect(sync.puts).toEqual([started]);

      tapped = new Subject();
      await click('timer-toggle');
      const ended = { ...started, endTime: NOW.toISOString() };
      await respondTimer({ ok: true, entry: ended });
      expect(sync.puts).toEqual([started, ended]);
    });

    it('applies a saved sleep to the shared state', async () => {
      const sleep = liveSleep(60, { id: 's7' });
      await render(sleep);
      form().markAsDirty();
      await settle();

      await click('sheet-save');
      saved.next({ ok: true, entry: sleep });
      await settle();

      expect(sync.puts).toEqual([sleep]);
    });

    it('removes a deleted sleep from the shared state', async () => {
      await render(liveSleep(60, { id: 's7' }));

      await click('entry-delete');
      confirmed.next(true);
      await settle();
      deleted.next({ ok: true });
      await settle();

      expect(sync.removed).toEqual(['s7']);
    });

    describe('changed on another device', () => {
      const sleep = liveSleep(60, { id: 's7', updatedAt: NOW.toISOString() });
      const later = new Date(NOW.getTime() + 1000).toISOString();

      beforeEach(async () => {
        sync.inProgress.set([sleep]);
        await render(sleep);
      });

      it('follows its start time and notes', async () => {
        sync.inProgress.set([
          { ...sleep, startTime: at(10).toISOString(), notes: 'cot', updatedAt: later },
        ]);
        await settle();

        expect(form().controls.startTime.value).toEqual(at(10));
        expect(find<HTMLTextAreaElement>('notes-input')!.value).toBe('cot');
        expect(text('timer-duration')).toBe('2h');
      });

      it('keeps a start time edited in the sheet', async () => {
        form().controls.startTime.setValue(at(10, 30));
        form().controls.startTime.markAsDirty();
        sync.inProgress.set([{ ...sleep, startTime: at(10).toISOString(), updatedAt: later }]);
        await settle();

        expect(form().controls.startTime.value).toEqual(at(10, 30));
      });

      it('shows it stopped once it leaves the live list stopped', async () => {
        const stopped = { ...sleep, endTime: NOW.toISOString(), updatedAt: later };
        sleeps.get.mockReturnValue(of(stopped));

        sync.inProgress.set([]);
        await settle();

        expect(sleeps.get).toHaveBeenCalledWith('s7');
        expect(toggle().textContent?.trim()).toBe(en.timer.start);
        expect(form().controls.endTime.value).toEqual(NOW);
        expect(sheetRef.close).not.toHaveBeenCalled();
      });

      it('closes with a message once it was deleted', async () => {
        sync.inProgress.set([]);
        await settle();

        expect(snackBar.open).toHaveBeenCalledWith(
          en.sleep.sheet.deletedElsewhere,
          undefined,
          expect.anything(),
        );
        expect(sheetRef.close).toHaveBeenCalledWith();
      });
    });

    it('warns "Still sleeping?" on a sleep live for more than 12 hours', async () => {
      await render(liveSleep(12 * 60 + 5));

      expect(text('banner-title')).toBe(en.sleep.stillSleeping.title);
      expect(text('banner-text')).toContain('12h 5m ago');
    });

    it('does not warn on a live sleep under 12 hours', async () => {
      await render(liveSleep(12 * 60 - 1));

      expect(find('banner-title')).toBeNull();
    });
  });
});
