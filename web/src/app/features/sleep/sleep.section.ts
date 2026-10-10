import { SectionDefinition } from '../../core/sections/section.models';

/**
 * The Sleep section (spec 06): one kind, so + opens the Sleep sheet directly. Its components are
 * loaded on demand, keeping them out of the initial bundle.
 */
export const SLEEP_SECTION: SectionDefinition = {
  key: 'sleep',
  icon: 'bedtime',
  loadCard: () => import('./sleep-card/sleep-card.component').then((m) => m.SleepCardComponent),
  kinds: [
    {
      key: 'sleep',
      icon: 'bedtime',
      label: 'sleep.kinds.sleep',
      loadSheet: () =>
        import('./sleep-sheet/sleep-sheet.component').then((m) => m.SleepSheetComponent),
    },
  ],
  loadSource: () => import('./sleep-history-source').then((m) => m.SleepHistorySource),
};
