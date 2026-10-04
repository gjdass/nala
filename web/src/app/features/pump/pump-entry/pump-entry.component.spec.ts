import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatListModule } from '@angular/material/list';
import { aPump } from '../../../testing/pumps';
import { translocoTesting } from '../../../testing/transloco-testing';
import { PumpEntryComponent } from './pump-entry.component';

const shortTime = (d: Date) => new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(d);

describe('PumpEntryComponent', () => {
  let fixture: ComponentFixture<PumpEntryComponent>;

  const find = (testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const show = async (overrides: Parameters<typeof aPump>[0]) => {
    fixture.componentRef.setInput('pump', aPump(overrides));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 3, 16, 0));
    await TestBed.configureTestingModule({
      imports: [PumpEntryComponent, MatListModule, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(PumpEntryComponent);
  });

  afterEach(() => vi.useRealTimers());

  it('shows the water drop icon, the start time and the total, then each side and the duration', async () => {
    const start = new Date(2026, 9, 3, 14, 30);
    const end = new Date(2026, 9, 3, 14, 50);
    await show({
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      leftMl: 90,
      rightMl: 90,
    });

    expect(find('entry-icon')?.textContent?.trim()).toBe('water_drop');
    expect(find('entry-time')?.textContent?.trim()).toBe(shortTime(start));
    expect(find('entry-label')?.textContent?.trim()).toBe('180 ml');
    expect(find('entry-summary')?.textContent?.trim()).toBe('L 90 ml · R 90 ml · 20m');
  });

  it('leaves out a side without a volume', async () => {
    await show({ leftMl: null, rightMl: 60 });
    expect(find('entry-label')?.textContent?.trim()).toBe('60 ml');
    expect(find('entry-summary')?.textContent?.trim()).toBe('R 60 ml · 20m');

    await show({ leftMl: 0, rightMl: null });
    expect(find('entry-label')?.textContent?.trim()).toBe('0 ml');
    expect(find('entry-summary')?.textContent?.trim()).toBe('L 0 ml · 20m');
  });

  it('shows the time alone and only the duration without any volume', async () => {
    await show({ leftMl: null, rightMl: null });

    expect(find('entry-label')).toBeNull();
    expect(find('entry-summary')?.textContent?.trim()).toBe('20m');
  });

  it('shows a live session as "Pumping" with its live duration, keeping the time and total', async () => {
    const start = new Date(2026, 9, 3, 15, 48);
    await show({ startTime: start.toISOString(), endTime: null, leftMl: 40, rightMl: null });

    expect(find('entry-time')?.textContent?.trim()).toBe(shortTime(start));
    expect(find('entry-label')?.textContent?.trim()).toBe('40 ml');
    expect(find('entry-summary')?.textContent?.trim()).toBe('Pumping · 12m');
  });

  it('emits open when tapped', async () => {
    await show({});
    const open = vi.fn();
    fixture.componentInstance.open.subscribe(open);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!.click();

    expect(open).toHaveBeenCalled();
  });
});
