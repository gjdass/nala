import { SectionDefinition } from '../../core/sections/section.models';
import { FEED_KIND_ICONS } from './feed-kinds';

/**
 * The Feed section (spec 05). Its components are loaded on demand, keeping them out of the initial
 * bundle.
 */
export const FEED_SECTION: SectionDefinition = {
  key: 'feed',
  icon: 'restaurant',
  loadCard: () => import('./feed-card/feed-card.component').then((m) => m.FeedCardComponent),
  kinds: [
    {
      key: 'bottle',
      icon: FEED_KIND_ICONS.bottle,
      label: 'feed.kinds.bottle',
      loadSheet: () =>
        import('./bottle-sheet/bottle-sheet.component').then((m) => m.BottleSheetComponent),
    },
    {
      key: 'breastfeed',
      icon: FEED_KIND_ICONS.breastfeed,
      label: 'feed.kinds.breastfeed',
      loadSheet: () =>
        import('./breastfeed-sheet/breastfeed-sheet.component').then(
          (m) => m.BreastfeedSheetComponent,
        ),
    },
    {
      key: 'solids',
      icon: FEED_KIND_ICONS.solids,
      label: 'feed.kinds.solids',
      loadSheet: () =>
        import('./solids-sheet/solids-sheet.component').then((m) => m.SolidsSheetComponent),
    },
  ],
  loadSource: () => import('./feed-history-source').then((m) => m.FeedHistorySource),
};
