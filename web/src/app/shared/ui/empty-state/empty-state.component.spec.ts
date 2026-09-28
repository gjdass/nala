import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state.component';

@Component({
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-empty-state icon="child_care" title="No baby yet" text="Add your baby to start.">
    <button data-testid="action">Add</button>
  </nala-empty-state>`,
})
class HostComponent {}

describe('EmptyStateComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  const text = (testId: string) =>
    (fixture.nativeElement as HTMLElement)
      .querySelector(`[data-testid="${testId}"]`)
      ?.textContent?.trim();

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('shows the icon, title, text and the projected action', () => {
    expect(text('empty-icon')).toBe('child_care');
    expect(text('empty-title')).toBe('No baby yet');
    expect(text('empty-text')).toBe('Add your baby to start.');
    expect(text('action')).toBe('Add');
  });
});
