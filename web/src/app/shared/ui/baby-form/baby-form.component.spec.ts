import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import en from '../../../../../public/i18n/en.json';
import { NowService } from '../../../core/time/now.service';
import { fakeNow } from '../../../testing/now';
import { translocoTesting } from '../../../testing/transloco-testing';
import { BabyFormComponent, babyFields, createBabyForm } from './baby-form.component';

@Component({
  imports: [BabyFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-baby-form [form]="form" />`,
})
class HostComponent {
  readonly form = createBabyForm();
}

describe('BabyFormComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let now: ReturnType<typeof signal<number>>;

  const form = () => fixture.componentInstance.form;
  const host = () => fixture.nativeElement as HTMLElement;
  const input = (field: string) =>
    host().querySelector<HTMLInputElement>(`input[data-testid="${field}"]`)!;
  const error = (field: string) =>
    host().querySelector(`[data-testid="error-${field}"]`)?.textContent?.trim();
  const type = async (field: string, value: string) => {
    input(field).value = value;
    input(field).dispatchEvent(new Event('input'));
    input(field).dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  };
  const refresh = async () => {
    fixture.componentRef.changeDetectorRef.markForCheck();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    // Local 27 Sep 2026, 10:00.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 27, 10, 0));
    now = signal(new Date(2026, 8, 27, 10, 0).getTime());
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
      providers: [provideNativeDateAdapter(), { provide: NowService, useValue: fakeNow(now) }],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  afterEach(() => vi.useRealTimers());

  it("keeps the birth date's calendar up to today, which moves on at midnight", async () => {
    expect(input('birthDate').getAttribute('max')).toBe('2026-09-27');

    now.set(new Date(2026, 8, 28, 0, 0, 1).getTime());
    await refresh();

    expect(input('birthDate').getAttribute('max')).toBe('2026-09-28');
  });

  it('renders every field with its label and unit', () => {
    const text = host().textContent!;
    expect(input('name').type).toBe('text');
    expect(input('birthDate')).toBeTruthy();
    expect(input('birthWeightG').type).toBe('number');
    expect(input('birthLengthCm').type).toBe('number');
    expect(input('birthHeadCircumferenceCm').type).toBe('number');
    for (const label of Object.values(en.babies.fields)) {
      expect(text).toContain(label);
    }
    expect(text).toContain(en.babies.units.g);
    expect(text).toContain(en.babies.units.cm);
  });

  it('offers girl, boy and unspecified, unspecified by default', () => {
    const toggles = [...host().querySelectorAll('[data-testid^="sex-"]')];
    expect(toggles.map((t) => t.textContent?.trim())).toEqual([
      en.babies.sex.girl,
      en.babies.sex.boy,
      en.babies.sex.unspecified,
    ]);
    expect(form().controls.sex.value).toBe('unspecified');
  });

  it('opens the calendar from the birth date field, capped at today', () => {
    expect(input('birthDate').readOnly).toBe(true);
    input('birthDate').click();
    // The capped calendar is the datepicker's; the form's own rule is checked below.
    expect(document.querySelector('mat-calendar')).toBeTruthy();
  });

  it('requires a name and a birth date', async () => {
    form().markAllAsTouched();
    await refresh();

    expect(error('name')).toBe(en.babies.errors.name.required);
    expect(error('birthDate')).toBe(en.babies.errors.birthDate.required);
    expect(form().valid).toBe(false);
  });

  it('limits the name to 50 characters after trimming', async () => {
    await type('name', ` ${'a'.repeat(50)} `);
    expect(form().controls.name.valid).toBe(true);

    await type('name', 'a'.repeat(51));
    expect(error('name')).toBe(en.babies.errors.name.tooLong);
  });

  it('refuses a birth date after today', async () => {
    const birthDate = form().controls.birthDate;
    birthDate.setValue(new Date(2026, 8, 27));
    expect(birthDate.valid).toBe(true);

    birthDate.setValue(new Date(2026, 8, 28));
    birthDate.markAsTouched();
    await refresh();
    expect(error('birthDate')).toBe(en.babies.errors.birthDate.inFuture);
  });

  it.each([
    ['birthWeightG', '299', 'outOfRange'],
    ['birthWeightG', '7001', 'outOfRange'],
    ['birthWeightG', '3400.5', 'invalid'],
    ['birthLengthCm', '19.9', 'outOfRange'],
    ['birthLengthCm', '70.1', 'outOfRange'],
    ['birthLengthCm', '49.55', 'invalid'],
    ['birthHeadCircumferenceCm', '14.9', 'outOfRange'],
    ['birthHeadCircumferenceCm', '50.1', 'outOfRange'],
    ['birthHeadCircumferenceCm', '34.55', 'invalid'],
  ] as const)('shows %s = %s as %s', async (field, value, code) => {
    await type(field, value);

    expect(error(field)).toBe(en.babies.errors[field][code]);
  });

  it.each([
    ['birthWeightG', '300'],
    ['birthWeightG', '7000'],
    ['birthLengthCm', '49.5'],
    ['birthHeadCircumferenceCm', '34.5'],
  ] as const)('accepts %s = %s', async (field, value) => {
    await type(field, value);

    expect(form().controls[field].valid).toBe(true);
  });

  it('turns the form into the API fields, birth date as a local calendar date', async () => {
    await type('name', '  Lea ');
    form().controls.birthDate.setValue(new Date(2026, 8, 1));
    form().controls.sex.setValue('girl');
    await type('birthWeightG', '3400');
    await type('birthLengthCm', '50.5');

    expect(form().valid).toBe(true);
    expect(babyFields(form())).toEqual({
      name: 'Lea',
      birthDate: '2026-09-01',
      sex: 'girl',
      birthWeightG: 3400,
      birthLengthCm: 50.5,
      birthHeadCircumferenceCm: null,
    });
  });

  it('shows a server error code set on a control', async () => {
    const name = form().controls.name;
    name.setValue('Lea');
    name.markAsTouched();
    name.setErrors({ server: 'tooLong' });
    await refresh();

    expect(error('name')).toBe(en.babies.errors.name.tooLong);
  });
});
