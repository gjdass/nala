import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import fr from '../../../../../public/i18n/fr.json';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { EntryDeleteResult, EntryResult } from '../../../core/entries/entry-result';
import { GrowthEntry } from '../../../core/growth-entries/growth-entry.models';
import { GrowthEntryService } from '../../../core/growth-entries/growth-entry.service';
import { EntrySheetData } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';
import { aMilestone } from '../../../testing/growth-entries';
import { translocoTesting } from '../../../testing/transloco-testing';
import { GROWTH_SECTION } from '../growth.section';
import { MilestoneSheetComponent } from './milestone-sheet.component';

const NOW = new Date(2026, 9, 3, 12, 0, 0);
const shortTime = (d: Date) => new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(d);
const PRESETS = [
  'firstSmile',
  'firstLaugh',
  'holdsHead',
  'rollsOver',
  'sitsUp',
  'crawls',
  'firstTooth',
  'standsUp',
  'firstSteps',
  'firstWord',
] as const;

describe('MilestoneSheetComponent', () => {
  let fixture: ComponentFixture<MilestoneSheetComponent>;
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
  const chip = (option: string) => find(`milestone-${option}`)!;
  const chipOn = (option: string) => chip(option).classList.contains('mat-mdc-chip-selected');
  const choose = async (option: string) => {
    chip(option).querySelector<HTMLElement>('.mdc-evolution-chip__action--primary')!.click();
    await settle();
  };
  const typeTitle = async (value: string) => {
    const input = find<HTMLInputElement>('title')!;
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
      kind: GROWTH_SECTION.kinds[1],
      entry,
    };
    TestBed.overrideProvider(SHEET_DATA, { useValue: data });
    fixture = TestBed.createComponent(MilestoneSheetComponent);
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
      imports: [MilestoneSheetComponent, translocoTesting()],
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

    it('is titled Milestone with the milestone chips, the date and notes, without a title', () => {
      expect(text('sheet-title')).toBe(en.growth.kinds.milestone);
      const rows = host().textContent!;
      expect(rows).toContain(en.growth.sheet.milestone);
      expect(rows).toContain(en.entrySheet.date);
      expect(rows).toContain(en.entrySheet.notes);
      expect([...PRESETS, 'custom'].map((option) => text(`milestone-${option}`))).toEqual([
        'First smile',
        'First laugh',
        'Holds head up',
        'Rolls over',
        'Sits up',
        'Crawls',
        'First tooth',
        'Stands up',
        'First steps',
        'First word',
        'Other',
      ]);
      expect(find('title')).toBeNull();
    });

    it('has the milestones and the title in French', async () => {
      expect(Object.values(fr.growth.milestone)).toEqual([
        'Premier sourire',
        'Premier rire',
        'Tient sa tête',
        'Se retourne',
        'Tient assis',
        'Marche à quatre pattes',
        'Première dent',
        'Se met debout',
        'Premiers pas',
        'Premier mot',
        'Autre',
      ]);
      expect(Object.keys(fr.growth.milestone)).toEqual([...PRESETS, 'custom']);
      expect(fr.growth.sheet.title).toBe('Titre');
      TestBed.inject(TranslocoService).setActiveLang('fr');
      await settle();
      expect(text('milestone-custom')).toBe('Autre');
    });

    it('puts the milestone before the date', () => {
      const chips = host().querySelector('nala-chip-choice-row')!;
      const dateRow = host().querySelector('nala-time-row')!;
      expect(chips.compareDocumentPosition(dateRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('opens on today, without a time, with no milestone chosen', () => {
      expect(date().value).toEqual(new Date(2026, 9, 3));
      const row = host().querySelector('nala-time-row')!.textContent!;
      expect(row).toContain('Today');
      expect(row).not.toContain(shortTime(NOW));
      expect([...PRESETS, 'custom'].some(chipOn)).toBe(false);
    });

    it('keeps Save disabled until a milestone is chosen', async () => {
      expect(save().disabled).toBe(true);

      await choose('firstSmile');
      expect(chipOn('firstSmile')).toBe(true);
      expect(save().disabled).toBe(false);
    });

    it('keeps the chosen milestone when its chip is tapped again', async () => {
      await choose('firstSmile');
      await choose('firstSmile');

      expect(chipOn('firstSmile')).toBe(true);
      expect(save().disabled).toBe(false);
    });

    it('saves a preset with a null title and the date as yyyy-MM-dd', async () => {
      await choose('firstTooth');
      save().click();
      await settle();

      expect(growthEntries.create).toHaveBeenCalledWith(
        'b1',
        'milestone',
        { date: '2026-10-03', milestone: 'firstTooth', title: null, notes: null },
        expect.any(String),
      );
    });

    it('shows the title with Other, and keeps Save disabled until it is filled', async () => {
      await choose('custom');

      expect(find('title')).toBeTruthy();
      expect(host().textContent).toContain(en.growth.sheet.title);
      expect(save().disabled).toBe(true);

      await typeTitle('   ');
      expect(save().disabled).toBe(true);
      expect(find('title')!.closest('mat-form-field')!.textContent).toContain(
        en.growth.errors.titleRequired,
      );

      await typeTitle('First swim');
      expect(save().disabled).toBe(false);
    });

    it('refuses a title over 100 characters', async () => {
      await choose('custom');

      fixture.componentInstance.form.controls.title.setValue('a'.repeat(101));
      fixture.componentInstance.form.controls.title.markAsTouched();
      await settle();
      expect(save().disabled).toBe(true);
      expect(find('title')!.closest('mat-form-field')!.textContent).toContain(
        en.growth.errors.titleTooLong,
      );

      await typeTitle('a'.repeat(100));
      expect(save().disabled).toBe(false);
      expect(find<HTMLInputElement>('title')!.getAttribute('maxlength')).toBe('100');
    });

    it('saves the trimmed title of a custom milestone', async () => {
      await choose('custom');
      await typeTitle('  First swim  ');
      save().click();
      await settle();

      expect(fieldsSent()).toEqual({
        date: '2026-10-03',
        milestone: 'custom',
        title: 'First swim',
        notes: null,
      });
    });

    it('hides the title when a preset is chosen after Other, and saves it null', async () => {
      await choose('custom');
      await typeTitle('First swim');

      await choose('sitsUp');
      expect(find('title')).toBeNull();
      expect(save().disabled).toBe(false);

      save().click();
      await settle();
      expect(fieldsSent()).toEqual({
        date: '2026-10-03',
        milestone: 'sitsUp',
        title: null,
        notes: null,
      });
    });

    it('refuses a date after today', async () => {
      await choose('firstSmile');

      await setDate(new Date(2026, 9, 4));
      expect(save().disabled).toBe(true);

      await setDate(new Date(2026, 9, 3));
      expect(save().disabled).toBe(false);
    });

    it("refuses a date before the baby's birth date", async () => {
      await choose('firstSmile');

      await setDate(new Date(2026, 7, 31));
      expect(save().disabled).toBe(true);
      expect(host().querySelector('nala-time-row')!.textContent).toContain(
        en.entrySheet.beforeBirth,
      );

      await setDate(new Date(2026, 8, 1));
      expect(save().disabled).toBe(false);
    });

    it('closes with the saved entry', async () => {
      await choose('firstSmile');
      save().click();
      const entry = aMilestone();
      saved.next({ ok: true, entry });
      await settle();

      expect(sheetRef.close).toHaveBeenCalledWith({ saved: entry });
    });

    it('keeps the same client id when Save is tried again', async () => {
      await choose('firstSmile');
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
      await choose('custom');
      await typeTitle('First swim');
      save().click();
      saved.next({ ok: false, errors: { date: 'beforeBirth', title: 'tooLong' } });
      await settle();

      expect(host().querySelector('nala-time-row')!.textContent).toContain(
        en.entrySheet.beforeBirth,
      );
      expect(find('title')!.closest('mat-form-field')!.textContent).toContain(
        en.growth.errors.titleTooLong,
      );
      expect(find('form-error')).toBeNull();
    });

    it('shows a form error when saving fails', async () => {
      await choose('firstSmile');
      save().click();
      saved.next({ ok: false, errors: { form: 'babyNotFound' } });
      await settle();

      expect(text('form-error')).toBe(en.growth.errors.babyNotFound);
      expect(sheetRef.close).not.toHaveBeenCalled();
    });

    it('closes once the entry is kept on the device (offline)', async () => {
      await choose('firstSmile');
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
    const entry = aMilestone({
      id: 'm7',
      date: '2026-09-28',
      milestone: 'custom',
      title: 'First swim',
      notes: 'pool',
    });

    it('opens with its values', async () => {
      await render(entry);

      expect(date().value).toEqual(new Date(2026, 8, 28));
      expect(chipOn('custom')).toBe(true);
      expect(find<HTMLInputElement>('title')!.value).toBe('First swim');
      expect(find<HTMLTextAreaElement>('notes-input')!.value).toBe('pool');
    });

    it('opens a preset without the title', async () => {
      await render(aMilestone({ milestone: 'crawls' }));

      expect(chipOn('crawls')).toBe(true);
      expect(find('title')).toBeNull();
    });

    it('replaces its values on Save and closes with the entry', async () => {
      await render(entry);
      await choose('firstSteps');
      save().click();
      await settle();

      expect(growthEntries.update).toHaveBeenCalledWith('m7', {
        date: '2026-09-28',
        milestone: 'firstSteps',
        title: null,
        notes: 'pool',
      });
      const updated = aMilestone({ ...entry, milestone: 'firstSteps', title: null });
      saved.next({ ok: true, entry: updated });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ saved: updated });
    });

    it('discards the form edits on ×', async () => {
      await render(entry);
      await typeTitle('First bath');

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
      await render(aMilestone({ ...entry, updatedBy: { id: 'u2', displayName: 'Ben' }, updatedAt }));

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
      expect(growthEntries.delete).toHaveBeenCalledWith('m7');

      deleted.next({ ok: true });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ deleted: 'm7' });
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
