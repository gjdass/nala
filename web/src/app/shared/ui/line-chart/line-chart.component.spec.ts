import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { translocoTesting } from '../../../testing/transloco-testing';
import { LineBandSample, LineChartComponent, LineMarker, LinePoint } from './line-chart.component';

const kg = (v: number) => `${v} kg`;

@Component({
  imports: [LineChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p data-testid="outside">Outside</p>
    <nala-line-chart
      [points]="points()"
      [markers]="markers()"
      [bands]="bands()"
      [from]="from()"
      [to]="to()"
      [format]="format"
      lang="en"
    />`,
})
class HostComponent {
  readonly points = signal<LinePoint[]>([]);
  readonly markers = signal<LineMarker[]>([]);
  readonly bands = signal<LineBandSample[] | null>(null);
  readonly from = signal('2026-09-01');
  readonly to = signal('2026-09-11');
  readonly format = kg;
}

describe('LineChartComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  const host = () => fixture.nativeElement as HTMLElement;
  const all = (testId: string) => [
    ...host().querySelectorAll<SVGElement>(`[data-testid="${testId}"]`),
  ];
  const text = (testId: string) =>
    host().querySelector(`[data-testid="${testId}"]`)?.textContent?.trim();
  const percent = (element: Element, attribute: string) =>
    parseFloat(element.getAttribute(attribute) ?? 'NaN');
  const point = (date: string, value: number): LinePoint => ({
    date,
    value,
    label: `${date}: ${value} kg`,
  });
  const show = async (points: LinePoint[], markers: LineMarker[] = []) => {
    fixture.componentInstance.points.set(points);
    fixture.componentInstance.markers.set(markers);
    await fixture.whenStable();
  };
  const click = async (element: Element) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('places each point by its date across the period and its value between the min and the max', async () => {
    await show([point('2026-09-01', 3), point('2026-09-06', 4), point('2026-09-11', 5)]);

    const points = all('point');
    expect(points.map((p) => percent(p, 'cx'))).toEqual([0, 50, 100]);
    expect(points.map((p) => percent(p, 'cy'))).toEqual([100, 50, 0]);
  });

  it('labels the top with the max and the bottom with the min', async () => {
    await show([point('2026-09-01', 3.4), point('2026-09-06', 4.2)]);

    expect(text('chart-max')).toBe('4.2 kg');
    expect(text('chart-min')).toBe('3.4 kg');
  });

  it('centres a single value, with no line', async () => {
    await show([point('2026-09-06', 4)]);

    expect(percent(all('point')[0], 'cy')).toBe(50);
    expect(all('line-segment').length).toBe(0);
  });

  it('joins two points or more with a line', async () => {
    await show([point('2026-09-01', 3), point('2026-09-06', 4), point('2026-09-11', 5)]);

    const segments = all('line-segment');
    expect(segments.length).toBe(2);
    expect([
      percent(segments[0], 'x1'),
      percent(segments[0], 'y1'),
      percent(segments[0], 'x2'),
      percent(segments[0], 'y2'),
    ]).toEqual([0, 100, 50, 50]);
  });

  it('labels every point, and shows the tapped one until a tap elsewhere', async () => {
    await show([point('2026-09-01', 3), point('2026-09-06', 4)]);

    const target = host().querySelectorAll('[data-testid="point-target"]');
    expect([...target].map((p) => p.getAttribute('aria-label'))).toEqual([
      '2026-09-01: 3 kg',
      '2026-09-06: 4 kg',
    ]);
    expect(text('chart-tooltip')).toBeUndefined();

    await click(target[1]);
    expect(text('chart-tooltip')).toBe('2026-09-06: 4 kg');

    await click(host().querySelector('[data-testid="outside"]')!);
    expect(text('chart-tooltip')).toBeUndefined();
  });

  it('shows markers at their date along the x axis, with their label when tapped', async () => {
    await show([point('2026-09-01', 3)], [{ date: '2026-09-06', label: 'First smile · Sep 6' }]);

    const markers = all('marker');
    expect(markers.length).toBe(1);
    expect(percent(markers[0], 'x')).toBe(50);
    expect(markers[0].getAttribute('aria-label')).toBe('First smile · Sep 6');

    await click(markers[0]);
    expect(text('chart-tooltip')).toBe('First smile · Sep 6');
  });

  it('shows markers without any point, and no value labels', async () => {
    await show([], [{ date: '2026-09-06', label: 'First smile · Sep 6' }]);

    expect(all('marker').length).toBe(1);
    expect(text('chart-max')).toBeUndefined();
  });

  it('labels about five dates, the month on the first one and when it changes', async () => {
    fixture.componentInstance.from.set('2026-08-20');
    fixture.componentInstance.to.set('2026-09-29');
    await show([point('2026-09-01', 3)]);

    expect(all('chart-x-label').map((l) => l.textContent?.trim())).toEqual([
      'Aug 20',
      '30',
      'Sep 9',
      '19',
      '29',
    ]);
  });
  it('keeps the first and last dates inside the plot: start-aligned and end-aligned', async () => {
    await show([point('2026-09-01', 3)]);

    expect(all('chart-x-label').map((l) => l.className)).toEqual(['start', '', '', '', 'end']);
  });

  describe('with percentile bands', () => {
    const sample = (date: string, p50: number, spread: number): LineBandSample => ({
      date,
      p3: p50 - 2 * spread,
      p15: p50 - spread,
      p50,
      p85: p50 + spread,
      p97: p50 + 2 * spread,
    });
    const showBands = async (bands: LineBandSample[], points: LinePoint[]) => {
      fixture.componentInstance.bands.set(bands);
      await show(points);
    };
    const numbers = (d: string | null) => (d ?? '').match(/-?\d+(\.\d+)?/g)!.map(Number);

    it('draws nothing more without bands', async () => {
      await show([point('2026-09-01', 3), point('2026-09-11', 5)]);
      expect(all('band-outer').length).toBe(0);
      expect(all('band-inner').length).toBe(0);
      expect(all('band-median').length).toBe(0);
      expect(all('band-label').length).toBe(0);
    });

    it('fits the y axis and its labels to the values and the outer band', async () => {
      await showBands(
        [sample('2026-09-01', 4, 0.5), sample('2026-09-11', 6, 0.5)],
        [point('2026-09-06', 5)],
      );
      expect(text('chart-max')).toBe('7 kg');
      expect(text('chart-min')).toBe('3 kg');
      expect(percent(all('point')[0], 'cy')).toBe(50);
    });

    it('keeps a value outside the band inside the axis', async () => {
      await showBands([sample('2026-09-01', 4, 0.5)], [point('2026-09-06', 8)]);
      expect(text('chart-max')).toBe('8 kg');
      expect(text('chart-min')).toBe('3 kg');
    });

    it('fills the outer band from the 97th to the 3rd and the inner one from the 85th to the 15th', async () => {
      await showBands(
        [sample('2026-09-01', 4, 0.5), sample('2026-09-11', 6, 0.5)],
        [point('2026-09-06', 5)],
      );
      // y range 3 → 7: a value v is at (7 − v) / 4 × 100.
      expect(numbers(all('band-outer')[0].getAttribute('d'))).toEqual([
        0, 50, 100, 0, 100, 50, 0, 100,
      ]);
      expect(numbers(all('band-inner')[0].getAttribute('d'))).toEqual([
        0, 62.5, 100, 12.5, 100, 37.5, 0, 87.5,
      ]);
      expect(numbers(all('band-median')[0].getAttribute('d'))).toEqual([0, 75, 100, 25]);
    });

    it('starts the bands at their first sample, not at the period start', async () => {
      await showBands(
        [sample('2026-09-06', 4, 0.5), sample('2026-09-11', 4, 0.5)],
        [point('2026-09-06', 4)],
      );
      expect(numbers(all('band-median')[0].getAttribute('d'))[0]).toBe(50);
    });

    it("labels 3, 50 and 97 at the right edge, at their curve's height", async () => {
      await showBands(
        [sample('2026-09-01', 4, 0.5), sample('2026-09-11', 6, 0.5)],
        [point('2026-09-06', 5)],
      );
      const labels = all('band-label');
      expect(labels.map((l) => l.textContent?.trim())).toEqual(['97', '50', '3']);
      expect(labels.map((l) => percent(l, 'y'))).toEqual([6, 25, 50]);
    });

    it('leaves out the 50 label first when labels would overlap', async () => {
      await showBands(
        [sample('2026-09-01', 4, 0.15)],
        [point('2026-09-06', 2), point('2026-09-07', 6)],
      );
      expect(all('band-label').map((l) => l.textContent?.trim())).toEqual(['97', '3']);
    });

    it('hides the bands from assistive technologies and keeps the points tappable', async () => {
      await showBands([sample('2026-09-01', 4, 0.5)], [point('2026-09-06', 5)]);
      expect(host().querySelector('[data-testid="bands"]')!.getAttribute('aria-hidden')).toBe(
        'true',
      );
      expect(all('point-target').length).toBe(1);
    });
  });
});
