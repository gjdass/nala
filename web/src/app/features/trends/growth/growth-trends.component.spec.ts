import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Observable, Subject, of, throwError } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { Sex } from '../../../core/babies/baby.models';
import { GrowthReference, LmsTable } from '../../../core/growth-reference/growth-reference';
import { GrowthReferenceService } from '../../../core/growth-reference/growth-reference.service';
import { DataRefreshService } from '../../../core/refresh/data-refresh.service';
import { NowService } from '../../../core/time/now.service';
import { GrowthTrendPoint, GrowthTrends } from '../../../core/trends/trends.models';
import { TrendsService } from '../../../core/trends/trends.service';
import {
  LineBandSample,
  LineChartComponent,
} from '../../../shared/ui/line-chart/line-chart.component';
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
    [birthDate]="birthDate()"
    [sex]="sex()"
    [percentiles]="percentiles()"
    name="Nala"
  />`,
})
class HostComponent {
  readonly birthDate = signal('2026-09-01');
  readonly sex = signal<Sex>('unspecified');
  readonly percentiles = signal(true);
  readonly babyId = signal('b1');
  readonly period = signal<TrendsPeriod>({ from: new Date(2026, 8, 1), to: new Date(2026, 9, 9) });
  readonly today = new Date(2026, 9, 9);
}

describe('GrowthTrendsComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let responses: Subject<GrowthTrends>[];
  let growth: ReturnType<typeof vi.fn>;
  let refresh: ReturnType<typeof fakeDataRefresh>;
  let referenceLoad: ReturnType<typeof vi.fn<() => Observable<GrowthReference>>>;
  let now: ReturnType<typeof signal<number>>;

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

  /** M grows linearly from birth (age 0) to 1826 days; L = 1, so a percentile is M × (1 + S × z). */
  const table = (from: number, to: number): LmsTable => ({
    l: [1, 1],
    m: [from, to],
    s: [0.1, 0.1],
  });
  const reference: GrowthReference = {
    source: 'WHO',
    licence: 'GPL-3',
    ageDays: [0, 1826],
    girl: { weight: table(3, 18), length: table(49, 110), head: table(34, 50) },
    boy: { weight: table(4, 19), length: table(50, 111), head: table(35, 51) },
  };

  beforeEach(async () => {
    responses = [];
    growth = vi.fn(() => {
      const response = new Subject<GrowthTrends>();
      responses.push(response);
      return response;
    });
    refresh = fakeDataRefresh();
    referenceLoad = vi.fn(() => of(reference));
    now = signal(new Date(2026, 9, 9, 12).getTime());
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
      providers: [
        { provide: TrendsService, useValue: { growth } },
        { provide: DataRefreshService, useValue: refresh },
        { provide: GrowthReferenceService, useValue: { reference: referenceLoad } },
        { provide: NowService, useValue: { now } },
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

  it('keeps a tapped point\'s value shown while the clock ticks', async () => {
    await respond(trends);
    inCard(0, 'point-target')[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    const label = labelsIn(0, 'point-target')[1];
    expect(norm(find('chart-tooltip')?.textContent)).toBe(label);

    now.set(now() + 1000);
    await settle();

    expect(norm(find('chart-tooltip')?.textContent)).toBe(label);
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
  describe('percentiles', () => {
    const charts = () =>
      fixture.debugElement
        .queryAll(By.directive(LineChartComponent))
        .map((c) => c.componentInstance as LineChartComponent);
    const bandsOf = (index: number) => charts()[index].bands() as LineBandSample[] | null;
    const asGirl = async (sex: Sex = 'girl') => {
      fixture.componentInstance.sex.set(sex);
      await settle();
      await respond(trends);
    };

    it("gives each chart with a point its sex's bands and the caption", async () => {
      await asGirl();

      expect(referenceLoad).toHaveBeenCalled();
      expect([0, 1, 2].map((i) => !!bandsOf(i)?.length)).toEqual([true, true, true]);
      expect([0, 1, 2].map((i) => textIn(i, 'percentiles-caption'))).toEqual([
        en.trends.percentiles.caption.girl,
        en.trends.percentiles.caption.girl,
        en.trends.percentiles.caption.girl,
      ]);
      expect(find('percentiles-hint')).toBeNull();
    });

    it("uses a boy's table and names boys in the caption", async () => {
      await asGirl('boy');

      expect(bandsOf(0)![0].p50).toBe(4000);
      expect(textIn(0, 'percentiles-caption')).toBe(en.trends.percentiles.caption.boy);
    });

    it('samples about 60 dates across the period from the birth date, weight in g', async () => {
      await asGirl();

      const bands = bandsOf(0)!;
      expect(bands.length).toBeGreaterThanOrEqual(30);
      expect(bands.length).toBeLessThanOrEqual(60);
      expect(bands[0]).toEqual({
        date: '2026-09-01',
        p3: expect.closeTo(3000 * (1 - 0.188079), 6),
        p15: expect.closeTo(3000 * (1 - 0.103643), 6),
        p50: 3000,
        p85: expect.closeTo(3000 * (1 + 0.103643), 6),
        p97: expect.closeTo(3000 * (1 + 0.188079), 6),
      });
      expect(bands.at(-1)!.date).toBe('2026-10-09');
      expect(bandsOf(1)![0].p50).toBe(49);
    });

    it('starts the bands at the birth date when the period starts before it', async () => {
      fixture.componentInstance.birthDate.set('2026-09-10');
      await asGirl();

      expect(bandsOf(0)![0].date).toBe('2026-09-10');
    });

    it('stops the bands at 1826 days of age', async () => {
      fixture.componentInstance.birthDate.set('2021-10-01');
      await asGirl();

      // 2021-10-01 + 1826 days = 2026-10-01 (2024 is a leap year); the period ends 2026-10-09.
      expect(bandsOf(0)!.at(-1)!.date).toBe('2026-10-01');
      expect(bandsOf(0)!.at(-1)!.p50).toBe(18000);
    });

    it('draws no bands nor caption for a period after 1826 days of age', async () => {
      fixture.componentInstance.birthDate.set('2020-01-01');
      await asGirl();

      expect(bandsOf(0)).toBeNull();
      expect(inCard(0, 'percentiles-caption').length).toBe(0);
    });

    it('gives no bands to a card without a point, even the Weight card with milestones', async () => {
      fixture.componentInstance.sex.set('girl');
      await settle();
      await respond({
        measurements: [measurement('2026-09-20', null, 54.5, null)],
        milestones: trends.milestones,
      });

      expect(bandsOf(0)).toBeNull();
      expect(inCard(0, 'percentiles-caption').length).toBe(0);
      expect(bandsOf(1)!.length).toBeGreaterThan(0);
      expect(textIn(2, 'metric-empty')).toBe(en.history.emptyPeriod);
    });

    it('keeps the tooltips and the headlines the same with bands', async () => {
      await asGirl();

      expect(labelsIn(0, 'point-target')).toEqual([
        `Tue, Sep 1: 3.400 kg · ${en.growth.card.birth}`,
        'Sun, Sep 20: 4.100 kg · 2 weeks 5 days',
        'Sat, Oct 3: 4.600 kg · 4 weeks 4 days',
      ]);
      expect(textIn(0, 'metric-headline')).toBe('4.600 kg · Oct 3');
      expect(norm(host().textContent)).not.toMatch(/percentile \d|normal|low|high/i);
    });

    it('shows no bands and the hint to set the sex for an unspecified sex, without loading the reference', async () => {
      await respond(trends);

      expect(referenceLoad).not.toHaveBeenCalled();
      expect(bandsOf(0)).toBeNull();
      expect(inCard(0, 'percentiles-caption').length).toBe(0);
      expect(norm(find('percentiles-hint')?.textContent)).toBe(
        en.trends.percentiles.hint.replace('{{name}}', 'Nala'),
      );
    });

    it('shows the charts without bands and without an error when the reference fails to load', async () => {
      referenceLoad.mockReturnValue(throwError(() => new Error('offline')));
      await asGirl();

      expect(bandsOf(0)).toBeNull();
      expect(inCard(0, 'percentiles-caption').length).toBe(0);
      expect(find('trends-error')).toBeNull();
      expect(inCard(0, 'point-target').length).toBe(3);
    });

    it('tries the reference again on the reload signal after a failed load', async () => {
      referenceLoad.mockReturnValueOnce(throwError(() => new Error('offline')));
      await asGirl();

      refresh.reload.set(1);
      await settle();
      await respond(trends);

      expect(referenceLoad).toHaveBeenCalledTimes(2);
      expect(bandsOf(0)!.length).toBeGreaterThan(0);
    });
    it('draws no bands, no caption and no hint, and loads no reference, with the percentiles off', async () => {
      fixture.componentInstance.percentiles.set(false);
      await asGirl();

      expect(referenceLoad).not.toHaveBeenCalled();
      expect(bandsOf(0)).toBeNull();
      expect(inCard(0, 'percentiles-caption').length).toBe(0);

      fixture.componentInstance.sex.set('unspecified');
      await settle();
      expect(find('percentiles-hint')).toBeNull();
    });
  });
});
