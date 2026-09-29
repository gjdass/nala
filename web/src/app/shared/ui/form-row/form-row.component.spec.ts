import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormRowComponent } from './form-row.component';

@Component({
  imports: [FormRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-form-row
      label="Start time"
      [value]="value()"
      [error]="error()"
      (activate)="activations = activations + 1"
      data-testid="time"
    >
      <span rowEditor data-testid="editor">editor</span>
    </nala-form-row>
    <nala-form-row label="Diaper rash" [interactive]="false" data-testid="rash">
      <span rowTrailing data-testid="switch">switch</span>
    </nala-form-row>`,
})
class Host {
  readonly value = signal('Today 2:37 PM');
  readonly error = signal<string | null>(null);
  activations = 0;
}

describe('FormRowComponent', () => {
  let fixture: ComponentFixture<Host>;

  const host = () => fixture.nativeElement as HTMLElement;
  const row = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
  const item = (testId: string) =>
    row(testId).querySelector<HTMLElement>('[mat-list-item], mat-list-item')!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  it('shows the label as headline and the value as trailing text', () => {
    expect(row('time').querySelector('[matListItemTitle]')?.textContent?.trim()).toBe('Start time');
    expect(row('time').querySelector('[matListItemMeta]')?.textContent?.trim()).toBe(
      'Today 2:37 PM',
    );
  });

  it('is a tappable list item (48 dp) that emits activate', () => {
    expect(item('time').tagName).toBe('BUTTON');

    item('time').click();

    expect(fixture.componentInstance.activations).toBe(1);
  });

  it('shows its projected editor under the item', () => {
    expect(row('time').querySelector('[data-testid="editor"]')?.textContent).toBe('editor');
  });

  it('shows an error as an alert only when there is one', async () => {
    expect(row('time').querySelector('[role="alert"]')).toBeNull();

    fixture.componentInstance.error.set('Enter a time');
    await fixture.whenStable();

    expect(row('time').querySelector('[role="alert"]')?.textContent?.trim()).toBe('Enter a time');
  });

  it('shows projected trailing content, such as a switch, on a non-tappable item', () => {
    expect(item('rash').tagName).not.toBe('BUTTON');
    expect(row('rash').querySelector('[matListItemMeta] [data-testid="switch"]')).not.toBeNull();
  });
});
