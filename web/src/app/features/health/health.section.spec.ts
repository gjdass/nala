import en from '../../../../public/i18n/en.json';
import fr from '../../../../public/i18n/fr.json';
import { HealthCardComponent } from './health-card/health-card.component';
import { HealthHistoryComponent } from './health-history/health-history.component';
import { HealthSheetComponent } from './health-sheet/health-sheet.component';
import { HealthHistorySource } from './health-history-source';
import { HEALTH_SECTION } from './health.section';

describe('HEALTH_SECTION', () => {
  it('is the Health section (FR Santé), with its icon', () => {
    expect(en.sections.health).toBe('Health');
    expect(fr.sections.health).toBe('Santé');
    expect(HEALTH_SECTION.key).toBe('health');
    expect(HEALTH_SECTION.icon).toBe('medical_services');
  });

  it('loads its card and history on demand', async () => {
    expect(await HEALTH_SECTION.loadCard()).toBe(HealthCardComponent);
    expect(await HEALTH_SECTION.loadHistory()).toBe(HealthHistoryComponent);
  });

  it('loads its History source on demand', async () => {
    expect(await HEALTH_SECTION.loadSource()).toBe(HealthHistorySource);
  });

  it('has a single kind, so + opens the Health sheet directly', async () => {
    expect(HEALTH_SECTION.kinds.map(({ key, icon, label }) => ({ key, icon, label }))).toEqual([
      { key: 'health', icon: 'medical_services', label: 'health.kinds.health' },
    ]);
    expect(await HEALTH_SECTION.kinds[0].loadSheet()).toBe(HealthSheetComponent);
    expect(en.health.kinds.health).toBe('Health');
    expect(fr.health.kinds.health).toBe('Santé');
  });
});
