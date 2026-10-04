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
