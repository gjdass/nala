import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { Diaper } from '../../../core/diapers/diaper.models';
import { DiaperService } from '../../../core/diapers/diaper.service';
import { EntryDeleteResult, EntryResult } from '../../../core/entries/entry-result';
import { EntrySheetData } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';
import { aDiaper } from '../../../testing/diapers';
import { translocoTesting } from '../../../testing/transloco-testing';
import { DIAPER_SECTION } from '../diaper.section';
import { DiaperSheetComponent } from './diaper-sheet.component';

const NOW = new Date(2026, 9, 3, 12, 0, 0);
const shortTime = (d: Date) => new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(d);

describe('DiaperSheetComponent', () => {
  let fixture: ComponentFixture<DiaperSheetComponent>;
  let saved: Subject<EntryResult<Diaper>>;
  let deleted: Subject<EntryDeleteResult>;
  let diapers: Record<'create' | 'update' | 'delete', ReturnType<typeof vi.fn>>;
  let sheetRef: { close: ReturnType<typeof vi.fn> };
  let confirmed: Subject<boolean | undefined>;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(testId: string) =>
    host().querySelector<T>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const save = () => find<HTMLButtonElement>('sheet-save')!;
  const settle = () => fixture.whenStable();
  const chip = (key: 'wet' | 'dirty') => find(`diaper-${key}`)!;
  const chipOn = (key: 'wet' | 'dirty') => chip(key).classList.contains('mat-mdc-chip-selected');
  const tapChip = async (key: 'wet' | 'dirty') => {
    chip(key).querySelector<HTMLElement>('.mdc-evolution-chip__action--primary')!.click();
    await settle();
  };
  const rash = () => find('diaper-rash')!.querySelector<HTMLButtonElement>('button')!;
  const rashOn = () => rash().getAttribute('aria-checked') === 'true';
  const tapRash = async () => {
    rash().click();
    await settle();
  };
  const fieldsSent = () => (diapers.create.mock.calls.at(-1) ?? [])[1];

  const render = async (entry: Diaper | null = null) => {
    const data: EntrySheetData<Diaper> = {
      section: 'diaper',
      kind: DIAPER_SECTION.kinds[0],
      entry,
    };
    TestBed.overrideProvider(SHEET_DATA, { useValue: data });
    fixture = TestBed.createComponent(DiaperSheetComponent);
    await settle();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    saved = new Subject();
    deleted = new Subject();
    diapers = {
      create: vi.fn(() => saved),
      update: vi.fn(() => saved),
      delete: vi.fn(() => deleted),
    };
    sheetRef = { close: vi.fn() };
    confirmed = new Subject();
    await TestBed.configureTestingModule({
      imports: [DiaperSheetComponent, translocoTesting()],
      providers: [
        provideNativeDateAdapter(),
        { provide: DiaperService, useValue: diapers },
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

    it('is titled Diaper with the time, type, diaper rash and notes rows', () => {
      expect(text('sheet-title')).toBe(en.diaper.kinds.diaper);
      const rows = host().textContent!;
      expect(rows).toContain(en.entrySheet.time);
      expect(rows).toContain(en.diaper.sheet.type);
      expect(rows).toContain(en.diaper.sheet.rash);
      expect(rows).toContain(en.entrySheet.notes);
      expect(host().querySelector('nala-time-row')).toBeTruthy();
      expect(host().querySelector('nala-chip-toggles-row')).toBeTruthy();
      expect(host().querySelector('nala-switch-row')).toBeTruthy();
      expect(text('diaper-wet')).toBe(en.diaper.toggle.wet);
      expect(text('diaper-dirty')).toBe(en.diaper.toggle.dirty);
    });

    it('opens at now with every toggle off', () => {
      expect(host().querySelector('nala-time-row')?.textContent).toContain(
        `Today ${shortTime(NOW)}`,
      );
      expect(chipOn('wet')).toBe(false);
      expect(chipOn('dirty')).toBe(false);
      expect(rashOn()).toBe(false);
    });

    it('saves a dry diaper when neither Wet nor Dirty is on', async () => {
      expect(save().disabled).toBe(false);
      save().click();
      await settle();

      expect(diapers.create).toHaveBeenCalledWith(
        'b1',
        { time: NOW.toISOString(), wet: false, dirty: false, rash: false, notes: null },
        expect.stringMatching(/^[0-9a-f-]{36}$/),
      );
    });

    it('turns Wet and Dirty on independently, either or both', async () => {
      await tapChip('wet');
      expect([chipOn('wet'), chipOn('dirty')]).toEqual([true, false]);

      await tapChip('dirty');
      expect([chipOn('wet'), chipOn('dirty')]).toEqual([true, true]);
      save().click();
      await settle();
      expect(fieldsSent()).toMatchObject({ wet: true, dirty: true });
      saved.next({ ok: false, errors: { form: 'unknown' } });
      await settle();

      await tapChip('wet');
      save().click();
      await settle();
      expect(fieldsSent()).toMatchObject({ wet: false, dirty: true });
    });

    it('sends the diaper rash toggle', async () => {
      await tapRash();
      expect(rashOn()).toBe(true);
      save().click();
      await settle();

      expect(fieldsSent()).toMatchObject({ rash: true });
    });

    it('refuses a time in the future (1 minute tolerance)', async () => {
      const time = fixture.componentInstance.form.controls.time;
      time.setValue(new Date(NOW.getTime() + 60_000));
      await settle();
      expect(save().disabled).toBe(false);

      time.setValue(new Date(NOW.getTime() + 5 * 60_000));
      await settle();
      expect(save().disabled).toBe(true);
    });

    it('closes with the saved diaper', async () => {
      save().click();
      const diaper = aDiaper();
      saved.next({ ok: true, entry: diaper });
      await settle();

      expect(sheetRef.close).toHaveBeenCalledWith({ saved: diaper });
    });

    it('keeps the same client id when Save is tried again', async () => {
      save().click();
      saved.next({ ok: false, errors: { form: 'unknown' } });
      await settle();
      save().click();
      await settle();

      const ids = diapers.create.mock.calls.map((call) => call[2]);
      expect(ids).toHaveLength(2);
      expect(ids[0]).toBe(ids[1]);
    });

    it('shows a form error when saving fails', async () => {
      save().click();
      saved.next({ ok: false, errors: { form: 'babyNotFound' } });
      await settle();

      expect(text('form-error')).toBe(en.diaper.errors.babyNotFound);
      expect(sheetRef.close).not.toHaveBeenCalled();
    });

    it('closes once the diaper is kept on the device (offline)', async () => {
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
    const time = new Date(2026, 9, 3, 9, 15);
    const diaper = aDiaper({
      id: 'd7',
      time: time.toISOString(),
      wet: false,
      dirty: true,
      rash: true,
      notes: 'after the bath',
    });

    it('opens with its values', async () => {
      await render(diaper);

      expect(fixture.componentInstance.form.controls.time.value).toEqual(time);
      expect([chipOn('wet'), chipOn('dirty'), rashOn()]).toEqual([false, true, true]);
      expect(find<HTMLTextAreaElement>('notes-input')!.value).toBe('after the bath');
    });

    it('replaces its values on Save and closes with the diaper', async () => {
      await render(diaper);
      await tapChip('wet');
      await tapRash();
      save().click();
      await settle();

      expect(diapers.update).toHaveBeenCalledWith('d7', {
        time: time.toISOString(),
        wet: true,
        dirty: true,
        rash: false,
        notes: 'after the bath',
      });
      const updated = aDiaper({ ...diaper, wet: true, rash: false });
      saved.next({ ok: true, entry: updated });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ saved: updated });
    });

    it('discards the form edits on ×', async () => {
      await render(diaper);
      await tapChip('wet');

      find<HTMLButtonElement>('sheet-close')!.click();
      confirmed.next(true);
      await settle();

      expect(diapers.update).not.toHaveBeenCalled();
      expect(sheetRef.close).toHaveBeenCalledWith();
    });

    it('shows a form error when the diaper no longer exists', async () => {
      await render(diaper);
      save().click();
      saved.next({ ok: false, errors: { form: 'diaperNotFound' } });
      await settle();

      expect(text('form-error')).toBe(en.diaper.errors.diaperNotFound);
    });

    it('says who logged it and who edited it last, and when', async () => {
      const updatedAt = new Date(2026, 9, 3, 11, 40).toISOString();
      await render(aDiaper({ ...diaper, updatedBy: { id: 'u2', displayName: 'Ben' }, updatedAt }));

      expect(
        host().querySelector('nala-entry-audit')?.textContent?.replace(/\s+/g, ' ').trim(),
      ).toBe(`Logged by Anna · Edited by Ben, ${shortTime(new Date(updatedAt))}`);
    });

    it('deletes it after confirmation and closes with its id', async () => {
      await render(diaper);

      find<HTMLButtonElement>('entry-delete')!.click();
      expect(diapers.delete).not.toHaveBeenCalled();
      confirmed.next(true);
      await settle();
      expect(diapers.delete).toHaveBeenCalledWith('d7');

      deleted.next({ ok: true });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ deleted: 'd7' });
    });

    it('closes once the delete is kept on the device (offline)', async () => {
      await render(diaper);

      find<HTMLButtonElement>('entry-delete')!.click();
      confirmed.next(true);
      deleted.next({ ok: true, queued: true });
      await settle();

      expect(sheetRef.close).toHaveBeenCalledWith({ queued: true });
    });

    it('keeps the sheet open when deleting fails', async () => {
      await render(diaper);

      find<HTMLButtonElement>('entry-delete')!.click();
      confirmed.next(true);
      deleted.next({ ok: false, errors: { form: 'unknown' } });
      await settle();

      expect(sheetRef.close).not.toHaveBeenCalled();
      expect(text('form-error')).toBe(en.diaper.errors.unknown);
    });
  });
});
