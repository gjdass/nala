import { ComponentFixture, TestBed } from '@angular/core/testing';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import { TimerComponent } from './timer.component';

describe('TimerComponent', () => {
  let fixture: ComponentFixture<TimerComponent>;
  let started: number;
  let stopped: number;

  const find = <T extends HTMLElement = HTMLElement>(testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<T>(`[data-testid="${testId}"]`);
  const toggle = () => find<HTMLButtonElement>('timer-toggle')!;
  const set = async (inputs: Record<string, unknown>) => {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimerComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(TimerComponent);
    started = 0;
    stopped = 0;
    fixture.componentInstance.start.subscribe(() => started++);
    fixture.componentInstance.stop.subscribe(() => stopped++);
    await set({ seconds: 2710 });
  });

  it('shows its duration', () => {
    expect(find('timer-duration')?.textContent?.trim()).toBe('45m 10s');
  });

  it('offers Start as a tonal button while it is not running', () => {
    expect(toggle().textContent?.trim()).toBe(en.timer.start);
    expect(toggle().classList).toContain('mat-tonal-button');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
  });

  it('becomes a filled Stop button while it runs', async () => {
    await set({ running: true });

    expect(toggle().textContent?.trim()).toBe(en.timer.stop);
    expect(toggle().classList).toContain('mat-mdc-unelevated-button');
    expect(toggle().classList).not.toContain('mat-tonal-button');
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
  });

  it('emits start, or stop while running', async () => {
    toggle().click();
    await set({ running: true });
    toggle().click();

    expect(started).toBe(1);
    expect(stopped).toBe(1);
  });

  it('can be disabled', async () => {
    await set({ disabled: true });

    expect(toggle().disabled).toBe(true);
  });

  it('uses a smaller duration when compact', async () => {
    expect(find('timer-duration')!.closest('.compact')).toBeNull();

    await set({ compact: true });

    expect(find('timer-duration')!.closest('.compact')).not.toBeNull();
  });
});
