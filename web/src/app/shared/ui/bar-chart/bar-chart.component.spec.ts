import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { translocoTesting } from '../../../testing/transloco-testing';
import { BarChartComponent, BarDatum, BarSeries } from './bar-chart.component';

const hours = (v: number) => `${v}h`;

@Component({
  imports: [BarChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p data-testid="outside">Outside</p>
    <nala-bar-chart
      [bars]="bars()"
      [series]="series()"
      [format]="format"
      [bucket]="bucket()"
      [layout]="layout()"
      lang="en"
    />`,
})
class HostComponent {
  readonly bars = signal<BarDatum[]>([]);
  readonly series = signal<BarSeries[]>([{ label: 'Night' }, { label: 'Day' }]);
  readonly format = hours;
  readonly bucket = signal<'day' | 'week' | 'month'>('day');
  readonly layout = signal<'stacked' | 'grouped'>('stacked');
}

describe('BarChartComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  const host = () => fixture.nativeElement as HTMLElement;
  const bars = () => [...host().querySelectorAll<SVGGElement>('[data-testid="bar"]')];
  const segments = (bar: Element) => [...bar.querySelectorAll('[data-testid="segment"]')];
  const height = (bar: Element) =>
    segments(bar).reduce((sum, s) => sum + Number(s.getAttribute('height')), 0);
  const tooltip = () => host().querySelector('[data-testid="chart-tooltip"]')?.textContent?.trim();
  const show = async (data: BarDatum[]) => {
    fixture.componentInstance.bars.set(data);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('draws a bar per data day, none for a day without data, and an empty one for a zero day', async () => {
    await show([
      { date: '2026-10-07', values: [2, 1] },
      { date: '2026-10-08', values: null },
      { date: '2026-10-09', values: [0, 0] },
    ]);

    expect(bars().length).toBe(2);
    expect(bars().map((b) => b.getAttribute('data-date'))).toEqual(['2026-10-07', '2026-10-09']);
    expect(height(bars()[1])).toBe(0);
  });

  it('stacks the series, scaled to the tallest bar', async () => {
    await show([
      { date: '2026-10-07', values: [6, 2] },
      { date: '2026-10-08', values: [3, 1] },
    ]);

    expect(height(bars()[0])).toBeCloseTo(100);
    expect(height(bars()[1])).toBeCloseTo(50);
    expect(segments(bars()[0]).map((s) => s.getAttribute('class'))).toEqual([
      'segment series-0',
      'segment series-1',
    ]);
    expect(host().querySelector('[data-testid="chart-max"]')?.textContent?.trim()).toBe('8h');
  });

  it('draws the partial (today) bar lighter', async () => {
    await show([
      { date: '2026-10-08', values: [3, 1] },
      { date: '2026-10-09', values: [1, 1], partial: true },
    ]);

    expect(bars().map((b) => b.classList.contains('partial'))).toEqual([false, true]);
  });

  it('labels each bar with its date, its total and each series', async () => {
    await show([{ date: '2026-10-09', values: [10, 3] }]);

    expect(bars()[0].getAttribute('aria-label')).toBe('Fri, Oct 9: 13h (Night 10h, Day 3h)');
    expect(bars()[0].getAttribute('role')).toBe('button');
    expect(bars()[0].getAttribute('tabindex')).toBe('0');
  });

  it('labels a single series with its value only', async () => {
    fixture.componentInstance.series.set([{ label: 'Longest' }]);
    await show([{ date: '2026-10-09', values: [5] }]);

    expect(bars()[0].getAttribute('aria-label')).toBe('Fri, Oct 9: 5h');
    expect(host().querySelector('[data-testid="chart-legend"]')).toBeNull();
  });

  it('shows a legend for several series', async () => {
    await show([{ date: '2026-10-09', values: [10, 3] }]);

    expect(
      [...host().querySelectorAll('[data-testid="legend-item"]')].map((i) => i.textContent?.trim()),
    ).toEqual(['Night', 'Day']);
  });

  it('shows the tapped bar, another tap replaces it, a tap elsewhere hides it', async () => {
    await show([
      { date: '2026-10-08', values: [8, 2] },
      { date: '2026-10-09', values: [10, 3] },
    ]);
    expect(tooltip()).toBeUndefined();

    bars()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(tooltip()).toBe('Thu, Oct 8: 10h (Night 8h, Day 2h)');

    bars()[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(tooltip()).toBe('Fri, Oct 9: 13h (Night 10h, Day 3h)');

    host().querySelector<HTMLElement>('[data-testid="outside"]')!.click();
    await fixture.whenStable();
    expect(tooltip()).toBeUndefined();
  });

  it('shows a focused bar with Enter', async () => {
    await show([{ date: '2026-10-09', values: [10, 3] }]);

    bars()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();

    expect(tooltip()).toBe('Fri, Oct 9: 13h (Night 10h, Day 3h)');
  });

  it('labels the first day with its month and the other days with their number', async () => {
    await show([
      { date: '2026-10-07', values: [1, 1] },
      { date: '2026-10-08', values: null },
      { date: '2026-10-09', values: [1, 1] },
    ]);

    expect(
      [...host().querySelectorAll('[data-testid="chart-x-label"]')].map((l) =>
        l.textContent?.trim(),
      ),
    ).toEqual(['Oct 7', '8', '9']);
  });

  const xLabels = () =>
    [...host().querySelectorAll('[data-testid="chart-x-label"]')].map((l) => l.textContent?.trim());

  it("labels a week bar with its first day's week and a daily average", async () => {
    fixture.componentInstance.bucket.set('week');
    await show([{ date: '2026-10-04', values: [8, 3] }]);

    expect(bars()[0].getAttribute('aria-label')).toBe(
      'Week of Oct 4: 11h per day (Night 8h, Day 3h)',
    );
    bars()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(tooltip()).toBe('Week of Oct 4: 11h per day (Night 8h, Day 3h)');
  });

  it('labels a month bar with its month, and the axis with months and years', async () => {
    fixture.componentInstance.bucket.set('month');
    const months = ['07', '08', '09', '10', '11', '12'].map((m) => `2026-${m}-01`);
    await show([...months, '2027-01-01', '2027-02-01'].map((date) => ({ date, values: [8, 3] })));

    expect(bars()[0].getAttribute('aria-label')).toBe('July 2026: 11h per day (Night 8h, Day 3h)');
    expect(xLabels()).toEqual(['Jul 2026', 'Sep', 'Nov', 'Jan 2027']);
  });

  describe('grouped', () => {
    beforeEach(async () => {
      fixture.componentInstance.layout.set('grouped');
      fixture.componentInstance.series.set([{ label: 'Wet' }, { label: 'Dirty' }]);
      await fixture.whenStable();
    });

    it('draws the series side by side, each from the baseline, scaled to the tallest one', async () => {
      await show([
        { date: '2026-10-07', values: [6, 2] },
        { date: '2026-10-08', values: [3, 3] },
      ]);

      const [wet, dirty] = segments(bars()[0]);
      expect(Number(wet.getAttribute('x'))).toBeLessThan(Number(dirty.getAttribute('x')));
      for (const segment of [wet, dirty]) {
        const bottom = Number(segment.getAttribute('y')) + Number(segment.getAttribute('height'));
        expect(bottom).toBeCloseTo(100);
      }
      expect(Number(wet.getAttribute('height'))).toBeCloseTo(100);
      expect(Number(dirty.getAttribute('height'))).toBeCloseTo(100 / 3);
      expect(wet.getAttribute('class')).toContain('series-0');
      expect(dirty.getAttribute('class')).toContain('series-1');
      expect(host().querySelector('[data-testid="chart-max"]')!.textContent!.trim()).toBe('6h');
    });

    it('labels a bar with each series and no total', async () => {
      await show([{ date: '2026-10-07', values: [6, 2] }]);

      expect(bars()[0].getAttribute('aria-label')).toBe('Wed, Oct 7: Wet 6h, Dirty 2h');
    });

    it('labels a week bar with its daily averages', async () => {
      fixture.componentInstance.bucket.set('week');
      await show([{ date: '2026-10-04', values: [6.4, 2.1] }]);

      expect(bars()[0].getAttribute('aria-label')).toBe(
        'Week of Oct 4, per day: Wet 6.4h, Dirty 2.1h',
      );
    });
  });
});
