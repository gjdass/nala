import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarChartComponent, BarDatum, BarSeries } from './bar-chart.component';

const hours = (v: number) => `${v}h`;

@Component({
  imports: [BarChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p data-testid="outside">Outside</p>
    <nala-bar-chart [bars]="bars()" [series]="series()" [format]="format" lang="en" />`,
})
class HostComponent {
  readonly bars = signal<BarDatum[]>([]);
  readonly series = signal<BarSeries[]>([{ label: 'Night' }, { label: 'Day' }]);
  readonly format = hours;
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
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
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
});
