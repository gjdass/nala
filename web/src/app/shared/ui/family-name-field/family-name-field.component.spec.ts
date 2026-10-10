import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import { createFamilyNameControl, FamilyNameFieldComponent } from './family-name-field.component';

@Component({
  imports: [FamilyNameFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-family-name-field [control]="control" />`,
})
class HostComponent {
  readonly control = createFamilyNameControl();
}

describe('FamilyNameFieldComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  const host = () => fixture.nativeElement as HTMLElement;
  const input = () => host().querySelector<HTMLInputElement>('input[data-testid="familyName"]')!;
  const error = () => host().querySelector('[data-testid="error-familyName"]')?.textContent?.trim();
  const type = async (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    input().dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('shows the translated label and binds the input to the control', async () => {
    expect(host().querySelector('mat-label')?.textContent?.trim()).toBe(en.families.name.label);
    expect(input().type).toBe('text');

    await type('The Martins');

    expect(fixture.componentInstance.control.value).toBe('The Martins');
  });

  it('requires a name once touched, spaces alone included', async () => {
    await type('   ');

    expect(error()).toBe(en.families.errors.name.required);
  });

  it('allows 50 characters after trimming and refuses 51', async () => {
    await type(` ${'a'.repeat(50)} `);
    expect(error()).toBeUndefined();

    await type('a'.repeat(51));
    expect(error()).toBe(en.families.errors.name.tooLong);
  });

  it("shows the server's error code", async () => {
    fixture.componentInstance.control.setErrors({ server: 'tooLong' });
    fixture.componentInstance.control.markAsTouched();
    await fixture.whenStable();

    expect(error()).toBe(en.families.errors.name.tooLong);
  });
});
