import en from '../../../../public/i18n/en.json';
import fr from '../../../../public/i18n/fr.json';
import { SleepCardComponent } from './sleep-card/sleep-card.component';
import { SleepHistoryComponent } from './sleep-history/sleep-history.component';
import { SleepSheetComponent } from './sleep-sheet/sleep-sheet.component';
import { SLEEP_SECTION } from './sleep.section';

describe('SLEEP_SECTION', () => {
  it('is the sleep section, with its icon', () => {
    expect(SLEEP_SECTION.key).toBe('sleep');
    expect(SLEEP_SECTION.icon).toBe('bedtime');
  });

  it('loads its card and history on demand', async () => {
    expect(await SLEEP_SECTION.loadCard()).toBe(SleepCardComponent);
    expect(await SLEEP_SECTION.loadHistory()).toBe(SleepHistoryComponent);
  });

  it('has a single kind, so + opens the Sleep sheet directly', async () => {
    expect(SLEEP_SECTION.kinds.map(({ key, icon, label }) => ({ key, icon, label }))).toEqual([
      { key: 'sleep', icon: 'bedtime', label: 'sleep.kinds.sleep' },
    ]);
    expect(await SLEEP_SECTION.kinds[0].loadSheet()).toBe(SleepSheetComponent);
    expect(en.sleep.kinds.sleep).toBe('Sleep');
    expect(fr.sleep.kinds.sleep).toBe('Sommeil');
  });
});
