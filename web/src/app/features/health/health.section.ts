import { SectionDefinition } from '../../core/sections/section.models';

/**
 * The Health section (spec 09): one kind, so + opens the Health sheet directly. Its components are
 * loaded on demand, keeping them out of the initial bundle.
 */
export const HEALTH_SECTION: SectionDefinition = {
  key: 'health',
  icon: 'medical_services',
  loadCard: () => import('./health-card/health-card.component').then((m) => m.HealthCardComponent),
  kinds: [
    {
      key: 'health',
      icon: 'medical_services',
      label: 'health.kinds.health',
      loadSheet: () =>
        import('./health-sheet/health-sheet.component').then((m) => m.HealthSheetComponent),
    },
  ],
  loadSource: () => import('./health-history-source').then((m) => m.HealthHistorySource),
};
