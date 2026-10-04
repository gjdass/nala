import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject, of } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { EntryDeleteResult, EntryResult } from '../../../core/entries/entry-result';
import { HealthEntry, RecentMedicine } from '../../../core/health-entries/health-entry.models';
import { HealthEntryService } from '../../../core/health-entries/health-entry.service';
import { EntrySheetData } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';
import { aHealthEntry } from '../../../testing/health-entries';
import { translocoTesting } from '../../../testing/transloco-testing';
import { HEALTH_SECTION } from '../health.section';
import { HealthSheetComponent } from './health-sheet.component';

const NOW = new Date(2026, 9, 3, 12, 0, 0);
const shortTime = (d: Date) => new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(d);

describe('HealthSheetComponent', () => {
  let fixture: ComponentFixture<HealthSheetComponent>;
  let saved: Subject<EntryResult<HealthEntry>>;
  let deleted: Subject<EntryDeleteResult>;
  let healthEntries: Record<'create' | 'update' | 'delete' | 'recent', ReturnType<typeof vi.fn>>;
  let recent: RecentMedicine[];
  let sheetRef: { close: ReturnType<typeof vi.fn> };
  let confirmed: Subject<boolean | undefined>;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(testId: string) =>
    host().querySelector<T>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const save = () => find<HTMLButtonElement>('sheet-save')!;
  const settle = () => fixture.whenStable();
  const type = async (testId: 'name' | 'amount', value: string) => {
    const input = find<HTMLInputElement>(testId)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await settle();
  };
  const chipOn = (chip: HTMLElement) => chip.classList.contains('mat-mdc-chip-selected');
  const tapChip = async (chip: HTMLElement) => {
    chip.querySelector<HTMLElement>('.mdc-evolution-chip__action--primary')!.click();
    await settle();
  };
  const recentChip = (name: string) => find(`recent-${name}`)!;
  const unit = (option: string) => find(`unit-${option}`)!;
  const unitOn = (option: string) => unit(option).classList.contains('mat-mdc-chip-selected');
  const tapUnit = async (option: string) => {
    unit(option).querySelector<HTMLElement>('.mdc-evolution-chip__action--primary')!.click();
    await settle();
  };
  const fieldsSent = () => (healthEntries.create.mock.calls.at(-1) ?? [])[1];
  const failSave = async () => {
    saved.next({ ok: false, errors: { form: 'unknown' } });
    await settle();
  };

  const render = async (entry: HealthEntry | null = null) => {
    const data: EntrySheetData<HealthEntry> = {
      section: 'health',
      kind: HEALTH_SECTION.kinds[0],
      entry,
    };
    TestBed.overrideProvider(SHEET_DATA, { useValue: data });
    fixture = TestBed.createComponent(HealthSheetComponent);
    await settle();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    saved = new Subject();
    deleted = new Subject();
    recent = [];
    healthEntries = {
      recent: vi.fn(() => of(recent)),
      create: vi.fn(() => saved),
      update: vi.fn(() => saved),
      delete: vi.fn(() => deleted),
    };
    sheetRef = { close: vi.fn() };
    confirmed = new Subject();
    await TestBed.configureTestingModule({
      imports: [HealthSheetComponent, translocoTesting()],
      providers: [
        provideNativeDateAdapter(),
        { provide: HealthEntryService, useValue: healthEntries },
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

    it('is titled Health with the time, name, dose, unit and notes rows', () => {
      expect(text('sheet-title')).toBe(en.health.kinds.health);
      const rows = host().textContent!;
      expect(rows).toContain(en.entrySheet.time);
      expect(rows).toContain(en.health.sheet.name);
      expect(rows).toContain(en.health.sheet.dose);
      expect(rows).toContain(en.health.sheet.unit);
      expect(rows).toContain(en.entrySheet.notes);
      expect(rows).not.toContain(en.health.sheet.recent);
      expect(host().querySelector('nala-time-row')).toBeTruthy();
      expect(host().querySelector('nala-chip-choice-row')).toBeTruthy();
      expect(find<HTMLInputElement>('amount')!.getAttribute('inputmode')).toBe('decimal');
      expect(['ml', 'mg', 'drops', 'dose'].map((u) => text(`unit-${u}`))).toEqual([
        'ml',
        'mg',
        'drops',
        'dose',
      ]);
    });

    it('opens at now with an empty name, no amount and no unit', () => {
      expect(host().querySelector('nala-time-row')?.textContent).toContain(
        `Today ${shortTime(NOW)}`,
      );
      expect(find<HTMLInputElement>('name')!.value).toBe('');
      expect(find<HTMLInputElement>('amount')!.value).toBe('');
      expect(['ml', 'mg', 'drops', 'dose'].some(unitOn)).toBe(false);
    });

    it('keeps Save disabled while the name is blank', async () => {
      expect(save().disabled).toBe(true);

      await type('name', '   ');
      expect(save().disabled).toBe(true);
      expect(text('name-error')).toBe(en.health.errors.nameRequired);

      await type('name', 'Paracetamol');
      expect(save().disabled).toBe(false);
    });

    it('saves a dose without an amount, the name trimmed', async () => {
      await type('name', '  Vitamin D ');
      save().click();
      await settle();

      expect(healthEntries.create).toHaveBeenCalledWith(
        'b1',
        { time: NOW.toISOString(), name: 'Vitamin D', amount: null, unit: null, notes: null },
        expect.stringMatching(/^[0-9a-f-]{36}$/),
      );
    });

    it('sends the amount with its unit', async () => {
      await type('name', 'Paracetamol');
      await type('amount', '2.5');
      await tapUnit('ml');
      save().click();
      await settle();

      expect(fieldsSent()).toMatchObject({ amount: 2.5, unit: 'ml' });
    });

    for (const amount of ['0', '1000.01', '-1']) {
      it(`refuses an amount of ${amount}`, async () => {
        await type('name', 'Paracetamol');
        await tapUnit('ml');
        await type('amount', amount);

        expect(text('amount-error')).toBe(en.health.errors.amountRange);
        expect(save().disabled).toBe(true);
      });
    }

    it('refuses more than 2 decimals', async () => {
      await type('name', 'Paracetamol');
      await tapUnit('ml');
      await type('amount', '2.555');

      expect(text('amount-error')).toBe(en.health.errors.amountDecimals);
      expect(save().disabled).toBe(true);
    });

    it('accepts amounts from 0.01 to 1000', async () => {
      await type('name', 'Paracetamol');
      await tapUnit('mg');
      for (const amount of ['0.01', '1000', '12.25']) {
        await type('amount', amount);
        expect(save().disabled).toBe(false);
      }
    });

    it('asks for a unit once an amount is given', async () => {
      await type('name', 'Paracetamol');
      expect(host().textContent).not.toContain(en.health.errors.unitRequired);

      await type('amount', '10');
      expect(save().disabled).toBe(true);
      expect(host().textContent).toContain(en.health.errors.unitRequired);

      await tapUnit('drops');
      expect(save().disabled).toBe(false);
      expect(host().textContent).not.toContain(en.health.errors.unitRequired);
    });

    it('saves the unit as null once the amount is cleared', async () => {
      await type('name', 'Paracetamol');
      await type('amount', '5');
      await tapUnit('mg');
      await type('amount', '');
      expect(save().disabled).toBe(false);
      save().click();
      await settle();

      expect(fieldsSent()).toMatchObject({ amount: null, unit: null });
    });

    it('refuses a time in the future (1 minute tolerance)', async () => {
      await type('name', 'Paracetamol');
      const time = fixture.componentInstance.form.controls.time;
      time.setValue(new Date(NOW.getTime() + 60_000));
      await settle();
      expect(save().disabled).toBe(false);

      time.setValue(new Date(NOW.getTime() + 5 * 60_000));
      await settle();
      expect(save().disabled).toBe(true);
    });

    it('closes with the saved dose', async () => {
      await type('name', 'Paracetamol');
      save().click();
      const healthEntry = aHealthEntry();
      saved.next({ ok: true, entry: healthEntry });
      await settle();

      expect(sheetRef.close).toHaveBeenCalledWith({ saved: healthEntry });
    });

    it('keeps the same client id when Save is tried again', async () => {
      await type('name', 'Paracetamol');
      save().click();
      await failSave();
      save().click();
      await settle();

      const ids = healthEntries.create.mock.calls.map((call) => call[2]);
      expect(ids).toHaveLength(2);
      expect(ids[0]).toBe(ids[1]);
    });

    it('shows a form error when saving fails', async () => {
      await type('name', 'Paracetamol');
      save().click();
      saved.next({ ok: false, errors: { form: 'babyNotFound' } });
      await settle();

      expect(text('form-error')).toBe(en.health.errors.babyNotFound);
      expect(sheetRef.close).not.toHaveBeenCalled();
    });

    it('closes once the dose is kept on the device (offline)', async () => {
      await type('name', 'Paracetamol');
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
    const healthEntry = aHealthEntry({
      id: 'm7',
      time: time.toISOString(),
      name: 'Vitamin D',
      amount: 4,
      unit: 'drops',
      notes: 'morning',
    });

    it('opens with its values', async () => {
      await render(healthEntry);

      expect(fixture.componentInstance.form.controls.time.value).toEqual(time);
      expect(find<HTMLInputElement>('name')!.value).toBe('Vitamin D');
      expect(find<HTMLInputElement>('amount')!.value).toBe('4');
      expect(unitOn('drops')).toBe(true);
      expect(find<HTMLTextAreaElement>('notes-input')!.value).toBe('morning');
    });

    it('replaces its values on Save and closes with the dose', async () => {
      await render(healthEntry);
      await type('name', 'Ibuprofen');
      await type('amount', '50');
      await tapUnit('mg');
      save().click();
      await settle();

      expect(healthEntries.update).toHaveBeenCalledWith('m7', {
        time: time.toISOString(),
        name: 'Ibuprofen',
        amount: 50,
        unit: 'mg',
        notes: 'morning',
      });
      const updated = aHealthEntry({ ...healthEntry, name: 'Ibuprofen', amount: 50, unit: 'mg' });
      saved.next({ ok: true, entry: updated });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ saved: updated });
    });

    it('discards the form edits on ×', async () => {
      await render(healthEntry);
      await type('name', 'Ibuprofen');

      find<HTMLButtonElement>('sheet-close')!.click();
      confirmed.next(true);
      await settle();

      expect(healthEntries.update).not.toHaveBeenCalled();
      expect(sheetRef.close).toHaveBeenCalledWith();
    });

    it('shows a form error when the dose no longer exists', async () => {
      await render(healthEntry);
      save().click();
      saved.next({ ok: false, errors: { form: 'healthEntryNotFound' } });
      await settle();

      expect(text('form-error')).toBe(en.health.errors.healthEntryNotFound);
    });

    it('says who logged it and who edited it last, and when', async () => {
      const updatedAt = new Date(2026, 9, 3, 11, 40).toISOString();
      await render(
        aHealthEntry({ ...healthEntry, updatedBy: { id: 'u2', displayName: 'Ben' }, updatedAt }),
      );

      expect(
        host().querySelector('nala-entry-audit')?.textContent?.replace(/\s+/g, ' ').trim(),
      ).toBe(`Logged by Anna · Edited by Ben, ${shortTime(new Date(updatedAt))}`);
    });

    it('deletes it after confirmation and closes with its id', async () => {
      await render(healthEntry);

      find<HTMLButtonElement>('entry-delete')!.click();
      expect(healthEntries.delete).not.toHaveBeenCalled();
      confirmed.next(true);
      await settle();
      expect(healthEntries.delete).toHaveBeenCalledWith('m7');

      deleted.next({ ok: true });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ deleted: 'm7' });
    });

    it('closes once the delete is kept on the device (offline)', async () => {
      await render(healthEntry);

      find<HTMLButtonElement>('entry-delete')!.click();
      confirmed.next(true);
      deleted.next({ ok: true, queued: true });
      await settle();

      expect(sheetRef.close).toHaveBeenCalledWith({ queued: true });
    });

    it('keeps the sheet open when deleting fails', async () => {
      await render(healthEntry);

      find<HTMLButtonElement>('entry-delete')!.click();
      confirmed.next(true);
      deleted.next({ ok: false, errors: { form: 'unknown' } });
      await settle();

      expect(sheetRef.close).not.toHaveBeenCalled();
      expect(text('form-error')).toBe(en.health.errors.unknown);
    });
  });

  describe('recent names', () => {
    beforeEach(() => {
      recent = [
        { name: 'Vitamin D', amount: 4, unit: 'drops' },
        { name: 'Paracetamol', amount: 2.5, unit: 'ml' },
        { name: 'Saline', amount: null, unit: null },
      ];
    });

    it("loads the selected baby's recent names", async () => {
      await render();

      expect(healthEntries.recent).toHaveBeenCalledWith('b1');
    });

    it('shows them as chips in the order given, between the name and the dose', async () => {
      await render();
      const rows = [...host().querySelectorAll('nala-form-row')].map((r) => r.textContent!);
      const at = (label: string) => rows.findIndex((r) => r.includes(label));

      expect(at(en.health.sheet.recent)).toBe(at(en.health.sheet.name) + 1);
      expect(at(en.health.sheet.dose)).toBe(at(en.health.sheet.recent) + 1);
      expect(
        [...host().querySelectorAll('[data-testid^="recent-"]')].map((c) => c.textContent!.trim()),
      ).toEqual(['Vitamin D', 'Paracetamol', 'Saline']);
    });

    it('hides the row without recent names (none yet, offline, error)', async () => {
      recent = [];
      await render();

      expect(host().textContent).not.toContain(en.health.sheet.recent);
      expect(host().querySelector('[data-testid^="recent-"]')).toBeNull();
    });

    it('fills the name with the tapped chip', async () => {
      await render();
      await tapChip(recentChip('Paracetamol'));

      expect(find<HTMLInputElement>('name')!.value).toBe('Paracetamol');
      expect(fixture.componentInstance.form.dirty).toBe(true);
      expect(chipOn(recentChip('Paracetamol'))).toBe(true);
      expect(save().disabled).toBe(false);
    });

    it('selects the chip matching the typed name, whatever its case', async () => {
      await render();
      await type('name', ' vitamin d ');

      expect(chipOn(recentChip('Vitamin D'))).toBe(true);
      expect(chipOn(recentChip('Paracetamol'))).toBe(false);

      await type('name', 'Ibuprofen');
      expect(chipOn(recentChip('Vitamin D'))).toBe(false);
    });

    it('keeps the name when the selected chip is tapped again', async () => {
      await render();
      await tapChip(recentChip('Paracetamol'));
      await tapChip(recentChip('Paracetamol'));

      expect(find<HTMLInputElement>('name')!.value).toBe('Paracetamol');
      expect(chipOn(recentChip('Paracetamol'))).toBe(true);
    });

    it('shows them when editing a dose too', async () => {
      await render(aHealthEntry({ babyId: 'b2' }));

      expect(healthEntries.recent).toHaveBeenCalledWith('b2');
      expect(recentChip('Vitamin D')).toBeTruthy();
    });
  });

  describe('last dose', () => {
    beforeEach(async () => {
      recent = [
        { name: 'Vitamin D', amount: 1, unit: 'drops' },
        { name: 'Paracetamol', amount: 2.5, unit: 'ml' },
        { name: 'Saline', amount: null, unit: null },
      ];
      await render();
    });

    it("offers the matching name's last dose while the amount is empty; Yes fills amount and unit", async () => {
      await type('name', 'Paracetamol');

      expect(text('suggestion-text')).toBe('Use last dose: 2.5 ml?');

      find<HTMLButtonElement>('suggestion-accept')!.click();
      await settle();

      expect(find<HTMLInputElement>('amount')!.value).toBe('2.5');
      expect(unitOn('ml')).toBe(true);
      expect(find('suggestion-text')).toBeNull();
      save().click();
      await settle();
      expect(fieldsSent()).toMatchObject({ name: 'Paracetamol', amount: 2.5, unit: 'ml' });
    });

    it('matches the name whatever its case, and writes the dose in the singular for 1', async () => {
      await type('name', 'VITAMIN D');

      expect(text('suggestion-text')).toBe('Use last dose: 1 drop?');
    });

    it('offers nothing once an amount is typed', async () => {
      await type('name', 'Paracetamol');
      await type('amount', '5');

      expect(find('suggestion-text')).toBeNull();
    });

    it('offers nothing for a name that is not recent', async () => {
      await type('name', 'Ibuprofen');

      expect(find('suggestion-text')).toBeNull();
    });

    it('offers nothing when the last dose of that name had no amount', async () => {
      await type('name', 'Saline');

      expect(find('suggestion-text')).toBeNull();
    });
  });
});
