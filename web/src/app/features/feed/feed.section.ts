import { SectionDefinition } from '../../core/sections/section.models';
import { FEED_KIND_ICONS } from './feed-kinds';

/**
 * The Feed section (spec 05). Its components are loaded on demand, keeping them out of the initial
 * bundle. Breastfeed and solids come with their slices.
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
  ],
  loadHistory: () =>
    import('./feed-history/feed-history.component').then((m) => m.FeedHistoryComponent),
};
