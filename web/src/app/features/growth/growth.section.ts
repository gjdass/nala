import { SectionDefinition } from '../../core/sections/section.models';

/**
 * The Growth section (spec 10): the Measurement kind only for now (milestones come with slice 2), so
 * + opens the Measurement sheet directly. Its components are loaded on demand, keeping them out of
 * the initial bundle.
 */
export const GROWTH_SECTION: SectionDefinition = {
  key: 'growth',
  icon: 'monitor_weight',
  loadCard: () => import('./growth-card/growth-card.component').then((m) => m.GrowthCardComponent),
  kinds: [
    {
      key: 'measurement',
      icon: 'monitor_weight',
      label: 'growth.kinds.measurement',
      loadSheet: () =>
        import('./measurement-sheet/measurement-sheet.component').then(
          (m) => m.MeasurementSheetComponent,
        ),
    },
  ],
  loadHistory: () =>
    import('./growth-history/growth-history.component').then((m) => m.GrowthHistoryComponent),
};
