import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatListModule } from '@angular/material/list';
import { translocoTesting } from '../../../testing/transloco-testing';
import { EntryListItemComponent } from './entry-list-item.component';

const TIME = new Date(2026, 8, 28, 14, 10).toISOString();

@Component({
  imports: [EntryListItemComponent, MatListModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<mat-action-list>
    <nala-entry-list-item
      icon="baby_changing_station"
      [time]="time"
      [summary]="summary()"
      [durationSeconds]="duration()"
      [durationScaleSeconds]="scale()"
      (open)="opened = opened + 1"
    />
  </mat-action-list>`,
})
class Host {
  readonly time = TIME;
  readonly summary = signal('L 5m · R 3m 30s');
  readonly duration = signal<number | null>(null);
  readonly scale = signal(3600);
  opened = 0;
}

describe('EntryListItemComponent', () => {
  let fixture: ComponentFixture<Host>;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.trim();

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(2026, 8, 28, 18, 0));
    await TestBed.configureTestingModule({
      imports: [Host, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  afterEach(() => vi.useRealTimers());

  it('shows the kind icon, the local time, the summary and a chevron', () => {
    expect(text('entry-icon')).toBe('baby_changing_station');
    expect(text('entry-time')).toBe(
      new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(new Date(TIME)),
    );
    expect(text('entry-summary')).toBe('L 5m · R 3m 30s');
    expect(text('entry-chevron')).toBe('chevron_right');
  });

  it('shows no bar and no duration without a duration', () => {
    expect(find('entry-bar')).toBeNull();
    expect(find('entry-duration')).toBeNull();
  });

  it('shows a bar proportional to the duration on the scale, and the duration', async () => {
    fixture.componentInstance.duration.set(30 * 60);
    await fixture.whenStable();

    expect(find('entry-bar')?.style.width).toBe('50%');
    expect(text('entry-duration')).toBe('30m');
  });

  it('uses the section scale and caps the bar at full width', async () => {
    fixture.componentInstance.scale.set(20 * 60);
    fixture.componentInstance.duration.set(5 * 60);
    await fixture.whenStable();
    expect(find('entry-bar')?.style.width).toBe('25%');

    fixture.componentInstance.duration.set(45 * 60);
    await fixture.whenStable();
    expect(find('entry-bar')?.style.width).toBe('100%');
  });

  it('emits open when tapped', () => {
    host().querySelector<HTMLButtonElement>('button[mat-list-item]')!.click();

    expect(fixture.componentInstance.opened).toBe(1);
  });
});
