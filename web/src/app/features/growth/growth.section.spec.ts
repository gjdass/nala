import en from '../../../../public/i18n/en.json';
import fr from '../../../../public/i18n/fr.json';
import { GrowthCardComponent } from './growth-card/growth-card.component';
import { GrowthHistoryComponent } from './growth-history/growth-history.component';
import { MeasurementSheetComponent } from './measurement-sheet/measurement-sheet.component';
import { GROWTH_SECTION } from './growth.section';

describe('GROWTH_SECTION', () => {
  it('is the Growth section (FR Croissance), with its icon', () => {
    expect(en.sections.growth).toBe('Growth');
    expect(fr.sections.growth).toBe('Croissance');
    expect(GROWTH_SECTION.key).toBe('growth');
    expect(GROWTH_SECTION.icon).toBe('monitor_weight');
  });

  it('loads its card and history on demand', async () => {
    expect(await GROWTH_SECTION.loadCard()).toBe(GrowthCardComponent);
    expect(await GROWTH_SECTION.loadHistory()).toBe(GrowthHistoryComponent);
  });

  it('has the Measurement kind only for now, so + opens its sheet directly', async () => {
    expect(GROWTH_SECTION.kinds.map(({ key, icon, label }) => ({ key, icon, label }))).toEqual([
      { key: 'measurement', icon: 'monitor_weight', label: 'growth.kinds.measurement' },
    ]);
    expect(await GROWTH_SECTION.kinds[0].loadSheet()).toBe(MeasurementSheetComponent);
    expect(en.growth.kinds.measurement).toBe('Measurement');
    expect(fr.growth.kinds.measurement).toBe('Mesure');
  });
});
