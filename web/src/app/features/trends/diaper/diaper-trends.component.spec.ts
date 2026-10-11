import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { DataRefreshService } from '../../../core/refresh/data-refresh.service';
import { DiaperTrendDay } from '../../../core/trends/trends.models';
import { TrendsService } from '../../../core/trends/trends.service';
import { fakeDataRefresh } from '../../../testing/data-refresh';
import { translocoTesting } from '../../../testing/transloco-testing';
import { TrendsPeriod } from '../trends-period';
import { DiaperTrendsComponent } from './diaper-trends.component';

@Component({
  imports: [DiaperTrendsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-diaper-trends [babyId]="babyId()" [period]="period()" [today]="today" />`,
})
class HostComponent {
  readonly babyId = signal('b1');
  readonly period = signal<TrendsPeriod>({ from: new Date(2026, 9, 3), to: new Date(2026, 9, 9) });
  readonly today = new Date(2026, 9, 9);
}

describe('DiaperTrendsComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let responses: Subject<DiaperTrendDay[]>[];
  let diapers: ReturnType<typeof vi.fn>;
  let refresh: ReturnType<typeof fakeDataRefresh>;

  const host = () => fixture.nativeElement as HTMLElement;
  const norm = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
  const cards = () => [...host().querySelectorAll('nala-metric-card')];
  const inCard = (index: number, testId: string) =>
    cards()[index]?.querySelectorAll(`[data-testid="${testId}"]`) ?? [];
  const textIn = (index: number, testId: string) => norm(inCard(index, testId)[0]?.textContent);
  const settle = async () => {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  };
  const respond = async (days: DiaperTrendDay[]) => {
    responses[responses.length - 1].next(days);
    await settle();
  };

  const day = (date: string, wet: number, dirty: number, count: number): DiaperTrendDay => ({
    date,
    wet,
    dirty,
    count,
  });
  const week = [day('2026-10-07', 6, 2, 7), day('2026-10-08', 5, 1, 6), day('2026-10-09', 2, 0, 2)];

  beforeEach(async () => {
    responses = [];
    diapers = vi.fn(() => {
      const response = new Subject<DiaperTrendDay[]>();
      responses.push(response);
      return response;
    });
    refresh = fakeDataRefresh();
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
      providers: [
        { provide: TrendsService, useValue: { diapers } },
        { provide: DataRefreshService, useValue: refresh },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await settle();
  });

  it("loads the baby's diapers of the period, and again on the reload signal", async () => {
    expect(diapers).toHaveBeenCalledWith('b1', {
      from: new Date(2026, 9, 3),
      to: new Date(2026, 9, 9),
    });
    await respond([]);

    refresh.reload.set(1);
    await settle();
    expect(diapers).toHaveBeenCalledTimes(2);
  });

  it('shows the Diapers card, wet and dirty side by side, with both averages over past data days', async () => {
    await respond(week);

    expect(cards().length).toBe(1);
    expect(textIn(0, 'metric-title')).toBe(en.trends.cards.diapers);
    // (6 + 5) / 2 wet and (2 + 1) / 2 dirty: today is left out.
    expect(textIn(0, 'metric-headline')).toBe(`5.5 wet · 1.5 dirty ${en.trends.perDay}`);
    const bars = [...inCard(0, 'bar')];
    expect(bars.map((b) => b.getAttribute('data-date'))).toEqual([
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
    ]);
    expect(bars[0].getAttribute('aria-label')).toBe('Wed, Oct 7: Wet 6, Dirty 2');
    expect(bars[2].classList.contains('partial')).toBe(true);
    expect([...inCard(0, 'legend-item')].map((l) => norm(l.textContent))).toEqual([
      en.trends.wet,
      en.trends.dirty,
    ]);
  });

  it('shows a dry-only day as a data day with zero wet and dirty', async () => {
    await respond([day('2026-10-07', 0, 0, 2)]);

    expect(textIn(0, 'metric-headline')).toBe(`0 wet · 0 dirty ${en.trends.perDay}`);
    expect(inCard(0, 'bar').length).toBe(1);
  });

  it('shows no headline value with only today', async () => {
    await respond([day('2026-10-09', 2, 0, 2)]);

    expect(textIn(0, 'metric-headline')).toBe(`${en.trends.noValue} ${en.trends.perDay}`);
  });

  it('shows "Nothing logged in this period" without a data day', async () => {
    await respond([]);

    expect(textIn(0, 'metric-empty')).toBe(en.history.emptyPeriod);
  });

  it('averages each series per week over 3 months', async () => {
    fixture.componentInstance.period.set({ from: new Date(2026, 6, 10), to: new Date(2026, 9, 9) });
    await settle();
    await respond([day('2026-10-05', 6, 2, 7), day('2026-10-07', 5, 1, 6), day('2026-10-09', 2, 0, 2)]);

    const bars = [...inCard(0, 'bar')];
    expect(bars.map((b) => b.getAttribute('data-date'))).toEqual(['2026-10-04']);
    expect(bars[0].getAttribute('aria-label')).toBe(
      `Week of Oct 4, ${en.trends.perDay}: Wet 5.5, Dirty 1.5`,
    );
  });
});
