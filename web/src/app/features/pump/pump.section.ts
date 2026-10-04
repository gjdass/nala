import { SectionDefinition } from '../../core/sections/section.models';

/**
 * The Pump section (spec 08): one kind, so + opens the Pump sheet directly. Its components are
 * loaded on demand, keeping them out of the initial bundle.
 */
export const PUMP_SECTION: SectionDefinition = {
  key: 'pump',
  icon: 'water_drop',
  loadCard: () => import('./pump-card/pump-card.component').then((m) => m.PumpCardComponent),
  kinds: [
    {
      key: 'pump',
      icon: 'water_drop',
      label: 'pump.kinds.pump',
      loadSheet: () =>
        import('./pump-sheet/pump-sheet.component').then((m) => m.PumpSheetComponent),
    },
  ],
  loadHistory: () =>
    import('./pump-history/pump-history.component').then((m) => m.PumpHistoryComponent),
};
