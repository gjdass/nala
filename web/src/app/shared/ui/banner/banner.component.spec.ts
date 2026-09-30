import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BannerComponent } from './banner.component';

describe('BannerComponent', () => {
  let fixture: ComponentFixture<BannerComponent>;
  let actions: number;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const set = async (inputs: Record<string, unknown>) => {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BannerComponent] }).compileComponents();
    fixture = TestBed.createComponent(BannerComponent);
    actions = 0;
    fixture.componentInstance.action.subscribe(() => actions++);
    await set({ icon: 'schedule', title: 'Still feeding?', text: 'Started 3h ago.' });
  });

  it('shows its icon, title and text as a status', () => {
    expect(find('banner-icon')?.textContent?.trim()).toBe('schedule');
    expect(find('banner-title')?.textContent?.trim()).toBe('Still feeding?');
    expect(find('banner-text')?.textContent?.trim()).toBe('Started 3h ago.');
    expect(host().getAttribute('role')).toBe('status');
  });

  it('has no action without a label', () => {
    expect(find('banner-action')).toBeNull();
  });

  it('emits its action when tapped', async () => {
    await set({ actionLabel: 'Review' });

    const button = find('banner-action')!;
    expect(button.textContent?.trim()).toBe('Review');
    button.click();

    expect(actions).toBe(1);
  });
});
