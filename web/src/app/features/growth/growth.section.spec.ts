import en from '../../../../public/i18n/en.json';
import fr from '../../../../public/i18n/fr.json';
import { GrowthCardComponent } from './growth-card/growth-card.component';
import { MeasurementSheetComponent } from './measurement-sheet/measurement-sheet.component';
import { MilestoneSheetComponent } from './milestone-sheet/milestone-sheet.component';
import { GrowthHistorySource } from './growth-history-source';
import { GROWTH_SECTION } from './growth.section';

describe('GROWTH_SECTION', () => {
  it('is the Growth section (FR Croissance), with its icon', () => {
    expect(en.sections.growth).toBe('Growth');
    expect(fr.sections.growth).toBe('Croissance');
    expect(GROWTH_SECTION.key).toBe('growth');
    expect(GROWTH_SECTION.icon).toBe('monitor_weight');
  });

  it('loads its card on demand', async () => {
    expect(await GROWTH_SECTION.loadCard()).toBe(GrowthCardComponent);
  });

  it('loads its History source on demand', async () => {
    expect(await GROWTH_SECTION.loadSource()).toBe(GrowthHistorySource);
  });

  it('has two kinds, Measurement and Milestone, so + opens the kind picker', async () => {
    expect(GROWTH_SECTION.kinds.map(({ key, icon, label }) => ({ key, icon, label }))).toEqual([
      { key: 'measurement', icon: 'monitor_weight', label: 'growth.kinds.measurement' },
      { key: 'milestone', icon: 'celebration', label: 'growth.kinds.milestone' },
    ]);
    expect(await GROWTH_SECTION.kinds[0].loadSheet()).toBe(MeasurementSheetComponent);
    expect(await GROWTH_SECTION.kinds[1].loadSheet()).toBe(MilestoneSheetComponent);
    expect(en.growth.kinds.measurement).toBe('Measurement');
    expect(fr.growth.kinds.measurement).toBe('Mesure');
    expect(en.growth.kinds.milestone).toBe('Milestone');
    expect(fr.growth.kinds.milestone).toBe('Étape');
  });
});
