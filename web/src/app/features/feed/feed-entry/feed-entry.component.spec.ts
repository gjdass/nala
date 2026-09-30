import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatListModule } from '@angular/material/list';
import { aBottle } from '../../../testing/feeds';
import { translocoTesting } from '../../../testing/transloco-testing';
import { FeedEntryComponent } from './feed-entry.component';

describe('FeedEntryComponent', () => {
  let fixture: ComponentFixture<FeedEntryComponent>;

  const find = (testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeedEntryComponent, MatListModule, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(FeedEntryComponent);
  });

  it('shows a bottle with its icon, time, milk type and amount', async () => {
    const feed = aBottle({ milkType: 'formula', amountMl: 120 });
    fixture.componentRef.setInput('feed', feed);
    await fixture.whenStable();

    expect(find('entry-icon')?.textContent?.trim()).toBe('water_bottle');
    expect(find('entry-time')?.textContent?.trim()).toBeTruthy();
    expect(find('entry-summary')?.textContent?.trim()).toBe('Formula · 120 ml');
    expect(find('entry-bar')).toBeNull();
  });

  it('names breast milk', async () => {
    fixture.componentRef.setInput('feed', aBottle({ milkType: 'breastMilk', amountMl: 90 }));
    await fixture.whenStable();

    expect(find('entry-summary')?.textContent?.trim()).toBe('Breast milk · 90 ml');
  });

  it('emits open when tapped', async () => {
    fixture.componentRef.setInput('feed', aBottle());
    const opened = vi.fn();
    fixture.componentInstance.open.subscribe(opened);
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!.click();

    expect(opened).toHaveBeenCalled();
  });
});
