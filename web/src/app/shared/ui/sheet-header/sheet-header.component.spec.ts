import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import { SheetHeaderComponent } from './sheet-header.component';

@Component({
  imports: [SheetHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-sheet-header
    title="Add a baby"
    [saveDisabled]="disabled()"
    (closed)="closes = closes + 1"
    (saved)="saves = saves + 1"
  />`,
})
class HostComponent {
  readonly disabled = signal(false);
  closes = 0;
  saves = 0;
}

describe('SheetHeaderComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  const host = () => fixture.nativeElement as HTMLElement;
  const button = (testId: string) =>
    host().querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('shows the title, a labelled close button and Save', () => {
    expect(host().querySelector('[data-testid="sheet-title"]')?.textContent?.trim()).toBe(
      'Add a baby',
    );
    expect(button('sheet-close').getAttribute('aria-label')).toBe(en.sheet.close);
    expect(button('sheet-save').textContent?.trim()).toBe(en.sheet.save);
  });

  it('emits closed and saved', () => {
    button('sheet-close').click();
    button('sheet-save').click();

    expect(fixture.componentInstance.closes).toBe(1);
    expect(fixture.componentInstance.saves).toBe(1);
  });

  it('disables Save on demand', async () => {
    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();

    expect(button('sheet-save').disabled).toBe(true);
  });
});
