import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { provideNativeDateAdapter } from '@angular/material/core';
import en from '../../../../../public/i18n/en.json';
import { notInFuture } from '../../../core/time/not-in-future';
import { translocoTesting } from '../../../testing/transloco-testing';
import { TimeRowComponent } from './time-row.component';

const NOW = new Date(2026, 8, 30, 12, 0, 0);

@Component({
  imports: [TimeRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-time-row label="Start time" [control]="control" />`,
})
class Host {
  readonly control = new FormControl<Date | null>(new Date(2026, 8, 30, 10, 30), [
    Validators.required,
    notInFuture(() => NOW.getTime()),
  ]);
}

describe('TimeRowComponent', () => {
  let fixture: ComponentFixture<Host>;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(selector: string) =>
    host().querySelector<T>(selector);
  const shortTime = (d: Date) => new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(d);
  const open = async () => {
    find<HTMLButtonElement>('nala-form-row button')!.click();
    await fixture.whenStable();
  };
  const type = async (testId: string, value: string) => {
    const input = find<HTMLInputElement>(`[data-testid="${testId}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    await TestBed.configureTestingModule({
      imports: [Host, translocoTesting()],
      providers: [provideNativeDateAdapter()],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  afterEach(() => vi.useRealTimers());

  it('shows the label and the value, today prefixed with "Today"', () => {
    expect(find('nala-form-row')?.textContent).toContain('Start time');
    expect(find('nala-form-row')?.textContent).toContain(
      `Today ${shortTime(new Date(2026, 8, 30, 10, 30))}`,
    );
  });

  it('shows another day with its date', async () => {
    fixture.componentInstance.control.setValue(new Date(2026, 8, 29, 22, 5));
    await fixture.whenStable();

    expect(find('nala-form-row')?.textContent).toContain(
      `Yesterday ${shortTime(new Date(2026, 8, 29, 22, 5))}`,
    );
  });

  it('hides the pickers until the row is tapped', async () => {
    expect(find('[data-testid="time-row-date"]')).toBeNull();
    expect(find('[data-testid="time-row-time"]')).toBeNull();

    await open();

    expect(find('[data-testid="time-row-date"]')).toBeTruthy();
    expect(find('[data-testid="time-row-time"]')).toBeTruthy();
    expect(find('mat-datepicker-toggle')).toBeTruthy();
    expect(find('mat-timepicker-toggle')).toBeTruthy();
  });

  it('changing the date keeps the time', async () => {
    await open();
    await type('time-row-date', '9/28/2026');

    expect(fixture.componentInstance.control.value).toEqual(new Date(2026, 8, 28, 10, 30));
    expect(fixture.componentInstance.control.dirty).toBe(true);
  });

  it('changing the time keeps the date', async () => {
    await open();
    await type('time-row-time', '8:15 AM');

    expect(fixture.componentInstance.control.value).toEqual(new Date(2026, 8, 30, 8, 15));
  });

  it('shows an error for a time in the future', async () => {
    fixture.componentInstance.control.setValue(new Date(2026, 8, 30, 12, 5));
    fixture.componentInstance.control.markAsTouched();
    await fixture.whenStable();

    expect(find('[role="alert"]')?.textContent?.trim()).toBe(en.entrySheet.inFuture);
  });

  it('shows an error sent back by the server', async () => {
    fixture.componentInstance.control.setErrors({ server: 'inFuture' });
    fixture.componentInstance.control.markAsTouched();
    await fixture.whenStable();

    expect(find('[role="alert"]')?.textContent?.trim()).toBe(en.entrySheet.inFuture);
  });
});
