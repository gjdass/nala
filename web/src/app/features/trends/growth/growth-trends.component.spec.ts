import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { DataRefreshService } from '../../../core/refresh/data-refresh.service';
import { NowService } from '../../../core/time/now.service';
import { GrowthTrendPoint, GrowthTrends } from '../../../core/trends/trends.models';
import { TrendsService } from '../../../core/trends/trends.service';
import { fakeDataRefresh } from '../../../testing/data-refresh';
import { translocoTesting } from '../../../testing/transloco-testing';
import { TrendsPeriod } from '../trends-period';
import { GrowthTrendsComponent } from './growth-trends.component';

@Component({
  imports: [GrowthTrendsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-growth-trends
    [babyId]="babyId()"
    [period]="period()"
    [today]="today"
    birthDate="2026-09-01"
  />`,
})
class HostComponent {
  readonly babyId = signal('b1');
  readonly period = signal<TrendsPeriod>({ from: new Date(2026, 8, 1), to: new Date(2026, 9, 9) });
  readonly today = new Date(2026, 9, 9);
}

describe('GrowthTrendsComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let responses: Subject<GrowthTrends>[];
  let growth: ReturnType<typeof vi.fn>;
  let refresh: ReturnType<typeof fakeDataRefresh>;

  const host = () => fixture.nativeElement as HTMLElement;
  const norm = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
  const cards = () => [...host().querySelectorAll('nala-metric-card')];
  const inCard = (index: number, testId: string) => [
    ...(cards()[index]?.querySelectorAll(`[data-testid="${testId}"]`) ?? []),
  ];
  const textIn = (index: number, testId: string) => norm(inCard(index, testId)[0]?.textContent);
  const labelsIn = (index: number, testId: string) =>
    inCard(index, testId).map((e) => norm(e.getAttribute('aria-label')));
  const find = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const settle = async () => {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  };
  const respond = async (trends: GrowthTrends) => {
    responses[responses.length - 1].next(trends);
    await settle();
  };

  const measurement = (
    date: string,
    weightG: number | null,
    lengthCm: number | null,
    headCircumferenceCm: number | null,
    birth = false,
  ): GrowthTrendPoint => ({ date, weightG, lengthCm, headCircumferenceCm, birth });
  const trends: GrowthTrends = {
    measurements: [
      measurement('2026-09-01', 3400, null, 34.5, true),
      measurement('2026-09-20', 4100, 54.5, null),
      measurement('2026-10-03', 4600, 56, null),
    ],
    milestones: [
      { date: '2026-09-25', milestone: 'firstSmile', title: null },
      { date: '2026-10-05', milestone: 'custom', title: 'Grabs a toy' },
    ],
  };

  beforeEach(async () => {
    responses = [];
    growth = vi.fn(() => {
      const response = new Subject<GrowthTrends>();
      responses.push(response);
      return response;
    });
    refresh = fakeDataRefresh();
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
      providers: [
        { provide: TrendsService, useValue: { growth } },
        { provide: DataRefreshService, useValue: refresh },
        { provide: NowService, useValue: { now: signal(new Date(2026, 9, 9, 12).getTime()) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await settle();
  });

  it("loads the baby's growth of the period, and again on the reload signal", async () => {
    expect(growth).toHaveBeenCalledWith('b1', {
      from: new Date(2026, 8, 1),
      to: new Date(2026, 9, 9),
    });
    await respond(trends);

    refresh.reload.set(1);
    await settle();

    expect(growth).toHaveBeenCalledTimes(2);
    expect(cards().length).toBe(3);
  });

  it('shows the Weight, Length and Head cards, each headed by its latest value and date', async () => {
    await respond(trends);

    expect(cards().map((_, i) => textIn(i, 'metric-title'))).toEqual([
      en.growth.card.weight,
      en.growth.card.length,
      en.growth.card.head,
    ]);
    expect(textIn(0, 'metric-headline')).toBe('4.600 kg · Oct 3');
    expect(textIn(1, 'metric-headline')).toBe('56.0 cm · Oct 3');
    expect(textIn(2, 'metric-headline')).toBe(`34.5 cm · ${en.growth.card.birth}`);
  });

  it("draws each measure's points, the birth one first, labelled with date, value and age", async () => {
    await respond(trends);

    expect(labelsIn(0, 'point-target')).toEqual([
      `Tue, Sep 1: 3.400 kg · ${en.growth.card.birth}`,
      'Sun, Sep 20: 4.100 kg · 2 weeks 5 days',
      'Sat, Oct 3: 4.600 kg · 4 weeks 4 days',
    ]);
    expect(inCard(0, 'line-segment').length).toBe(2);
    expect(labelsIn(1, 'point-target')).toEqual([
      'Sun, Sep 20: 54.5 cm · 2 weeks 5 days',
      'Sat, Oct 3: 56.0 cm · 4 weeks 4 days',
    ]);
    expect(inCard(2, 'point-target').length).toBe(1);
    expect(inCard(2, 'line-segment').length).toBe(0);
  });

  it('shows the milestones as markers on the Weight chart only', async () => {
    await respond(trends);

    expect(labelsIn(0, 'marker')).toEqual([
      `Fri, Sep 25: ${en.growth.milestone.firstSmile}`,
      'Mon, Oct 5: Grabs a toy',
    ]);
    expect(inCard(1, 'marker').length).toBe(0);
    expect(inCard(2, 'marker').length).toBe(0);
  });

  it('shows "Nothing logged in this period" for a measure without a point', async () => {
    await respond({ measurements: [measurement('2026-09-20', null, 54.5, null)], milestones: [] });

    expect(textIn(0, 'metric-empty')).toBe(en.history.emptyPeriod);
    expect(inCard(1, 'point-target').length).toBe(1);
    expect(textIn(2, 'metric-empty')).toBe(en.history.emptyPeriod);
  });

  it('keeps the Weight chart for its milestones when no weight is logged', async () => {
    await respond({ measurements: [], milestones: trends.milestones });

    expect(textIn(0, 'metric-headline')).toBe(en.trends.noValue);
    expect(inCard(0, 'marker').length).toBe(2);
    expect(textIn(1, 'metric-empty')).toBe(en.history.emptyPeriod);
  });

  it('shows an error with Try again, which loads again', async () => {
    responses[0].error(new Error('offline'));
    await settle();

    expect(norm(find('trends-error')?.textContent)).toContain(en.trends.loadError);
    find('trends-retry')!.click();
    await settle();
    expect(growth).toHaveBeenCalledTimes(2);

    await respond(trends);
    expect(cards().length).toBe(3);
  });
});
