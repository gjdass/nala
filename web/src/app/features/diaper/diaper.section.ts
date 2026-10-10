import { SectionDefinition } from '../../core/sections/section.models';

/**
 * The Diaper section (spec 07): one kind, so + opens the Diaper sheet directly. Its components are
 * loaded on demand, keeping them out of the initial bundle.
 */
export const DIAPER_SECTION: SectionDefinition = {
  key: 'diaper',
  icon: 'baby_changing_station',
  loadCard: () => import('./diaper-card/diaper-card.component').then((m) => m.DiaperCardComponent),
  kinds: [
    {
      key: 'diaper',
      icon: 'baby_changing_station',
      label: 'diaper.kinds.diaper',
      loadSheet: () =>
        import('./diaper-sheet/diaper-sheet.component').then((m) => m.DiaperSheetComponent),
    },
  ],
  loadSource: () => import('./diaper-history-source').then((m) => m.DiaperHistorySource),
};
