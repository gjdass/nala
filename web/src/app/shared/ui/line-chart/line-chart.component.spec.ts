import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { translocoTesting } from '../../../testing/transloco-testing';
import { LineChartComponent, LineMarker, LinePoint } from './line-chart.component';

const kg = (v: number) => `${v} kg`;

@Component({
  imports: [LineChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p data-testid="outside">Outside</p>
    <nala-line-chart
      [points]="points()"
      [markers]="markers()"
      [from]="from()"
      [to]="to()"
      [format]="format"
      lang="en"
    />`,
})
class HostComponent {
  readonly points = signal<LinePoint[]>([]);
  readonly markers = signal<LineMarker[]>([]);
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
    await show(
      [point('2026-09-01', 3)],
      [{ date: '2026-09-06', label: 'First smile · Sep 6' }],
    );

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
});
