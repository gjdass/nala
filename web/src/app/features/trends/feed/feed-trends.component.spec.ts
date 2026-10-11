import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { DataRefreshService } from '../../../core/refresh/data-refresh.service';
import { FeedTrendDay } from '../../../core/trends/trends.models';
import { TrendsService } from '../../../core/trends/trends.service';
import { fakeDataRefresh } from '../../../testing/data-refresh';
import { translocoTesting } from '../../../testing/transloco-testing';
import { TrendsPeriod } from '../trends-period';
import { FeedTrendsComponent } from './feed-trends.component';

@Component({
  imports: [FeedTrendsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-feed-trends [babyId]="babyId()" [period]="period()" [today]="today" />`,
})
class HostComponent {
  readonly babyId = signal('b1');
  readonly period = signal<TrendsPeriod>({ from: new Date(2026, 9, 3), to: new Date(2026, 9, 9) });
  readonly today = new Date(2026, 9, 9);
}

describe('FeedTrendsComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let responses: Subject<FeedTrendDay[]>[];
  let feeds: ReturnType<typeof vi.fn>;
  let refresh: ReturnType<typeof fakeDataRefresh>;

  const host = () => fixture.nativeElement as HTMLElement;
  const norm = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
  const cards = () => [...host().querySelectorAll('nala-metric-card')];
  const inCard = (index: number, testId: string) =>
    cards()[index]?.querySelectorAll(`[data-testid="${testId}"]`) ?? [];
  const textIn = (index: number, testId: string) => norm(inCard(index, testId)[0]?.textContent);
  const barDates = (index: number) =>
    [...inCard(index, 'bar')].map((b) => b.getAttribute('data-date'));
  const settle = async () => {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  };
  const respond = async (days: FeedTrendDay[]) => {
    responses[responses.length - 1].next(days);
    await settle();
  };

  const day = (
    date: string,
    [breastfeed, bottle, solids]: number[],
    [breastMilk, formula]: number[],
    [left, right]: number[],
    [gapSecondsSum, gapCount]: number[],
  ): FeedTrendDay => ({
    date,
    count: { breastfeed, bottle, solids },
    bottleMl: { breastMilk, formula },
    breastSeconds: { left, right },
    gapSecondsSum,
    gapCount,
  });
  // The 8th: breastfeeds only (0 ml of bottle). The 9th is today.
  const week = [
    day('2026-10-07', [6, 1, 1], [0, 120], [1500, 1200], [21600, 3]),
    day('2026-10-08', [4, 0, 0], [0, 0], [900, 1500], [10800, 1]),
    day('2026-10-09', [2, 1, 0], [90, 0], [600, 0], [7200, 1]),
  ];

  beforeEach(async () => {
    responses = [];
    feeds = vi.fn(() => {
      const response = new Subject<FeedTrendDay[]>();
      responses.push(response);
      return response;
    });
    refresh = fakeDataRefresh();
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
      providers: [
        { provide: TrendsService, useValue: { feeds } },
        { provide: DataRefreshService, useValue: refresh },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await settle();
  });

  it("loads the baby's feeds of the period, and again on the reload signal", async () => {
    expect(feeds).toHaveBeenCalledWith('b1', {
      from: new Date(2026, 9, 3),
      to: new Date(2026, 9, 9),
    });
    await respond([]);

    refresh.reload.set(1);
    await settle();
    expect(feeds).toHaveBeenCalledTimes(2);
  });

  it('shows the four Feed cards in the feed scheme', async () => {
    await respond(week);

    expect(cards().map((_, i) => textIn(i, 'metric-title'))).toEqual([
      en.trends.cards.feeds,
      en.trends.cards.bottle,
      en.trends.cards.breastfeeding,
      en.trends.cards.timeBetweenFeeds,
    ]);
    expect(
      cards().every((card) =>
        card.querySelector('mat-card')!.classList.contains('nala-scheme-feed'),
      ),
    ).toBe(true);
  });

  it('shows the Feeds card stacked by kind, its feeds per day over past data days', async () => {
    await respond(week);

    // (8 + 4) / 2: today is left out.
    expect(textIn(0, 'metric-headline')).toBe(`6 ${en.trends.perDay}`);
    expect(barDates(0)).toEqual(['2026-10-07', '2026-10-08', '2026-10-09']);
    expect(inCard(0, 'bar')[0].getAttribute('aria-label')).toBe(
      `Wed, Oct 7: 8 (${en.trends.breastfeed} 6, ${en.trends.bottle} 1, ${en.trends.solids} 1)`,
    );
    expect(inCard(0, 'bar')[2].classList.contains('partial')).toBe(true);
  });

  it('shows the Bottle card stacked by milk type, a breastfeed-only day counting 0 ml', async () => {
    await respond(week);

    expect(textIn(1, 'metric-headline')).toBe(`60 ml ${en.trends.perDay}`);
    expect(inCard(1, 'bar')[0].getAttribute('aria-label')).toBe(
      `Wed, Oct 7: 120 ml (${en.feed.milkType.breastMilk} 0 ml, ${en.feed.milkType.formula} 120 ml)`,
    );
  });

  it("shows the Breastfeeding card per side, with the period's left / right split", async () => {
    await respond(week);

    // (2700 + 2400) / 2 s; left 2400 of 5100 s, today left out.
    expect(textIn(2, 'metric-headline')).toBe(`42m ${en.trends.perDay} · L 47% · R 53%`);
    expect(inCard(2, 'bar')[0].getAttribute('aria-label')).toBe(
      `Wed, Oct 7: 45m (${en.trends.left} 25m, ${en.trends.right} 20m)`,
    );
  });

  it('hides the split when the period has no breastfeeding', async () => {
    await respond([day('2026-10-07', [0, 2, 0], [0, 240], [0, 0], [0, 0])]);

    expect(textIn(2, 'metric-headline')).not.toContain('·');
  });

  it('shows the Time between feeds card: the average gap per day, pooled in the headline', async () => {
    await respond([...week, day('2026-10-06', [1, 0, 0], [0, 0], [600, 0], [0, 0])].sort((a, b) =>
      a.date.localeCompare(b.date),
    ));

    // (21600 + 10800) / (3 + 1) s, not the average of the daily averages.
    expect(textIn(3, 'metric-headline')).toBe('2h 15m');
    // The 6th has a single feed: no gap, no bar.
    expect(barDates(3)).toEqual(['2026-10-07', '2026-10-08', '2026-10-09']);
    expect(inCard(3, 'bar')[0].getAttribute('aria-label')).toBe('Wed, Oct 7: 2h');
  });

  it('shows "Nothing logged in this period" on the gap card when no day has a gap', async () => {
    await respond([day('2026-10-07', [1, 0, 0], [0, 0], [600, 0], [0, 0])]);

    expect(textIn(0, 'metric-empty')).toBe('');
    expect(textIn(3, 'metric-empty')).toBe(en.history.emptyPeriod);
  });

  it('shows "Nothing logged in this period" on every card without a data day', async () => {
    await respond([]);

    expect(cards().map((_, i) => textIn(i, 'metric-empty'))).toEqual(
      Array(4).fill(en.history.emptyPeriod),
    );
  });
});
