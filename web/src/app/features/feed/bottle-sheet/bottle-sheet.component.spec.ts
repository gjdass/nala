import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import {
  BottleDefaults,
  Feed,
  FeedDeleteResult,
  FeedResult,
} from '../../../core/feeds/feed.models';
import { FeedService } from '../../../core/feeds/feed.service';
import { EntrySheetData } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';
import { aBottle } from '../../../testing/feeds';
import { translocoTesting } from '../../../testing/transloco-testing';
import { FEED_SECTION } from '../feed.section';
import { BottleSheetComponent } from './bottle-sheet.component';

const NOW = new Date(2026, 8, 30, 12, 0, 0);
const shortTime = (d: Date) => new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(d);
const defaults = (
  milkType: BottleDefaults['milkType'],
  breastMilk: number | null,
  formula: number | null,
): BottleDefaults => ({ milkType, lastAmountMl: { breastMilk, formula } });

describe('BottleSheetComponent', () => {
  let fixture: ComponentFixture<BottleSheetComponent>;
  let bottleDefaults: Subject<BottleDefaults>;
  let saved: Subject<FeedResult>;
  let deleted: Subject<FeedDeleteResult>;
  let feeds: Record<
    'bottleDefaults' | 'createBottle' | 'updateBottle' | 'delete',
    ReturnType<typeof vi.fn>
  >;
  let sheetRef: { close: ReturnType<typeof vi.fn> };
  let confirmed: Subject<boolean | undefined>;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(testId: string) =>
    host().querySelector<T>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const save = () => find<HTMLButtonElement>('sheet-save')!;
  const settle = () => fixture.whenStable();
  const toggle = (milkType: string) =>
    find(`milk-${milkType}`)!.querySelector<HTMLButtonElement>('button')!;
  const pressed = (milkType: string) =>
    find(`milk-${milkType}`)!.classList.contains('mat-button-toggle-checked');
  const typeAmount = async (value: string) => {
    const input = find<HTMLInputElement>('amount')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await settle();
  };
  const alert = () => host().querySelector('[data-testid="amount-error"]')?.textContent?.trim();

  const render = async (entry: Feed | null = null) => {
    const data: EntrySheetData<Feed> = {
      section: 'feed',
      kind: FEED_SECTION.kinds[0],
      entry,
    };
    TestBed.overrideProvider(SHEET_DATA, { useValue: data });
    fixture = TestBed.createComponent(BottleSheetComponent);
    await settle();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    bottleDefaults = new Subject();
    saved = new Subject();
    deleted = new Subject();
    feeds = {
      bottleDefaults: vi.fn(() => bottleDefaults),
      createBottle: vi.fn(() => saved),
      updateBottle: vi.fn(() => saved),
      delete: vi.fn(() => deleted),
    };
    sheetRef = { close: vi.fn() };
    confirmed = new Subject();
    await TestBed.configureTestingModule({
      imports: [BottleSheetComponent, translocoTesting()],
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

    it('is titled Bottle Feed with the start time, milk type, amount and notes rows', () => {
      expect(text('sheet-title')).toBe('Bottle Feed');
      const rows = host().textContent!;
      expect(rows).toContain(en.entrySheet.startTime);
      expect(rows).toContain(en.feed.bottle.milkType);
      expect(rows).toContain(en.feed.bottle.amount);
      expect(rows).toContain(en.entrySheet.notes);
      expect(text('milk-breastMilk')).toBe(en.feed.milkType.breastMilk);
      expect(text('milk-formula')).toBe(en.feed.milkType.formula);
      expect(host().querySelector('mat-button-toggle-group')).toBeTruthy();
    });

    it('starts now', () => {
      expect(host().querySelector('nala-time-row')?.textContent).toContain(
        `Today ${shortTime(NOW)}`,
      );
      expect(fixture.componentInstance.form.controls.startTime.value).toEqual(NOW);
    });

    it('asks the selected baby bottle defaults', () => {
      expect(feeds.bottleDefaults).toHaveBeenCalledWith('b1');
    });

    it('defaults the milk type to the one of the previous bottle', async () => {
      bottleDefaults.next(defaults('formula', 90, 120));
      await settle();

      expect(pressed('formula')).toBe(true);
      expect(pressed('breastMilk')).toBe(false);
    });

    it('has no milk type without a previous bottle, and Save stays disabled', async () => {
      bottleDefaults.next(defaults(null, null, null));
      await typeAmount('120');

      expect(pressed('formula')).toBe(false);
      expect(pressed('breastMilk')).toBe(false);
      expect(save().disabled).toBe(true);
    });

    it('disables Save until the milk type and amount are set', async () => {
      bottleDefaults.next(defaults(null, null, null));
      await settle();
      expect(save().disabled).toBe(true);

      toggle('breastMilk').click();
      await settle();
      expect(save().disabled).toBe(true);

      await typeAmount('90');
      expect(save().disabled).toBe(false);
    });

    for (const amount of ['0', '501', '12.5']) {
      it(`refuses an amount of ${amount} ml`, async () => {
        bottleDefaults.next(defaults('formula', null, null));
        await typeAmount(amount);

        expect(alert()).toBe(en.feed.bottle.errors.amountRange);
        expect(save().disabled).toBe(true);
      });
    }

    it('asks for the amount once the field was left empty', async () => {
      await typeAmount('');

      expect(alert()).toBe(en.feed.bottle.errors.amountRequired);
    });

    it('offers the last amount of the selected milk type while the amount is empty', async () => {
      bottleDefaults.next(defaults('formula', 90, 120));
      await settle();
      expect(text('suggestion-text')).toBe('Use last formula amount: 120 ml?');

      toggle('breastMilk').click();
      await settle();
      expect(text('suggestion-text')).toBe('Use last breast milk amount: 90 ml?');

      await typeAmount('100');
      expect(find('suggestion-text')).toBeNull();
    });

    it('offers nothing without a previous bottle of that milk type', async () => {
      bottleDefaults.next(defaults('formula', null, 120));
      await settle();

      toggle('breastMilk').click();
      await settle();

      expect(find('suggestion-text')).toBeNull();
    });

    it('fills the amount when the suggestion is accepted', async () => {
      bottleDefaults.next(defaults('formula', 90, 120));
      await settle();

      find<HTMLButtonElement>('suggestion-accept')!.click();
      await settle();

      expect(find<HTMLInputElement>('amount')!.value).toBe('120');
      expect(save().disabled).toBe(false);
    });

    it('refuses a start time in the future', async () => {
      bottleDefaults.next(defaults('formula', 90, 120));
      await typeAmount('120');
      fixture.componentInstance.form.controls.startTime.setValue(
        new Date(NOW.getTime() + 5 * 60_000),
      );
      await settle();

      expect(save().disabled).toBe(true);
    });

    it('adds the bottle for the selected baby and closes with it', async () => {
      bottleDefaults.next(defaults('formula', null, null));
      await typeAmount('120');
      save().click();
      await settle();

      expect(feeds.createBottle).toHaveBeenCalledWith(
        'b1',
        { startTime: NOW.toISOString(), milkType: 'formula', amountMl: 120, notes: null },
        expect.stringMatching(/^[0-9a-f-]{36}$/),
      );
      expect(save().disabled).toBe(true);

      const feed = aBottle();
      saved.next({ ok: true, feed });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ saved: feed });
    });

    it('keeps the same client id when Save is tried again', async () => {
      bottleDefaults.next(defaults('formula', null, null));
      await typeAmount('120');
      save().click();
      saved.next({ ok: false, errors: { form: 'unknown' } });
      await settle();
      save().click();
      await settle();

      const ids = feeds.createBottle.mock.calls.map((call) => call[2]);
      expect(ids).toHaveLength(2);
      expect(ids[0]).toBe(ids[1]);
    });

    it('shows the errors the server sends back', async () => {
      bottleDefaults.next(defaults('formula', null, null));
      await typeAmount('120');
      save().click();
      saved.next({ ok: false, errors: { amountMl: 'outOfRange' } });
      await settle();

      expect(alert()).toBe(en.feed.bottle.errors.amountRange);
      expect(sheetRef.close).not.toHaveBeenCalled();
    });

    it('shows a form error when saving fails', async () => {
      bottleDefaults.next(defaults('formula', null, null));
      await typeAmount('120');
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
    const feed = aBottle({
      id: 'f7',
      milkType: 'breastMilk',
      amountMl: 90,
      notes: 'sleepy',
      startTime: new Date(2026, 8, 30, 9, 15).toISOString(),
    });

    it('is pre-filled with the feed', async () => {
      await render(feed);
      bottleDefaults.next(defaults('formula', 90, 120));
      await settle();

      expect(pressed('breastMilk')).toBe(true);
      expect(find<HTMLInputElement>('amount')!.value).toBe('90');
      expect(find<HTMLTextAreaElement>('notes-input')!.value).toBe('sleepy');
      expect(fixture.componentInstance.form.controls.startTime.value).toEqual(
        new Date(2026, 8, 30, 9, 15),
      );
      expect(save().disabled).toBe(false);
    });

    it('saves the changes and closes with the feed', async () => {
      await render(feed);
      await typeAmount('110');
      save().click();
      await settle();

      expect(feeds.updateBottle).toHaveBeenCalledWith('f7', {
        startTime: new Date(2026, 8, 30, 9, 15).toISOString(),
        milkType: 'breastMilk',
        amountMl: 110,
        notes: 'sleepy',
      });
      const updated = aBottle({ ...feed, amountMl: 110 });
      saved.next({ ok: true, feed: updated });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ saved: updated });
    });

    it('says who logged it', async () => {
      await render(feed);

      expect(
        host().querySelector('nala-entry-audit')?.textContent?.replace(/\s+/g, ' ').trim(),
      ).toBe('Logged by Anna');
    });

    it('adds who edited it last, and when', async () => {
      const updatedAt = new Date(2026, 8, 30, 11, 40).toISOString();
      await render(aBottle({ ...feed, updatedBy: { id: 'u2', displayName: 'Ben' }, updatedAt }));

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
