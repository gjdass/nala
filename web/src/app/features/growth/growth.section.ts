import { SectionDefinition } from '../../core/sections/section.models';

/**
 * The Growth section (spec 10): two kinds, Measurement and Milestone, so + opens the kind picker. Its
 * components are loaded on demand, keeping them out of the initial bundle.
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
    {
      key: 'milestone',
      icon: 'celebration',
      label: 'growth.kinds.milestone',
      loadSheet: () =>
        import('./milestone-sheet/milestone-sheet.component').then(
          (m) => m.MilestoneSheetComponent,
        ),
    },
  ],
  loadHistory: () =>
    import('./growth-history/growth-history.component').then((m) => m.GrowthHistoryComponent),
  loadSource: () => import('./growth-history-source').then((m) => m.GrowthHistorySource),
};
