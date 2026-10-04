import en from '../../../../public/i18n/en.json';
import fr from '../../../../public/i18n/fr.json';
import { DiaperCardComponent } from './diaper-card/diaper-card.component';
import { DiaperHistoryComponent } from './diaper-history/diaper-history.component';
import { DiaperSheetComponent } from './diaper-sheet/diaper-sheet.component';
import { DIAPER_SECTION } from './diaper.section';

describe('DIAPER_SECTION', () => {
  it('is the diaper section, with its icon', () => {
    expect(DIAPER_SECTION.key).toBe('diaper');
    expect(DIAPER_SECTION.icon).toBe('baby_changing_station');
  });

  it('loads its card and history on demand', async () => {
    expect(await DIAPER_SECTION.loadCard()).toBe(DiaperCardComponent);
    expect(await DIAPER_SECTION.loadHistory()).toBe(DiaperHistoryComponent);
  });

  it('has a single kind, so + opens the Diaper sheet directly', async () => {
    expect(DIAPER_SECTION.kinds.map(({ key, icon, label }) => ({ key, icon, label }))).toEqual([
      { key: 'diaper', icon: 'baby_changing_station', label: 'diaper.kinds.diaper' },
    ]);
    expect(await DIAPER_SECTION.kinds[0].loadSheet()).toBe(DiaperSheetComponent);
    expect(en.diaper.kinds.diaper).toBe('Diaper');
    expect(fr.diaper.kinds.diaper).toBe('Couche');
  });
});
