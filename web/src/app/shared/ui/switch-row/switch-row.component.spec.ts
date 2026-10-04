import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { SwitchRowComponent } from './switch-row.component';

@Component({
  imports: [SwitchRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-switch-row label="Diaper rash" name="rash" [control]="control" />`,
})
class Host {
  readonly control = new FormControl(false, { nonNullable: true });
}

describe('SwitchRowComponent', () => {
  let fixture: ComponentFixture<Host>;

  const host = () => fixture.nativeElement as HTMLElement;
  const toggle = () => host().querySelector<HTMLButtonElement>('[data-testid="rash"] button')!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  it('shows the label with a switch reflecting the control', async () => {
    expect(host().textContent).toContain('Diaper rash');
    expect(host().querySelector('mat-slide-toggle')).toBeTruthy();
    expect(toggle().getAttribute('aria-checked')).toBe('false');

    fixture.componentInstance.control.setValue(true);
    await fixture.whenStable();

    expect(toggle().getAttribute('aria-checked')).toBe('true');
  });

  it('switches the control on and off, marking it dirty', async () => {
    toggle().click();
    await fixture.whenStable();

    expect(fixture.componentInstance.control.value).toBe(true);
    expect(fixture.componentInstance.control.dirty).toBe(true);

    toggle().click();
    await fixture.whenStable();

    expect(fixture.componentInstance.control.value).toBe(false);
  });

  it('names the switch with the label', () => {
    expect(toggle().getAttribute('aria-label')).toBe('Diaper rash');
  });
});
