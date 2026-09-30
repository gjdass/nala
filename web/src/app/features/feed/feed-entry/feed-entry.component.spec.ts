import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatListModule } from '@angular/material/list';
import en from '../../../../../public/i18n/en.json';
import { aBottle, aSolids } from '../../../testing/feeds';
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

  it('shows a bottle without a label', async () => {
    fixture.componentRef.setInput('feed', aBottle());
    await fixture.whenStable();

    expect(find('entry-label')).toBeNull();
  });

  it('shows solids with their icon, time, meal type and reaction, then the food on up to 2 lines', async () => {
    fixture.componentRef.setInput(
      'feed',
      aSolids({ mealType: 'lunch', food: 'Carrot purée', reaction: 'allergicReaction' }),
    );
    await fixture.whenStable();

    expect(find('entry-icon')?.textContent?.trim()).toBe('nutrition');
    expect(find('entry-time')?.textContent?.trim()).toBeTruthy();
    expect(find('entry-label')?.textContent?.trim()).toBe(
      `${en.feed.mealType.lunch} · ${en.feed.reaction.allergicReaction}`,
    );
    expect(find('entry-summary')?.textContent?.trim()).toBe('Carrot purée');
    expect(find('entry-summary')?.closest('.mdc-list-item__secondary-text')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('button')?.classList).toContain(
      'mdc-list-item--with-three-lines',
    );
    expect(find('entry-bar')).toBeNull();
  });

  it('shows the reaction alone when solids have no meal type', async () => {
    fixture.componentRef.setInput('feed', aSolids({ mealType: null, reaction: 'liked' }));
    await fixture.whenStable();

    expect(find('entry-label')?.textContent?.trim()).toBe(en.feed.reaction.liked);
  });

  it('shows solids without meal type or reaction', async () => {
    fixture.componentRef.setInput('feed', aSolids({ mealType: null, reaction: null }));
    await fixture.whenStable();

    expect(find('entry-label')).toBeNull();
    expect(find('entry-summary')?.textContent?.trim()).toBe('Carrot purée');
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
