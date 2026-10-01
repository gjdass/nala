import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatListModule } from '@angular/material/list';
import { NowService } from '../../../core/time/now.service';
import { aSleep } from '../../../testing/sleeps';
import { translocoTesting } from '../../../testing/transloco-testing';
import { SleepEntryComponent } from './sleep-entry.component';

const NOW = new Date(2026, 8, 30, 16, 0, 0);
const shortTime = (d: Date) => new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(d);

describe('SleepEntryComponent', () => {
  let fixture: ComponentFixture<SleepEntryComponent>;
  let now: ReturnType<typeof signal<number>>;

  const find = (testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    now = signal(NOW.getTime());
    await TestBed.configureTestingModule({
      imports: [SleepEntryComponent, MatListModule, translocoTesting()],
      providers: [{ provide: NowService, useValue: { now } }],
    }).compileComponents();
    fixture = TestBed.createComponent(SleepEntryComponent);
  });

  afterEach(() => vi.useRealTimers());

  it('shows the bedtime icon, the start time, then the duration and when it ended', async () => {
    const start = new Date(2026, 8, 30, 13, 0);
    const end = new Date(2026, 8, 30, 14, 30);
    fixture.componentRef.setInput(
      'sleep',
      aSleep({ startTime: start.toISOString(), endTime: end.toISOString() }),
    );
    await fixture.whenStable();

    expect(find('entry-icon')?.textContent?.trim()).toBe('bedtime');
    expect(find('entry-time')?.textContent?.trim()).toBe(shortTime(start));
    expect(find('entry-label')).toBeNull();
    expect(find('entry-summary')?.textContent?.trim()).toBe(`1h 30m · until ${shortTime(end)}`);
  });

  it('writes an end on another day as "Yesterday …"', async () => {
    const start = new Date(2026, 8, 29, 20, 0);
    const end = new Date(2026, 8, 29, 22, 45);
    fixture.componentRef.setInput(
      'sleep',
      aSleep({ startTime: start.toISOString(), endTime: end.toISOString() }),
    );
    await fixture.whenStable();

    expect(find('entry-summary')?.textContent?.trim()).toBe(
      `2h 45m · until Yesterday ${shortTime(end)}`,
    );
  });

  it('shows a live sleep as "Sleeping" with its live duration', async () => {
    const start = new Date(NOW.getTime() - 45 * 60_000);
    fixture.componentRef.setInput(
      'sleep',
      aSleep({ startTime: start.toISOString(), endTime: null }),
    );
    await fixture.whenStable();

    expect(find('entry-time')?.textContent?.trim()).toBe(shortTime(start));
    expect(find('entry-summary')?.textContent?.trim()).toBe('Sleeping · 45m');

    now.set(NOW.getTime() + 10_000);
    await fixture.whenStable();

    expect(find('entry-summary')?.textContent?.trim()).toBe('Sleeping · 45m 10s');
  });

  it('emits open when tapped', async () => {
    fixture.componentRef.setInput('sleep', aSleep());
    await fixture.whenStable();
    const open = vi.fn();
    fixture.componentInstance.open.subscribe(open);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!.click();

    expect(open).toHaveBeenCalled();
  });
});
