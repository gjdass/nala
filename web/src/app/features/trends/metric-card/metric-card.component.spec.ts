import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import { MetricCardComponent } from './metric-card.component';

@Component({
  imports: [MetricCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-metric-card section="sleep" title="Sleep" headline="11h 30m" [detail]="detail()" [empty]="empty()">
    <p data-testid="chart">Chart</p>
  </nala-metric-card>`,
})
class HostComponent {
  readonly empty = signal(false);
  readonly detail = signal('');
}

describe('MetricCardComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  const host = () => fixture.nativeElement as HTMLElement;
  const text = (testId: string) =>
    host().querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it("shows the title, the headline per day and the chart, in the section's scheme", () => {
    expect(text('metric-title')).toBe('Sleep');
    expect(text('metric-headline')).toBe(`11h 30m ${en.trends.perDay}`);
    expect(text('chart')).toBe('Chart');
    expect(host().querySelector('mat-card')!.classList).toContain('nala-scheme-sleep');
  });

  it('shows "Nothing logged in this period" instead of the headline and the chart when empty', async () => {
    fixture.componentInstance.empty.set(true);
    await fixture.whenStable();

    expect(text('metric-title')).toBe('Sleep');
    expect(text('metric-empty')).toBe(en.history.emptyPeriod);
    expect(text('metric-headline')).toBeUndefined();
    expect(text('chart')).toBeUndefined();
  });

  it('shows the detail after the headline when there is one', async () => {
    fixture.componentInstance.detail.set('L 55% · R 45%');
    await fixture.whenStable();

    expect(text('metric-headline')).toBe(`11h 30m ${en.trends.perDay} · L 55% · R 45%`);
  });
});
