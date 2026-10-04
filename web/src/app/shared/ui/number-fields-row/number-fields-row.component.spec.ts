import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { NumberField, NumberFieldsRowComponent } from './number-fields-row.component';

@Component({
  imports: [NumberFieldsRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-number-fields-row
    [fields]="fields"
    suffix="ml"
    [min]="0"
    [max]="500"
    error="0 to 500 ml"
  />`,
})
class Host {
  readonly left = new FormControl<number | null>(90, [Validators.min(0), Validators.max(500)]);
  readonly right = new FormControl<number | null>(null, [Validators.min(0), Validators.max(500)]);
  readonly fields: NumberField[] = [
    { name: 'left', label: 'Left', control: this.left },
    { name: 'right', label: 'Right', control: this.right },
  ];
}

describe('NumberFieldsRowComponent', () => {
  let fixture: ComponentFixture<Host>;

  const host = () => fixture.nativeElement as HTMLElement;
  const input = (name: string) =>
    host().querySelector<HTMLInputElement>(`[data-testid="${name}"]`)!;
  const type = async (name: string, value: string) => {
    input(name).value = value;
    input(name).dispatchEvent(new Event('input'));
    input(name).dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  it('shows one labelled number field per field, side by side, with the suffix', () => {
    const fields = host().querySelectorAll('mat-form-field');
    expect(fields.length).toBe(2);
    expect(fields[0].textContent).toContain('Left');
    expect(fields[0].textContent).toContain('ml');
    expect(fields[1].textContent).toContain('Right');
    expect(input('left').type).toBe('number');
    expect(input('left').inputMode).toBe('numeric');
    expect(input('left').min).toBe('0');
    expect(input('left').max).toBe('500');
    expect(input('left').step).toBe('1');
    expect(host().querySelector('.fields')).toBeTruthy();
  });

  it('binds each field to its control', async () => {
    expect(input('left').value).toBe('90');
    expect(input('right').value).toBe('');

    await type('right', '80');

    expect(fixture.componentInstance.right.value).toBe(80);
  });

  it('shows the error on an invalid field only', async () => {
    await type('left', '501');

    const errors = host().querySelectorAll('mat-error');
    expect(errors.length).toBe(1);
    expect(errors[0].textContent).toContain('0 to 500 ml');
  });
});

@Component({
  imports: [NumberFieldsRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-number-fields-row [fields]="fields" />`,
})
class PerFieldHost {
  readonly weight = new FormControl<number | null>(null, [Validators.min(0.3), Validators.max(30)]);
  readonly length = new FormControl<number | null>(null, [Validators.min(20), Validators.max(130)]);
  readonly fields: NumberField[] = [
    {
      name: 'weight',
      label: 'Weight',
      control: this.weight,
      suffix: 'kg',
      min: 0.3,
      max: 30,
      step: 0.001,
      error: '0.3 to 30 kg',
    },
    {
      name: 'length',
      label: 'Length',
      control: this.length,
      suffix: 'cm',
      min: 20,
      max: 130,
      step: 0.1,
      error: '20 to 130 cm',
    },
  ];
}

describe('NumberFieldsRowComponent, per-field units and bounds (spec 10)', () => {
  let fixture: ComponentFixture<PerFieldHost>;

  const host = () => fixture.nativeElement as HTMLElement;
  const input = (name: string) =>
    host().querySelector<HTMLInputElement>(`[data-testid="${name}"]`)!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PerFieldHost] }).compileComponents();
    fixture = TestBed.createComponent(PerFieldHost);
    await fixture.whenStable();
  });

  it('gives each field its own suffix, bounds and step, with the decimal keyboard for decimals', () => {
    const fields = host().querySelectorAll('mat-form-field');
    expect(fields[0].textContent).toContain('kg');
    expect(fields[1].textContent).toContain('cm');
    expect(input('weight').min).toBe('0.3');
    expect(input('weight').max).toBe('30');
    expect(input('weight').step).toBe('0.001');
    expect(input('weight').inputMode).toBe('decimal');
    expect(input('length').min).toBe('20');
    expect(input('length').step).toBe('0.1');
    expect(input('length').inputMode).toBe('decimal');
  });

  it("shows each field's own error", async () => {
    input('length').value = '150';
    input('length').dispatchEvent(new Event('input'));
    input('length').dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    const errors = host().querySelectorAll('mat-error');
    expect(errors.length).toBe(1);
    expect(errors[0].textContent).toContain('20 to 130 cm');
  });
});
