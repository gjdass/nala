import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { Feed, FeedDeleteResult, FeedResult } from '../../../core/feeds/feed.models';
import { FeedService } from '../../../core/feeds/feed.service';
import { EntrySheetData } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';
import { aSolids } from '../../../testing/feeds';
import { translocoTesting } from '../../../testing/transloco-testing';
import { FEED_SECTION } from '../feed.section';
import { SolidsSheetComponent } from './solids-sheet.component';

const NOW = new Date(2026, 8, 30, 12, 0, 0);
const shortTime = (d: Date) => new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(d);

describe('SolidsSheetComponent', () => {
  let fixture: ComponentFixture<SolidsSheetComponent>;
  let saved: Subject<FeedResult>;
  let deleted: Subject<FeedDeleteResult>;
  let feeds: Record<'create' | 'update' | 'delete', ReturnType<typeof vi.fn>>;
  let sheetRef: { close: ReturnType<typeof vi.fn> };
  let confirmed: Subject<boolean | undefined>;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(testId: string) =>
    host().querySelector<T>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const save = () => find<HTMLButtonElement>('sheet-save')!;
  const settle = () => fixture.whenStable();
  const chip = (testId: string) => find(testId)!;
  const selected = (testId: string) => chip(testId).classList.contains('mat-mdc-chip-selected');
  const tap = async (testId: string) => {
    chip(testId).querySelector<HTMLElement>('.mdc-evolution-chip__action--primary')!.click();
    await settle();
  };
  const typeFood = async (value: string) => {
    const input = find<HTMLTextAreaElement>('food')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await settle();
  };
  const foodError = () => find('food-error')?.textContent?.trim();

  const render = async (entry: Feed | null = null) => {
    const data: EntrySheetData<Feed> = { section: 'feed', kind: FEED_SECTION.kinds[1], entry };
    TestBed.overrideProvider(SHEET_DATA, { useValue: data });
    fixture = TestBed.createComponent(SolidsSheetComponent);
    await settle();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    saved = new Subject();
    deleted = new Subject();
    feeds = {
      create: vi.fn(() => saved),
      update: vi.fn(() => saved),
      delete: vi.fn(() => deleted),
    };
    sheetRef = { close: vi.fn() };
    confirmed = new Subject();
    await TestBed.configureTestingModule({
      imports: [SolidsSheetComponent, translocoTesting()],
      providers: [
        provideNativeDateAdapter(),
        { provide: FeedService, useValue: feeds },
        { provide: SelectedBabyService, useValue: { selected: signal({ id: 'b1' }) } },
        { provide: SheetRef, useValue: sheetRef },
        { provide: SHEET_DATA, useValue: null },
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => confirmed })) } },
      ],
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  describe('adding', () => {
    beforeEach(() => render());

    it('is titled Solids with meal type chips first, then start time, food, reaction and notes', () => {
      expect(text('sheet-title')).toBe('Solids');
      const rows = host().textContent!;
      expect(rows).toContain(en.feed.solids.mealType);
      expect(rows).toContain(en.entrySheet.startTime);
      expect(rows).toContain(en.feed.solids.food);
      expect(rows).toContain(en.feed.solids.reaction);
      expect(rows).toContain(en.entrySheet.notes);

      const order = [
        chip('meal-breakfast'),
        host().querySelector('nala-time-row')!,
        find('food')!,
        chip('reaction-liked'),
        host().querySelector('nala-notes-row')!,
      ];
      for (let i = 1; i < order.length; i++) {
        expect(
          order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
    });

    it('offers the four meal types and the four reactions as filter chips', () => {
      expect(host().querySelectorAll('mat-chip-listbox')).toHaveLength(2);
      for (const meal of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
        expect(text(`meal-${meal}`)).toBe(en.feed.mealType[meal]);
      }
      for (const reaction of ['liked', 'neutral', 'disliked', 'allergicReaction'] as const) {
        expect(text(`reaction-${reaction}`)).toBe(en.feed.reaction[reaction]);
      }
    });

    it('starts now, with no meal type and no reaction', () => {
      expect(host().querySelector('nala-time-row')?.textContent).toContain(
        `Today ${shortTime(NOW)}`,
      );
      const value = fixture.componentInstance.form.getRawValue();
      expect(value.startTime).toEqual(NOW);
      expect(value.mealType).toBeNull();
      expect(value.reaction).toBeNull();
    });

    it('disables Save until the food is filled', async () => {
      expect(save().disabled).toBe(true);

      await typeFood('Carrot purée');
      expect(save().disabled).toBe(false);
    });

    it('refuses blank food', async () => {
      await typeFood('   ');

      expect(save().disabled).toBe(true);
      expect(foodError()).toBe(en.feed.solids.errors.foodRequired);
    });

    it('refuses food over 500 characters', async () => {
      await typeFood('a'.repeat(501));

      expect(save().disabled).toBe(true);
      expect(foodError()).toBe(en.feed.solids.errors.foodTooLong);
    });

    it('lets food span several lines', () => {
      expect(find('food')!.tagName).toBe('TEXTAREA');
    });

    it('refuses a start time in the future', async () => {
      await typeFood('Carrot purée');
      fixture.componentInstance.form.controls.startTime.setValue(
        new Date(NOW.getTime() + 5 * 60_000),
      );
      await settle();

      expect(save().disabled).toBe(true);
    });

    it('adds the solids for the selected baby and closes with them', async () => {
      await tap('meal-lunch');
      await typeFood('  Carrot purée\nand pear ');
      await tap('reaction-allergicReaction');
      save().click();
      await settle();

      expect(feeds.create).toHaveBeenCalledWith(
        'b1',
        'solids',
        {
          startTime: NOW.toISOString(),
          mealType: 'lunch',
          food: 'Carrot purée\nand pear',
          reaction: 'allergicReaction',
          notes: null,
        },
        expect.stringMatching(/^[0-9a-f-]{36}$/),
      );
      expect(save().disabled).toBe(true);

      const feed = aSolids();
      saved.next({ ok: true, feed });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ saved: feed });
    });

    it('sends no meal type and no reaction when none is chosen', async () => {
      await typeFood('Banana');
      save().click();
      await settle();

      expect(feeds.create.mock.calls[0][2]).toMatchObject({ mealType: null, reaction: null });
    });

    it('keeps the same client id when Save is tried again', async () => {
      await typeFood('Banana');
      save().click();
      saved.next({ ok: false, errors: { form: 'unknown' } });
      await settle();
      save().click();
      await settle();

      const ids = feeds.create.mock.calls.map((call) => call[3]);
      expect(ids).toHaveLength(2);
      expect(ids[0]).toBe(ids[1]);
    });

    it('shows the errors the server sends back', async () => {
      await typeFood('Banana');
      save().click();
      saved.next({ ok: false, errors: { food: 'tooLong' } });
      await settle();

      expect(foodError()).toBe(en.feed.solids.errors.foodTooLong);
      expect(sheetRef.close).not.toHaveBeenCalled();
    });

    it('shows a form error when saving fails', async () => {
      await typeFood('Banana');
      save().click();
      saved.next({ ok: false, errors: { form: 'unknown' } });
      await settle();

      expect(text('form-error')).toBe(en.feed.errors.unknown);
    });

    it('shows neither Delete nor who logged it', () => {
      expect(find('entry-delete')).toBeNull();
      expect(host().querySelector('nala-entry-audit')).toBeNull();
    });
  });

  describe('editing', () => {
    const feed = aSolids({
      id: 'f7',
      mealType: 'dinner',
      food: 'Pumpkin',
      reaction: 'disliked',
      notes: 'spat it out',
      startTime: new Date(2026, 8, 30, 9, 15).toISOString(),
    });

    it('is pre-filled with the feed', async () => {
      await render(feed);

      expect(selected('meal-dinner')).toBe(true);
      expect(find<HTMLTextAreaElement>('food')!.value).toBe('Pumpkin');
      expect(selected('reaction-disliked')).toBe(true);
      expect(find<HTMLTextAreaElement>('notes-input')!.value).toBe('spat it out');
      expect(fixture.componentInstance.form.controls.startTime.value).toEqual(
        new Date(2026, 8, 30, 9, 15),
      );
      expect(save().disabled).toBe(false);
    });

    it('saves the changes, including cleared choices, and closes with the feed', async () => {
      await render(feed);
      await tap('meal-dinner');
      await typeFood('Pumpkin and rice');
      save().click();
      await settle();

      expect(feeds.update).toHaveBeenCalledWith('f7', {
        startTime: new Date(2026, 8, 30, 9, 15).toISOString(),
        mealType: null,
        food: 'Pumpkin and rice',
        reaction: 'disliked',
        notes: 'spat it out',
      });
      const updated = aSolids({ ...feed, food: 'Pumpkin and rice', mealType: null });
      saved.next({ ok: true, feed: updated });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ saved: updated });
    });

    it('says who logged it and who edited it last', async () => {
      const updatedAt = new Date(2026, 8, 30, 11, 40).toISOString();
      await render(aSolids({ ...feed, updatedBy: { id: 'u2', displayName: 'Ben' }, updatedAt }));

      expect(
        host().querySelector('nala-entry-audit')?.textContent?.replace(/\s+/g, ' ').trim(),
      ).toBe(`Logged by Anna · Edited by Ben, ${shortTime(new Date(updatedAt))}`);
    });

    it('deletes it after confirmation and closes with its id', async () => {
      await render(feed);

      find<HTMLButtonElement>('entry-delete')!.click();
      confirmed.next(true);
      await settle();
      expect(feeds.delete).toHaveBeenCalledWith('f7');

      deleted.next({ ok: true });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ deleted: 'f7' });
    });

    it('keeps the sheet open when deleting fails', async () => {
      await render(feed);

      find<HTMLButtonElement>('entry-delete')!.click();
      confirmed.next(true);
      deleted.next({ ok: false, errors: { form: 'unknown' } });
      await settle();

      expect(sheetRef.close).not.toHaveBeenCalled();
      expect(text('form-error')).toBe(en.feed.errors.unknown);
    });
  });
});
