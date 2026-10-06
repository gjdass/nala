import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepicker } from '@angular/material/datepicker';
import { By } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';
import en from '../../../../../public/i18n/en.json';
import fr from '../../../../../public/i18n/fr.json';
import { SECTION_SCHEME } from '../../../core/sections/section-scheme';
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

  const input = (testId: string) => find<HTMLInputElement>(`[data-testid="${testId}"]`)!;
  const period = (value: 'am' | 'pm') =>
    find<HTMLButtonElement>(`[data-testid="time-row-${value}"] button`)!;
  const value = () => fixture.componentInstance.control.value;

  it('hides the pickers until the row is tapped', async () => {
    expect(find('[data-testid="time-row-date"]')).toBeNull();
    expect(find('[data-testid="time-row-hour"]')).toBeNull();

    await open();

    expect(find('[data-testid="time-row-date"]')).toBeTruthy();
    expect(find('mat-datepicker-toggle')).toBeTruthy();
    expect(find('[data-testid="time-row-hour"]')).toBeTruthy();
    expect(find('[data-testid="time-row-minute"]')).toBeTruthy();
    expect(find('mat-timepicker-toggle')).toBeNull();
  });

  it('types the time with hour and minute fields and the numeric keypad, AM / PM in English', async () => {
    await open();

    expect(input('time-row-hour').value).toBe('10');
    expect(input('time-row-minute').value).toBe('30');
    expect(input('time-row-hour').getAttribute('inputmode')).toBe('numeric');
    expect(input('time-row-minute').getAttribute('inputmode')).toBe('numeric');
    expect(period('am').getAttribute('aria-checked')).toBe('true');
    expect(period('pm').getAttribute('aria-checked')).toBe('false');
    expect(host().textContent).toContain(en.entrySheet.hour);
    expect(host().textContent).toContain(en.entrySheet.minute);
  });

  it('lets the hour, minute and AM / PM line shrink to the sheet width', async () => {
    await open();

    expect(getComputedStyle(find('.time')!).minWidth).toMatch(/^0(px)?$/);
  });

  it('shows minutes on two digits', async () => {
    fixture.componentInstance.control.setValue(new Date(2026, 8, 30, 14, 5));
    await open();

    expect(input('time-row-hour').value).toBe('2');
    expect(input('time-row-minute').value).toBe('05');
    expect(period('pm').getAttribute('aria-checked')).toBe('true');
  });

  it('changes the hour or the minute exactly, keeping the date', async () => {
    await open();

    await type('time-row-hour', '8');
    expect(value()).toEqual(new Date(2026, 8, 30, 8, 30));
    expect(fixture.componentInstance.control.dirty).toBe(true);

    await type('time-row-minute', '17');
    expect(value()).toEqual(new Date(2026, 8, 30, 8, 17));
  });

  it('switches between AM and PM', async () => {
    await open();

    period('pm').click();
    await fixture.whenStable();
    expect(value()).toEqual(new Date(2026, 8, 30, 22, 30));

    period('am').click();
    await fixture.whenStable();
    expect(value()).toEqual(new Date(2026, 8, 30, 10, 30));
  });

  it('reads 12 AM as midnight and 12 PM as noon', async () => {
    await open();

    await type('time-row-hour', '12');
    expect(value()).toEqual(new Date(2026, 8, 30, 0, 30));

    period('pm').click();
    await fixture.whenStable();
    expect(value()).toEqual(new Date(2026, 8, 30, 12, 30));
  });

  it('refuses an hour outside 1–12 or a minute outside 0–59, keeping the time', async () => {
    await open();

    await type('time-row-hour', '13');
    expect(value()).toEqual(new Date(2026, 8, 30, 10, 30));
    expect(host().textContent).toContain(en.entrySheet.hourRange12);

    await type('time-row-hour', '10');
    await type('time-row-minute', '60');
    expect(value()).toEqual(new Date(2026, 8, 30, 10, 30));
    expect(host().textContent).toContain(en.entrySheet.minuteRange);
  });

  it('follows a value changed elsewhere', async () => {
    await open();

    fixture.componentInstance.control.setValue(new Date(2026, 8, 30, 21, 45));
    await fixture.whenStable();

    expect(input('time-row-hour').value).toBe('9');
    expect(input('time-row-minute').value).toBe('45');
    expect(period('pm').getAttribute('aria-checked')).toBe('true');
  });

  it('selects a field once it gets the focus, so typing replaces it', async () => {
    await open();
    const select = vi.spyOn(input('time-row-hour'), 'select');

    input('time-row-hour').dispatchEvent(new FocusEvent('focus'));

    expect(select).toHaveBeenCalled();
  });

  it('types a 24-hour time in French, without AM / PM', async () => {
    TestBed.inject(TranslocoService).setActiveLang('fr');
    await open();

    expect(input('time-row-hour').value).toBe('10');
    expect(find('[data-testid="time-row-am"]')).toBeNull();
    expect(host().textContent).toContain(fr.entrySheet.hour);

    await type('time-row-hour', '22');
    expect(value()).toEqual(new Date(2026, 8, 30, 22, 30));

    await type('time-row-hour', '24');
    expect(value()).toEqual(new Date(2026, 8, 30, 22, 30));
    expect(host().textContent).toContain(fr.entrySheet.hourRange24);
  });

  it('changing the date keeps the time', async () => {
    await open();
    await type('time-row-date', '9/28/2026');

    expect(fixture.componentInstance.control.value).toEqual(new Date(2026, 8, 28, 10, 30));
    expect(fixture.componentInstance.control.dirty).toBe(true);
  });

  it('shows no error for a time in the future', async () => {
    fixture.componentInstance.control.setValue(new Date(2026, 9, 2, 12, 5));
    fixture.componentInstance.control.markAsTouched();
    await fixture.whenStable();

    expect(find('[role="alert"]')).toBeNull();
  });

  it('shows an error sent back by the server', async () => {
    fixture.componentInstance.control.setErrors({ server: 'beforeStart' });
    fixture.componentInstance.control.markAsTouched();
    await fixture.whenStable();

    expect(find('[role="alert"]')?.textContent?.trim()).toBe(en.entrySheet.beforeStart);
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
      expect(find('[data-testid="time-row-hour"]')).toBeTruthy();
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
    expect(find('[data-testid="time-row-hour"]')).toBeNull();
    expect(find('[data-testid="time-row-minute"]')).toBeNull();
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
    return fixture.debugElement.query(By.directive(MatDatepicker)).componentInstance
      .panelClass as string[];
  };

  it("opens its datepicker in the section's colour scheme", async () => {
    expect(await pickers('nala-scheme-sleep')).toEqual(['nala-scheme-sleep']);
  });

  it('keeps the app scheme outside a section', async () => {
    expect(await pickers(null)).toEqual([]);
  });
});
