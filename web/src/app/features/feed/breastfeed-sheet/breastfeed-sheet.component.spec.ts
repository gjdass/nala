import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject, take } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import {
  BreastfeedState,
  Feed,
  FeedDeleteResult,
  FeedResult,
} from '../../../core/feeds/feed.models';
import { FeedService } from '../../../core/feeds/feed.service';
import { NowService } from '../../../core/time/now.service';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { DurationDialogComponent } from '../../../shared/ui/duration-dialog/duration-dialog.component';
import { EntrySheetData } from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';
import { aBreastfeed, aSegment } from '../../../testing/feeds';
import { translocoTesting } from '../../../testing/transloco-testing';
import { FEED_SECTION } from '../feed.section';
import { BreastfeedSheetComponent } from './breastfeed-sheet.component';

const NOW = new Date('2026-09-30T10:10:00Z');
const iso = (time: string) => `2026-09-30T${time}Z`;

/** In progress since 10:00: 5 min left, then right running since 10:05. */
const running = (overrides: Partial<Feed> = {}) =>
  aBreastfeed({
    endTime: null,
    segments: [
      aSegment('left', iso('10:00:00'), iso('10:05:00')),
      aSegment('right', iso('10:05:00'), null),
    ],
    ...overrides,
  });

describe('BreastfeedSheetComponent', () => {
  let fixture: ComponentFixture<BreastfeedSheetComponent>;
  let now: ReturnType<typeof signal<number>>;
  let states: Subject<BreastfeedState>[];
  let timer: Subject<FeedResult>;
  let saved: Subject<FeedResult>;
  let deleted: Subject<FeedDeleteResult>;
  let feeds: Record<
    'breastfeedState' | 'startSide' | 'stopSide' | 'finish' | 'create' | 'update' | 'delete',
    ReturnType<typeof vi.fn>
  >;
  let sheetRef: { close: ReturnType<typeof vi.fn> };
  let confirmed: Subject<boolean | undefined>;
  let typed: Subject<number | undefined>;
  let dialog: { open: ReturnType<typeof vi.fn> };

  const host = () => fixture.nativeElement as HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(testId: string) =>
    host().querySelector<T>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const save = () => find<HTMLButtonElement>('sheet-save')!;
  const settle = () => fixture.whenStable();
  const click = async (testId: string) => {
    find(testId)!.click();
    await settle();
  };
  const respondState = async (state: BreastfeedState) => {
    states.at(-1)!.next(state);
    await settle();
  };
  const respondTimer = async (result: FeedResult) => {
    timer.next(result);
    await settle();
  };
  /** Taps the pencil of `side` and answers the duration dialog with `seconds` (undefined: Cancel). */
  const typeDuration = async (side: 'left' | 'right', seconds: number | undefined) => {
    await click(`split-${side}-edit`);
    typed.next(seconds);
    await settle();
  };
  const toggle = (side: 'left' | 'right') => find<HTMLButtonElement>(`split-${side}-toggle`)!;
  const tick = async (ms: number) => {
    now.set(now() + ms);
    await settle();
  };

  const render = async (entry: Feed | null = null) => {
    const data: EntrySheetData<Feed> = {
      section: 'feed',
      kind: FEED_SECTION.kinds.find((k) => k.key === 'breastfeed')!,
      entry,
    };
    TestBed.overrideProvider(SHEET_DATA, { useValue: data });
    fixture = TestBed.createComponent(BreastfeedSheetComponent);
    await settle();
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    now = signal(NOW.getTime());
    states = [];
    timer = new Subject();
    saved = new Subject();
    deleted = new Subject();
    feeds = {
      breastfeedState: vi.fn(() => {
        const state = new Subject<BreastfeedState>();
        states.push(state);
        return state;
      }),
      startSide: vi.fn(() => timer),
      stopSide: vi.fn(() => timer),
      finish: vi.fn(() => saved),
      create: vi.fn(() => saved),
      update: vi.fn(() => saved),
      delete: vi.fn(() => deleted),
    };
    sheetRef = { close: vi.fn() };
    confirmed = new Subject();
    typed = new Subject();
    dialog = {
      open: vi.fn((component: unknown) => ({
        // Like a real dialog, each one closes once.
        afterClosed: () =>
          component === DurationDialogComponent ? typed.pipe(take(1)) : confirmed.pipe(take(1)),
      })),
    };
    await TestBed.configureTestingModule({
      imports: [BreastfeedSheetComponent, translocoTesting()],
      providers: [
        provideNativeDateAdapter(),
        { provide: FeedService, useValue: feeds },
        { provide: NowService, useValue: { now } },
        { provide: SelectedBabyService, useValue: { selected: signal({ id: 'b1' }) } },
        { provide: SheetRef, useValue: sheetRef },
        { provide: SHEET_DATA, useValue: null },
        { provide: MatDialog, useValue: dialog },
      ],
    }).compileComponents();
  });

  afterEach(() => vi.useRealTimers());

  describe('starting a new feed', () => {
    beforeEach(async () => {
      await render();
      await respondState({ inProgress: null, lastSide: 'left' });
    });

    it('is titled Breastfeed with the split timer, start time, total time and notes', () => {
      expect(text('sheet-title')).toBe(en.feed.kinds.breastfeed);
      expect(host().querySelector('nala-split-timer')).not.toBeNull();
      const rows = host().textContent!;
      expect(rows).toContain(en.entrySheet.startTime);
      expect(rows).toContain(en.feed.breastfeed.totalTime);
      expect(rows).toContain(en.entrySheet.notes);
    });

    it('loads the selected baby breastfeed state', () => {
      expect(feeds.breastfeedState).toHaveBeenCalledWith('b1');
    });

    it('shows both sides at 0 s with Save disabled and no Delete', () => {
      expect(text('split-left-duration')).toBe('0s');
      expect(text('split-right-duration')).toBe('0s');
      expect(text('total-time')).toBe('0s');
      expect(save().disabled).toBe(true);
      expect(find('entry-delete')).toBeNull();
    });

    it('marks the side the previous breastfeed ended on', () => {
      expect(text('split-left-mark')).toBe(en.feed.breastfeed.lastSide);
      expect(find('split-right-mark')).toBeNull();
    });

    it('creates the in-progress feed for the selected baby when a side starts, now', async () => {
      await click('split-left-toggle');

      expect(feeds.startSide).toHaveBeenCalledWith(
        expect.any(String),
        'b1',
        'left',
        NOW.toISOString(),
      );
      const feedId = feeds.startSide.mock.calls[0][0];

      await respondTimer({
        ok: true,
        feed: running({
          id: feedId,
          startTime: NOW.toISOString(),
          segments: [aSegment('left', NOW.toISOString(), null)],
        }),
      });

      expect(fixture.componentInstance.form.controls.startTime.value).toEqual(NOW);
      expect(text('split-left-toggle')).toBe(en.splitTimer.stop);
      expect(find('entry-delete')).not.toBeNull();
    });

    it('keeps the same feed id when starting again after a failure', async () => {
      await click('split-left-toggle');
      await respondTimer({ ok: false, errors: { form: 'unknown' } });
      expect(text('form-error')).toBe(en.feed.errors.unknown);

      await click('split-left-toggle');

      expect(feeds.startSide.mock.calls[1][0]).toBe(feeds.startSide.mock.calls[0][0]);
    });

    it('opens the feed already in progress when starting one is refused', async () => {
      await click('split-right-toggle');
      await respondTimer({ ok: false, errors: { form: 'breastfeedInProgress' } });

      expect(feeds.breastfeedState).toHaveBeenCalledTimes(2);
      await respondState({ inProgress: running(), lastSide: 'left' });

      expect(text('split-left-duration')).toBe('5m');
      expect(text('split-right-toggle')).toBe(en.splitTimer.stop);
      expect(find('form-error')).toBeNull();
    });
  });

  describe('a feed in progress', () => {
    beforeEach(async () => {
      await render();
      await respondState({ inProgress: running({ notes: 'calm' }), lastSide: 'right' });
    });

    it('opens the feed in progress instead of a new one', () => {
      const value = fixture.componentInstance.form.getRawValue();
      expect(value.startTime).toEqual(new Date(iso('10:00:00')));
      expect(value.notes).toBe('calm');
      expect(find('entry-delete')).not.toBeNull();
    });

    it('shows each side from the stored timestamps, live, and the total', async () => {
      expect(text('split-left-duration')).toBe('5m');
      expect(text('split-right-duration')).toBe('5m');
      expect(text('total-time')).toBe('10m');

      await tick(30_000);

      expect(text('split-left-duration')).toBe('5m');
      expect(text('split-right-duration')).toBe('5m 30s');
      expect(text('total-time')).toBe('10m 30s');
    });

    it('marks the running side with Stop', () => {
      expect(text('split-right-toggle')).toBe(en.splitTimer.stop);
      expect(text('split-left-toggle')).toBe(en.splitTimer.startLeft);
    });

    it('switches to the other side on its Start', async () => {
      await click('split-left-toggle');

      expect(feeds.startSide).toHaveBeenCalledWith('f3', 'b1', 'left', NOW.toISOString());
    });

    it('pauses the running side on Stop, keeping the feed in progress', async () => {
      await click('split-right-toggle');

      expect(feeds.stopSide).toHaveBeenCalledWith('f3', NOW.toISOString());
      await respondTimer({
        ok: true,
        feed: running({
          segments: [
            aSegment('left', iso('10:00:00'), iso('10:05:00')),
            aSegment('right', iso('10:05:00'), iso('10:10:00')),
          ],
        }),
      });

      expect(text('split-right-toggle')).toBe(en.splitTimer.startRight);
      expect(sheetRef.close).not.toHaveBeenCalled();
      await tick(60_000);
      expect(text('total-time')).toBe('10m');
    });

    it('closes on × without saving, leaving the feed running', async () => {
      await click('sheet-close');

      expect(sheetRef.close).toHaveBeenCalledWith();
      expect(feeds.finish).not.toHaveBeenCalled();
      expect(feeds.stopSide).not.toHaveBeenCalled();
    });

    it('finishes the feed on Save with the start time and notes, and closes with it', async () => {
      await click('sheet-save');

      expect(feeds.finish).toHaveBeenCalledWith(
        'f3',
        { startTime: iso('10:00:00.000'), notes: 'calm' },
        NOW.toISOString(),
      );
      const done = running({ endTime: NOW.toISOString() });
      saved.next({ ok: true, feed: done });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ saved: done });
    });

    it('shows the errors the server sends back on Save', async () => {
      await click('sheet-save');
      saved.next({ ok: false, errors: { durations: 'zero' } });
      await settle();

      expect(text('form-error')).toBe(en.feed.breastfeed.errors.durationsZero);
      expect(sheetRef.close).not.toHaveBeenCalled();
    });

    it('deletes it once confirmed', async () => {
      await click('entry-delete');
      confirmed.next(true);
      await settle();

      expect(feeds.delete).toHaveBeenCalledWith('f3');
      deleted.next({ ok: true });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ deleted: 'f3' });
    });
  });

  it('keeps Save disabled while both sides are at 0 s', async () => {
    await render();
    await respondState({
      inProgress: running({ segments: [aSegment('left', NOW.toISOString(), NOW.toISOString())] }),
      lastSide: null,
    });

    expect(save().disabled).toBe(true);
  });

  describe('a saved feed', () => {
    beforeEach(async () => {
      await render(aBreastfeed({ notes: 'calm' }));
      await respondState({ inProgress: null, lastSide: 'right' });
    });

    it('shows its sides and total', () => {
      expect(text('split-left-duration')).toBe('5m');
      expect(text('split-right-duration')).toBe('3m 30s');
      expect(text('total-time')).toBe('8m 30s');
      expect(find('split-left-mark')).toBeNull();
      expect(find('split-right-mark')).toBeNull();
    });

    it('saves edits through update', async () => {
      await click('sheet-save');

      expect(feeds.update).toHaveBeenCalledWith('f3', {
        startTime: iso('10:00:00.000'),
        notes: 'calm',
      });
      expect(feeds.finish).not.toHaveBeenCalled();
    });

    it('reopens it when a side starts', async () => {
      await click('split-left-toggle');

      expect(feeds.startSide).toHaveBeenCalledWith('f3', 'b1', 'left', NOW.toISOString());
    });

    it('says who logged it and offers Delete', () => {
      expect(host().querySelector('nala-entry-audit')?.textContent).toContain('Anna');
      expect(find('entry-delete')).not.toBeNull();
    });
  });

  describe('typing durations on a new feed', () => {
    beforeEach(async () => {
      await render();
      await respondState({ inProgress: null, lastSide: 'left' });
    });

    it('opens the duration dialog from a side pencil, with its current duration', async () => {
      await click('split-left-edit');

      expect(dialog.open).toHaveBeenCalledWith(DurationDialogComponent, {
        data: { title: en.feed.breastfeed.editDuration.left, seconds: 0 },
      });
    });

    it('shows the typed duration and total, disables the timers and enables Save', async () => {
      await typeDuration('left', 300);

      expect(text('split-left-duration')).toBe('5m');
      expect(text('split-right-duration')).toBe('0s');
      expect(text('total-time')).toBe('5m');
      expect(toggle('left').disabled).toBe(true);
      expect(toggle('right').disabled).toBe(true);
      expect(save().disabled).toBe(false);
      expect(feeds.startSide).not.toHaveBeenCalled();
    });

    it('changes nothing when the dialog is cancelled', async () => {
      await typeDuration('left', undefined);

      expect(text('split-left-duration')).toBe('0s');
      expect(toggle('left').disabled).toBe(false);
      expect(save().disabled).toBe(true);
    });

    it('asks for the ended-on side only when both sides have a duration', async () => {
      await typeDuration('left', 300);
      expect(find('ended-on')).toBeNull();

      await typeDuration('right', 180);

      expect(find('ended-on')?.textContent).toContain(en.feed.breastfeed.endedOn);
      expect(fixture.componentInstance.form.controls.endedOn.value).toBe('right');
    });

    it('logs a past feed by hand: start time, durations, ended-on side', async () => {
      const start = new Date(iso('08:00:00'));
      fixture.componentInstance.form.controls.startTime.setValue(start);
      await typeDuration('left', 300);
      await typeDuration('right', 180);
      host().querySelector<HTMLButtonElement>('[data-testid="ended-on-left"] button')!.click();
      await settle();

      await click('sheet-save');

      expect(feeds.create).toHaveBeenCalledWith(
        'b1',
        'breastfeed',
        {
          startTime: start.toISOString(),
          notes: null,
          durations: { leftSeconds: 300, rightSeconds: 180, endedOn: 'left' },
        },
        expect.any(String),
      );
      const done = aBreastfeed();
      saved.next({ ok: true, feed: done });
      await settle();
      expect(sheetRef.close).toHaveBeenCalledWith({ saved: done });
    });

    it('sends the only typed side as the ended-on side', async () => {
      await typeDuration('right', 240);

      await click('sheet-save');

      expect(feeds.create.mock.calls[0][2].durations).toEqual({
        leftSeconds: 0,
        rightSeconds: 240,
        endedOn: 'right',
      });
    });

    it('asks before discarding typed durations on ×', async () => {
      await typeDuration('left', 300);

      await click('sheet-close');

      expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, expect.anything());
      expect(sheetRef.close).not.toHaveBeenCalled();
    });

    it('shows a duration ending in the future as an error', async () => {
      await typeDuration('left', 300);
      await click('sheet-save');
      saved.next({ ok: false, errors: { durations: 'inFuture' } });
      await settle();

      expect(text('form-error')).toBe(en.feed.breastfeed.errors.durationsInFuture);
    });
  });

  describe('correcting a feed in progress', () => {
    beforeEach(async () => {
      await render();
      await respondState({ inProgress: running({ notes: 'calm' }), lastSide: 'right' });
    });

    it('opens the dialog with the side live duration', async () => {
      await click('split-right-edit');

      expect(dialog.open).toHaveBeenCalledWith(DurationDialogComponent, {
        data: { title: en.feed.breastfeed.editDuration.right, seconds: 300 },
      });
    });

    it('freezes the other side at its current duration', async () => {
      await typeDuration('left', 120);
      await tick(60_000);

      expect(text('split-left-duration')).toBe('2m');
      expect(text('split-right-duration')).toBe('5m');
      expect(text('total-time')).toBe('7m');
      expect(toggle('right').disabled).toBe(true);
    });

    it('saves the typed durations through update instead of finishing', async () => {
      await typeDuration('left', 120);
      await click('sheet-save');

      expect(feeds.update).toHaveBeenCalledWith('f3', {
        startTime: iso('10:00:00.000'),
        notes: 'calm',
        durations: { leftSeconds: 120, rightSeconds: 300, endedOn: 'left' },
      });
      expect(feeds.finish).not.toHaveBeenCalled();
    });
  });

  it('saves typed durations of a saved feed through update', async () => {
    await render(aBreastfeed());
    await respondState({ inProgress: null, lastSide: 'right' });

    await typeDuration('right', 60);
    await click('sheet-save');

    expect(feeds.update).toHaveBeenCalledWith('f3', {
      startTime: iso('10:00:00.000'),
      notes: null,
      durations: { leftSeconds: 300, rightSeconds: 60, endedOn: 'right' },
    });
  });

  describe('Still feeding?', () => {
    it('warns about a feed in progress that started more than 3 hours ago', async () => {
      await render();
      await respondState({ inProgress: running({ startTime: iso('07:09:00') }), lastSide: null });

      expect(text('banner-title')).toBe(en.feed.breastfeed.stillFeeding.title);
      expect(text('banner-text')).toContain('3h 1m ago');
      expect(find('banner-action')).toBeNull();
    });

    it('does not warn before 3 hours', async () => {
      await render();
      await respondState({ inProgress: running({ startTime: iso('07:10:00') }), lastSide: null });

      expect(find('banner-title')).toBeNull();
    });

    it('does not warn for a saved feed', async () => {
      await render(aBreastfeed({ startTime: iso('01:00:00') }));
      await respondState({ inProgress: null, lastSide: null });

      expect(find('banner-title')).toBeNull();
    });
  });
});
