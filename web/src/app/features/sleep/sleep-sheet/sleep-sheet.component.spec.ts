import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { EntryDeleteResult, EntryResult } from '../../../core/entries/entry-result';
import { Sleep } from '../../../core/sleeps/sleep.models';
import { SleepService } from '../../../core/sleeps/sleep.service';
import { EntrySheetData } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';
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
  let sleeps: Record<'create' | 'update' | 'delete', ReturnType<typeof vi.fn>>;
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
    sleeps = {
      create: vi.fn(() => saved),
      update: vi.fn(() => saved),
      delete: vi.fn(() => deleted),
    };
    sheetRef = { close: vi.fn() };
    confirmed = new Subject();
    await TestBed.configureTestingModule({
      imports: [SleepSheetComponent, translocoTesting()],
      providers: [
        provideNativeDateAdapter(),
        { provide: SleepService, useValue: sleeps },
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

    it('refuses an end in the future', async () => {
      await setTimes(at(11), at(12, 5));

      expect(save().disabled).toBe(true);
      expect(alerts()).toContain(en.entrySheet.inFuture);
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
});
