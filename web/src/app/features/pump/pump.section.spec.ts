import en from '../../../../public/i18n/en.json';
import fr from '../../../../public/i18n/fr.json';
import { PumpCardComponent } from './pump-card/pump-card.component';
import { PumpHistoryComponent } from './pump-history/pump-history.component';
import { PumpSheetComponent } from './pump-sheet/pump-sheet.component';
import { PumpHistorySource } from './pump-history-source';
import { PUMP_SECTION } from './pump.section';

describe('PUMP_SECTION', () => {
  it('is the pump section, with its icon', () => {
    expect(PUMP_SECTION.key).toBe('pump');
    expect(PUMP_SECTION.icon).toBe('water_drop');
  });

  it('loads its card and history on demand', async () => {
    expect(await PUMP_SECTION.loadCard()).toBe(PumpCardComponent);
    expect(await PUMP_SECTION.loadHistory()).toBe(PumpHistoryComponent);
  });

  it('loads its History source on demand', async () => {
    expect(await PUMP_SECTION.loadSource()).toBe(PumpHistorySource);
  });

  it('has a single kind, so + opens the Pump sheet directly', async () => {
    expect(PUMP_SECTION.kinds.map(({ key, icon, label }) => ({ key, icon, label }))).toEqual([
      { key: 'pump', icon: 'water_drop', label: 'pump.kinds.pump' },
    ]);
    expect(await PUMP_SECTION.kinds[0].loadSheet()).toBe(PumpSheetComponent);
    expect(en.pump.kinds.pump).toBe('Pump');
    expect(fr.pump.kinds.pump).toBe('Tire-lait');
  });
});
