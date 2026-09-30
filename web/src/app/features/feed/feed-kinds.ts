import { FeedKind } from '../../core/feeds/feed.models';

/** Material Symbols name of each kind of feed (spec 05; the bundled font has no baby bottle or spoon glyph). */
export const FEED_KIND_ICONS: Record<FeedKind, string> = {
  bottle: 'water_bottle',
  breastfeed: 'breastfeeding',
  solids: 'nutrition',
};
