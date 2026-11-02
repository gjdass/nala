import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { translocoTesting } from '../../../testing/transloco-testing';
import { DateRange, DateRangeFieldComponent } from './date-range-field.component';

describe('DateRangeFieldComponent', () => {
  let fixture: ComponentFixture<DateRangeFieldComponent>;
  let ranges: DateRange[];

  const host = () => fixture.nativeElement as HTMLElement;
  const input = (testId: string) =>
    host().querySelector<HTMLInputElement>(`[data-testid="${testId}"]`)!;
  const type = async (testId: string, value: string) => {
    input(testId).value = value;
    input(testId).dispatchEvent(new Event('input'));
    input(testId).dispatchEvent(new Event('change'));
    input(testId).dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateRangeFieldComponent, translocoTesting()],
      providers: [provideNativeDateAdapter()],
    }).compileComponents();
    fixture = TestBed.createComponent(DateRangeFieldComponent);
    ranges = [];
    fixture.componentInstance.rangeChange.subscribe((r) => ranges.push(r));
    fixture.componentRef.setInput('label', 'history.window.range');
    fixture.componentRef.setInput('start', new Date(2026, 7, 4));
    fixture.componentRef.setInput('end', new Date(2026, 10, 2));
    await fixture.whenStable();
  });

  it('is a Material date range field with a label, start and end inputs and a picker toggle', () => {
    expect(host().querySelector('mat-form-field mat-date-range-input')).not.toBeNull();
    expect(host().querySelector('mat-label')?.textContent?.trim()).toBe('Dates');
    expect(input('range-start').getAttribute('aria-label')).toBe('Start date');
    expect(input('range-end').getAttribute('aria-label')).toBe('End date');
    expect(host().querySelector('mat-datepicker-toggle')).not.toBeNull();
    expect(host().querySelector('mat-date-range-picker')).not.toBeNull();
  });

  it('shows the given dates', () => {
    expect(new Date(input('range-start').value)).toEqual(new Date(2026, 7, 4));
    expect(new Date(input('range-end').value)).toEqual(new Date(2026, 10, 2));
    expect(ranges).toEqual([]);
  });

  it('follows new dates from its inputs', async () => {
    fixture.componentRef.setInput('start', new Date(2026, 0, 1));
    await fixture.whenStable();

    expect(new Date(input('range-start').value)).toEqual(new Date(2026, 0, 1));
    expect(ranges).toEqual([]);
  });

  it('emits the range once a date changes and the range is complete and in order', async () => {
    await type('range-start', '9/1/2026');

    expect(ranges).toEqual([{ start: new Date(2026, 8, 1), end: new Date(2026, 10, 2) }]);
  });

  it('emits nothing for an incomplete or reversed range', async () => {
    await type('range-end', '');
    await type('range-start', '12/1/2026');
    await type('range-end', '11/1/2026');

    expect(ranges).toEqual([]);
  });

  it('passes the latest date to the picker', async () => {
    fixture.componentRef.setInput('max', new Date(2026, 10, 2));
    await fixture.whenStable();

    expect(input('range-end').getAttribute('max')).toBe('2026-11-02');
  });
});
