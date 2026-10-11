import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { DataRefreshService } from '../../../core/refresh/data-refresh.service';
import { PumpTrendDay } from '../../../core/trends/trends.models';
import { TrendsService } from '../../../core/trends/trends.service';
import { fakeDataRefresh } from '../../../testing/data-refresh';
import { translocoTesting } from '../../../testing/transloco-testing';
import { TrendsPeriod } from '../trends-period';
import { PumpTrendsComponent } from './pump-trends.component';

@Component({
  imports: [PumpTrendsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-pump-trends [babyId]="babyId()" [period]="period()" [today]="today" />`,
})
class HostComponent {
  readonly babyId = signal('b1');
  readonly period = signal<TrendsPeriod>({ from: new Date(2026, 9, 3), to: new Date(2026, 9, 9) });
  readonly today = new Date(2026, 9, 9);
}

describe('PumpTrendsComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let responses: Subject<PumpTrendDay[]>[];
  let pumps: ReturnType<typeof vi.fn>;
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
  const respond = async (days: PumpTrendDay[]) => {
    responses[responses.length - 1].next(days);
    await settle();
  };

  const day = (date: string, leftMl: number, rightMl: number, sessions: number): PumpTrendDay => ({
    date,
    leftMl,
    rightMl,
    sessions,
  });
  // The 8th: one session without a volume.
  const week = [day('2026-10-07', 90, 80, 2), day('2026-10-08', 0, 0, 1), day('2026-10-09', 40, 30, 1)];

  beforeEach(async () => {
    responses = [];
    pumps = vi.fn(() => {
      const response = new Subject<PumpTrendDay[]>();
      responses.push(response);
      return response;
    });
    refresh = fakeDataRefresh();
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
      providers: [
        { provide: TrendsService, useValue: { pumps } },
        { provide: DataRefreshService, useValue: refresh },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await settle();
  });

  it("loads the baby's pump sessions of the period, and again on the reload signal", async () => {
    expect(pumps).toHaveBeenCalledWith('b1', {
      from: new Date(2026, 9, 3),
      to: new Date(2026, 9, 9),
    });
    await respond([]);

    refresh.reload.set(1);
    await settle();
    expect(pumps).toHaveBeenCalledTimes(2);
  });

  it('shows the Pumped card, left and right stacked, its ml per day over past data days', async () => {
    await respond(week);

    expect(textIn(0, 'metric-title')).toBe(en.trends.cards.pumped);
    // (170 + 0) / 2: today is left out, a session without volume is a 0 ml data day.
    expect(textIn(0, 'metric-headline')).toBe(`85 ml ${en.trends.perDay}`);
    const bars = [...inCard(0, 'bar')];
    expect(bars.map((b) => b.getAttribute('data-date'))).toEqual([
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
    ]);
    expect(bars[0].getAttribute('aria-label')).toBe(
      `Wed, Oct 7: 170 ml (${en.trends.left} 90 ml, ${en.trends.right} 80 ml)`,
    );
    expect(bars[2].classList.contains('partial')).toBe(true);
  });

  it('shows the Sessions card, its sessions per day with one decimal', async () => {
    await respond(week);

    expect(textIn(1, 'metric-title')).toBe(en.trends.cards.sessions);
    expect(textIn(1, 'metric-headline')).toBe(`1.5 ${en.trends.perDay}`);
    expect(inCard(1, 'bar')[0].getAttribute('aria-label')).toBe('Wed, Oct 7: 2');
  });

  it('shows "Nothing logged in this period" on both cards without a data day', async () => {
    await respond([]);

    expect(textIn(0, 'metric-empty')).toBe(en.history.emptyPeriod);
    expect(textIn(1, 'metric-empty')).toBe(en.history.emptyPeriod);
  });
});
