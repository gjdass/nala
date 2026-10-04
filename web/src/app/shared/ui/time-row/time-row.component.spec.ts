import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepicker } from '@angular/material/datepicker';
import { MatTimepicker } from '@angular/material/timepicker';
import { By } from '@angular/platform-browser';
import en from '../../../../../public/i18n/en.json';
import { SECTION_SCHEME } from '../../../core/sections/section-scheme';
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

  it('shows a start after the end sent back by the server', async () => {
    fixture.componentInstance.control.setErrors({ server: 'afterEnd' });
    fixture.componentInstance.control.markAsTouched();
    await fixture.whenStable();

    expect(find('[role="alert"]')?.textContent?.trim()).toBe(en.entrySheet.afterEnd);
  });

  it('shows a time before the start', async () => {
    fixture.componentInstance.control.setErrors({ beforeStart: true });
    fixture.componentInstance.control.markAsTouched();
    await fixture.whenStable();

    expect(find('[role="alert"]')?.textContent?.trim()).toBe(en.entrySheet.beforeStart);
  });

  describe('without a value', () => {
    beforeEach(async () => {
      fixture.componentInstance.control.setValue(null);
      await fixture.whenStable();
    });

    it('offers to add one', () => {
      expect(find('nala-form-row')?.textContent).toContain(en.entrySheet.add);
    });

    it('is set to now once tapped, with the pickers open', async () => {
      await open();

      expect(fixture.componentInstance.control.value).toEqual(NOW);
      expect(fixture.componentInstance.control.dirty).toBe(true);
      expect(find('[data-testid="time-row-time"]')).toBeTruthy();
      expect(find('nala-form-row')?.textContent).toContain(`Today ${shortTime(NOW)}`);
    });
  });
});

@Component({
  imports: [TimeRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-time-row label="Date" dateOnly [control]="control" />`,
})
class DateOnlyHost {
  readonly control = new FormControl<Date | null>(new Date(2026, 8, 30), [Validators.required]);
}

describe('TimeRowComponent, date only (spec 10)', () => {
  let fixture: ComponentFixture<DateOnlyHost>;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(selector: string) =>
    host().querySelector<T>(selector);
  const open = async () => {
    find<HTMLButtonElement>('nala-form-row button')!.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    await TestBed.configureTestingModule({
      imports: [DateOnlyHost, translocoTesting()],
      providers: [provideNativeDateAdapter()],
    }).compileComponents();
    fixture = TestBed.createComponent(DateOnlyHost);
    await fixture.whenStable();
  });

  afterEach(() => vi.useRealTimers());

  it('shows the date without a time: "Today", "Yesterday", then the date', async () => {
    expect(find('nala-form-row')?.textContent).toContain('Today');
    expect(find('nala-form-row')?.textContent).not.toContain(':');

    fixture.componentInstance.control.setValue(new Date(2026, 8, 29));
    await fixture.whenStable();
    expect(find('nala-form-row')?.textContent).toContain('Yesterday');

    fixture.componentInstance.control.setValue(new Date(2026, 8, 20));
    await fixture.whenStable();
    expect(find('nala-form-row')?.textContent).toContain('Sep 20');
  });

  it('offers a datepicker only', async () => {
    await open();

    expect(find('[data-testid="time-row-date"]')).toBeTruthy();
    expect(find('[data-testid="time-row-time"]')).toBeNull();
    expect(find('mat-timepicker-toggle')).toBeNull();
  });

  it('sets the picked date at local midnight', async () => {
    await open();
    const input = find<HTMLInputElement>('[data-testid="time-row-date"]')!;
    input.value = '9/28/2026';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(fixture.componentInstance.control.value).toEqual(new Date(2026, 8, 28));
    expect(fixture.componentInstance.control.dirty).toBe(true);
  });

  it('is set to today at midnight when tapped without a value', async () => {
    fixture.componentInstance.control.setValue(null);
    await fixture.whenStable();

    await open();

    expect(fixture.componentInstance.control.value).toEqual(new Date(2026, 8, 30));
  });

  it('shows a date before the birth', async () => {
    fixture.componentInstance.control.setErrors({ beforeBirth: true });
    fixture.componentInstance.control.markAsTouched();
    await fixture.whenStable();

    expect(en.entrySheet.beforeBirth).toBe("Can't be before the birth date.");
    expect(find('[role="alert"]')?.textContent?.trim()).toBe(en.entrySheet.beforeBirth);
  });

  it('shows a date before the birth sent back by the server', async () => {
    fixture.componentInstance.control.setErrors({ server: 'beforeBirth' });
    fixture.componentInstance.control.markAsTouched();
    await fixture.whenStable();

    expect(find('[role="alert"]')?.textContent?.trim()).toBe(en.entrySheet.beforeBirth);
  });
});

describe('TimeRowComponent, in a section (spec 04)', () => {
  const pickers = async (scheme: string | null) => {
    TestBed.configureTestingModule({
      imports: [Host, translocoTesting()],
      providers: [
        provideNativeDateAdapter(),
        ...(scheme ? [{ provide: SECTION_SCHEME, useValue: scheme }] : []),
      ],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('nala-form-row button')!
      .click();
    await fixture.whenStable();
    return {
      date: fixture.debugElement.query(By.directive(MatDatepicker)).componentInstance
        .panelClass as string[],
      time: fixture.debugElement.query(By.directive(MatTimepicker)).componentInstance.panelClass(),
    };
  };

  it("opens its date and time pickers in the section's colour scheme", async () => {
    const { date, time } = await pickers('nala-scheme-sleep');

    expect(date).toEqual(['nala-scheme-sleep']);
    expect(time).toBe('nala-scheme-sleep');
  });

  it('keeps the app scheme outside a section', async () => {
    const { date, time } = await pickers(null);

    expect(date).toEqual([]);
    expect(time).toBeUndefined();
  });
});
