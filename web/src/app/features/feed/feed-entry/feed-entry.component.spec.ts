import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatListModule } from '@angular/material/list';
import en from '../../../../../public/i18n/en.json';
import { aBottle, aBreastfeed, aSegment, aSolids } from '../../../testing/feeds';
import { NowService } from '../../../core/time/now.service';
import { translocoTesting } from '../../../testing/transloco-testing';
import { FeedEntryComponent } from './feed-entry.component';

describe('FeedEntryComponent', () => {
  let fixture: ComponentFixture<FeedEntryComponent>;
  const now = signal(new Date('2026-09-30T10:10:00Z').getTime());

  const find = (testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeedEntryComponent, MatListModule, translocoTesting()],
      providers: [{ provide: NowService, useValue: { now } }],
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

  it('shows the live total of a live breastfeed, ticking', async () => {
    now.set(new Date('2026-09-30T10:10:00Z').getTime());
    fixture.componentRef.setInput(
      'feed',
      aBreastfeed({
        endTime: null,
        segments: [
          aSegment('left', '2026-09-30T10:00:00Z', '2026-09-30T10:05:00Z'),
          aSegment('right', '2026-09-30T10:05:00Z', null),
        ],
      }),
    );
    await fixture.whenStable();
    expect(find('entry-summary')?.textContent?.trim()).toBe('Total 10m · L 5m · R 5m');

    now.set(new Date('2026-09-30T10:10:30Z').getTime());
    fixture.detectChanges();
    expect(find('entry-summary')?.textContent?.trim()).toBe('Total 10m 30s · L 5m · R 5m 30s');
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

  it('shows solids with their icon, "time · meal type · reaction", then the food on one line', async () => {
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
    expect(
      find('entry-time')?.closest('[matListItemTitle]')?.textContent?.replace(/\s+/g, ' ').trim(),
    ).toBe(
      `${find('entry-time')?.textContent?.trim()} · ${en.feed.mealType.lunch} · ${en.feed.reaction.allergicReaction}`,
    );
    expect(find('entry-summary')?.textContent?.trim()).toBe('Carrot purée');
    expect(find('entry-summary')?.closest('[matListItemLine]')).toBeTruthy();
    const classes = (fixture.nativeElement as HTMLElement).querySelector('button')?.classList;
    expect(classes).toContain('mdc-list-item--with-two-lines');
    expect(classes).not.toContain('mdc-list-item--with-three-lines');
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

  it('shows a breastfeed with its icon, the total and the per-side split, without a bar', async () => {
    fixture.componentRef.setInput('feed', aBreastfeed());
    await fixture.whenStable();

    expect(find('entry-icon')?.textContent?.trim()).toBe('breastfeeding');
    expect(find('entry-time')?.textContent?.trim()).toBeTruthy();
    expect(find('entry-bar')).toBeNull();
    expect(find('entry-duration')).toBeNull();
    expect(find('entry-summary')?.textContent?.trim()).toBe('Total 8m 30s · L 5m · R 3m 30s');
  });

  it('leaves out a side that was not used', async () => {
    fixture.componentRef.setInput(
      'feed',
      aBreastfeed({
        segments: [aSegment('right', '2026-09-30T10:00:00Z', '2026-09-30T10:04:00Z')],
      }),
    );
    await fixture.whenStable();

    expect(find('entry-summary')?.textContent?.trim()).toBe('Total 4m · R 4m');
  });
});
