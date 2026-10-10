import en from '../../../../public/i18n/en.json';
import { BottleSheetComponent } from './bottle-sheet/bottle-sheet.component';
import { BreastfeedSheetComponent } from './breastfeed-sheet/breastfeed-sheet.component';
import { FeedCardComponent } from './feed-card/feed-card.component';
import { SolidsSheetComponent } from './solids-sheet/solids-sheet.component';
import { FeedHistorySource } from './feed-history-source';
import { FEED_SECTION } from './feed.section';

describe('FEED_SECTION', () => {
  it('is the feed section, with its icon', () => {
    expect(FEED_SECTION.key).toBe('feed');
    expect(FEED_SECTION.icon).toBe('restaurant');
  });

  it('loads its card on demand', async () => {
    expect(await FEED_SECTION.loadCard()).toBe(FeedCardComponent);
  });

  it('loads its History source on demand', async () => {
    expect(await FEED_SECTION.loadSource()).toBe(FeedHistorySource);
  });

  it('has the bottle, breastfeed and solids kinds, so + opens the kind picker', async () => {
    expect(FEED_SECTION.kinds.map(({ key, icon, label }) => ({ key, icon, label }))).toEqual([
      { key: 'bottle', icon: 'water_bottle', label: 'feed.kinds.bottle' },
      { key: 'breastfeed', icon: 'breastfeeding', label: 'feed.kinds.breastfeed' },
      { key: 'solids', icon: 'nutrition', label: 'feed.kinds.solids' },
    ]);
    expect(await FEED_SECTION.kinds[0].loadSheet()).toBe(BottleSheetComponent);
    expect(await FEED_SECTION.kinds[1].loadSheet()).toBe(BreastfeedSheetComponent);
    expect(await FEED_SECTION.kinds[2].loadSheet()).toBe(SolidsSheetComponent);
    expect(en.feed.kinds.bottle).toBe('Bottle Feed');
    expect(en.feed.kinds.breastfeed).toBe('Breastfeed');
    expect(en.feed.kinds.solids).toBe('Solids');
  });
});
