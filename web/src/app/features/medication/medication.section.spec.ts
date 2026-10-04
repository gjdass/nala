import en from '../../../../public/i18n/en.json';
import fr from '../../../../public/i18n/fr.json';
import { MedicationCardComponent } from './medication-card/medication-card.component';
import { MedicationHistoryComponent } from './medication-history/medication-history.component';
import { MedicationSheetComponent } from './medication-sheet/medication-sheet.component';
import { MEDICATION_SECTION } from './medication.section';

describe('MEDICATION_SECTION', () => {
  it('is the medication section, with its icon', () => {
    expect(MEDICATION_SECTION.key).toBe('medication');
    expect(MEDICATION_SECTION.icon).toBe('medication');
  });

  it('loads its card and history on demand', async () => {
    expect(await MEDICATION_SECTION.loadCard()).toBe(MedicationCardComponent);
    expect(await MEDICATION_SECTION.loadHistory()).toBe(MedicationHistoryComponent);
  });

  it('has a single kind, so + opens the Medication sheet directly', async () => {
    expect(MEDICATION_SECTION.kinds.map(({ key, icon, label }) => ({ key, icon, label }))).toEqual([
      { key: 'medication', icon: 'medication', label: 'medication.kinds.medication' },
    ]);
    expect(await MEDICATION_SECTION.kinds[0].loadSheet()).toBe(MedicationSheetComponent);
    expect(en.medication.kinds.medication).toBe('Medication');
    expect(fr.medication.kinds.medication).toBe('Médicament');
  });
});
