import en from '../../../../public/i18n/en.json';
import { BottleSheetComponent } from './bottle-sheet/bottle-sheet.component';
import { FeedCardComponent } from './feed-card/feed-card.component';
import { FeedHistoryComponent } from './feed-history/feed-history.component';
import { FEED_SECTION } from './feed.section';

describe('FEED_SECTION', () => {
  it('is the feed section, with its icon', () => {
    expect(FEED_SECTION.key).toBe('feed');
    expect(FEED_SECTION.icon).toBe('restaurant');
  });

  it('loads its card and history on demand', async () => {
    expect(await FEED_SECTION.loadCard()).toBe(FeedCardComponent);
    expect(await FEED_SECTION.loadHistory()).toBe(FeedHistoryComponent);
  });

  it('has the bottle kind only for now, so + opens the Bottle sheet directly', async () => {
    expect(FEED_SECTION.kinds.map(({ key, icon, label }) => ({ key, icon, label }))).toEqual([
      { key: 'bottle', icon: 'water_bottle', label: 'feed.kinds.bottle' },
    ]);
    expect(await FEED_SECTION.kinds[0].loadSheet()).toBe(BottleSheetComponent);
    expect(en.feed.kinds.bottle).toBe('Bottle Feed');
  });
});
