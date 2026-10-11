import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { DataRefreshService } from '../../../core/refresh/data-refresh.service';
import { SleepTrendDay } from '../../../core/trends/trends.models';
import { TrendsService } from '../../../core/trends/trends.service';
import { fakeDataRefresh } from '../../../testing/data-refresh';
import { translocoTesting } from '../../../testing/transloco-testing';
import { TrendsPeriod } from '../trends-period';
import { SleepTrendsComponent } from './sleep-trends.component';

const H = 3600;

@Component({
  imports: [SleepTrendsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-sleep-trends [babyId]="babyId()" [period]="period()" [today]="today" />`,
})
class HostComponent {
  readonly babyId = signal('b1');
  readonly period = signal<TrendsPeriod>({ from: new Date(2026, 9, 3), to: new Date(2026, 9, 9) });
  readonly today = new Date(2026, 9, 9);
}

describe('SleepTrendsComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let responses: Subject<SleepTrendDay[]>[];
  let sleeps: ReturnType<typeof vi.fn>;
  let refresh: ReturnType<typeof fakeDataRefresh>;

  const host = () => fixture.nativeElement as HTMLElement;
  const norm = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
  const cards = () => [...host().querySelectorAll('nala-metric-card')];
  const inCard = (index: number, testId: string) =>
    cards()[index]?.querySelectorAll(`[data-testid="${testId}"]`) ?? [];
  const textIn = (index: number, testId: string) => norm(inCard(index, testId)[0]?.textContent);
  const find = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  // A pending load keeps whenStable() waiting: render with a plain tick instead.
  const settle = async () => {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  };
  const respond = async (days: SleepTrendDay[], index = responses.length - 1) => {
    responses[index].next(days);
    await settle();
  };

  const day = (
    date: string,
    dayHours: number,
    nightHours: number,
    longestHours: number | null,
  ): SleepTrendDay => ({
    date,
    daySeconds: dayHours * H,
    nightSeconds: nightHours * H,
    longestSeconds: longestHours === null ? null : longestHours * H,
  });
  const week = [
    day('2026-10-07', 3, 10, 5),
    day('2026-10-08', 2, 8, null),
    day('2026-10-09', 1, 9, 6),
  ];

  beforeEach(async () => {
    responses = [];
    sleeps = vi.fn(() => {
      const response = new Subject<SleepTrendDay[]>();
      responses.push(response);
      return response;
    });
    refresh = fakeDataRefresh();
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
      providers: [
        { provide: TrendsService, useValue: { sleeps } },
        { provide: DataRefreshService, useValue: refresh },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await settle();
  });

  it("loads the baby's sleeps of the period", () => {
    expect(sleeps).toHaveBeenCalledTimes(1);
    expect(sleeps).toHaveBeenCalledWith('b1', {
      from: new Date(2026, 9, 3),
      to: new Date(2026, 9, 9),
    });
  });

  it('shows the Sleep card, day and night stacked, its headline over past data days', async () => {
    await respond(week);

    expect(textIn(0, 'metric-title')).toBe(en.trends.cards.sleep);
    // (13h + 10h) / 2: today is left out.
    expect(textIn(0, 'metric-headline')).toBe(`11h 30m ${en.trends.perDay}`);
    const bars = [...inCard(0, 'bar')];
    expect(bars.map((b) => b.getAttribute('data-date'))).toEqual([
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
    ]);
    expect(bars[0].getAttribute('aria-label')).toBe('Wed, Oct 7: 13h (Night 10h, Day 3h)');
    expect(bars.map((b) => b.classList.contains('partial'))).toEqual([false, false, true]);
  });

  it('shows the Longest sleep card on the days a sleep starts, its headline without today', async () => {
    await respond(week);

    expect(textIn(1, 'metric-title')).toBe(en.trends.cards.longestSleep);
    expect(textIn(1, 'metric-headline')).toBe(`5h ${en.trends.perDay}`);
    expect([...inCard(1, 'bar')].map((b) => b.getAttribute('data-date'))).toEqual([
      '2026-10-07',
      '2026-10-09',
    ]);
  });

  it('shows "Nothing logged in this period" on both cards without a data day', async () => {
    await respond([]);

    expect(textIn(0, 'metric-empty')).toBe(en.history.emptyPeriod);
    expect(textIn(1, 'metric-empty')).toBe(en.history.emptyPeriod);
    expect(host().querySelector('nala-bar-chart')).toBeNull();
  });

  it('shows today alone with no headline value', async () => {
    await respond([day('2026-10-09', 1, 9, 6)]);

    expect(textIn(0, 'metric-headline')).toBe(`${en.trends.noValue} ${en.trends.perDay}`);
    expect(inCard(0, 'bar').length).toBe(1);
  });

  it('loads again when the period or the baby changes', async () => {
    await respond(week);

    fixture.componentInstance.period.set({
      from: new Date(2026, 8, 26),
      to: new Date(2026, 9, 2),
    });
    await settle();
    expect(sleeps).toHaveBeenLastCalledWith('b1', {
      from: new Date(2026, 8, 26),
      to: new Date(2026, 9, 2),
    });

    fixture.componentInstance.babyId.set('b2');
    await settle();
    expect(sleeps).toHaveBeenLastCalledWith('b2', expect.anything());
    expect(sleeps).toHaveBeenCalledTimes(3);
  });

  it('loads again on the reload signal and keeps the cards meanwhile', async () => {
    await respond(week);

    refresh.reload.set(1);
    await settle();

    expect(sleeps).toHaveBeenCalledTimes(2);
    expect(cards().length).toBe(2);

    await respond([day('2026-10-08', 4, 10, 6)]);
    expect(textIn(0, 'metric-headline')).toBe(`14h ${en.trends.perDay}`);
  });

  it('shows an error with Try again, which loads again', async () => {
    responses[0].error(new Error('offline'));
    await settle();

    expect(norm(find('trends-error')?.textContent)).toContain(en.trends.loadError);
    expect(cards().length).toBe(0);

    find('trends-retry')!.click();
    await settle();
    expect(sleeps).toHaveBeenCalledTimes(2);

    await respond(week);
    expect(find('trends-error')).toBeNull();
    expect(cards().length).toBe(2);
  });

  it('shows a bar per week, from the locale first day, over 3 months', async () => {
    fixture.componentInstance.period.set({ from: new Date(2026, 6, 10), to: new Date(2026, 9, 9) });
    await settle();
    await respond([
      day('2026-10-05', 3, 10, 5),
      day('2026-10-07', 1, 8, null),
      day('2026-10-09', 1, 9, 6),
    ]);

    const bars = [...inCard(0, 'bar')];
    expect(bars.map((b) => b.getAttribute('data-date'))).toEqual(['2026-10-04']);
    expect(bars[0].getAttribute('aria-label')).toBe(
      `Week of Oct 4: 11h ${en.trends.perDay} (Night 9h, Day 2h)`,
    );
    expect(bars[0].classList.contains('partial')).toBe(false);
    expect(inCard(1, 'bar')[0].getAttribute('aria-label')).toBe(
      `Week of Oct 4: 5h ${en.trends.perDay}`,
    );
    expect(textIn(0, 'metric-headline')).toBe(`11h ${en.trends.perDay}`);
  });

  it('shows a bar per month beyond 6 months', async () => {
    fixture.componentInstance.period.set({ from: new Date(2025, 9, 9), to: new Date(2026, 9, 9) });
    await settle();
    await respond([day('2026-09-15', 2, 10, 4), day('2026-10-01', 4, 10, 6)]);

    const bars = [...inCard(0, 'bar')];
    expect(bars.map((b) => b.getAttribute('data-date'))).toEqual(['2026-09-01', '2026-10-01']);
    expect(bars[0].getAttribute('aria-label')).toBe(
      `September 2026: 12h ${en.trends.perDay} (Night 10h, Day 2h)`,
    );
  });
});
