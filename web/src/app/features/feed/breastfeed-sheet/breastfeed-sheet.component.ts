import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { runningSide, sideSeconds } from '../../../core/feeds/breastfeed';
import { BreastSide, BreastfeedFields, Feed, FeedResult } from '../../../core/feeds/feed.models';
import { FeedService } from '../../../core/feeds/feed.service';
import { applyServerErrors } from '../../../core/http/apply-server-errors';
import { DurationPipe } from '../../../core/time/duration';
import { NowService } from '../../../core/time/now.service';
import { notInFuture } from '../../../core/time/not-in-future';
import { EntryAuditComponent } from '../../../shared/ui/entry-audit/entry-audit.component';
import { EntrySheetComponent } from '../../../shared/ui/entry-sheet/entry-sheet.component';
import {
  EntrySheetData,
  EntrySheetResult,
} from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { FormRowComponent } from '../../../shared/ui/form-row/form-row.component';
import { NotesRowComponent, notesControl } from '../../../shared/ui/notes-row/notes-row.component';
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';
import { SplitTimerComponent } from '../../../shared/ui/split-timer/split-timer.component';
import { TimeRowComponent } from '../../../shared/ui/time-row/time-row.component';

/** Translation keys of the form-level errors; anything else is "unknown". */
const FORM_ERRORS: Record<string, string> = {
  feedNotFound: 'feed.errors.feedNotFound',
  babyNotFound: 'feed.errors.babyNotFound',
  durations: 'feed.breastfeed.errors.durationsZero',
};

/**
 * The Breastfeed sheet (spec 05): two per-side timers side by side (the hard requirement), the start
 * time, the total time and notes. The timers live on the server: each tap is sent at once (the first
 * Start creates the feed in progress, with its start time; Start on a saved feed reopens it), and the
 * durations come from the stored segments, live. Opened to add while a breastfeed is in progress for
 * the baby, it opens that one. × leaves the feed running; Save finishes it (or saves the edits of a
 * saved one), refused while both sides are at 0 s. Closes with the saved feed or the deleted id.
 */
@Component({
  selector: 'nala-breastfeed-sheet',
  imports: [
    DurationPipe,
    EntryAuditComponent,
    EntrySheetComponent,
    FormRowComponent,
    NotesRowComponent,
    SplitTimerComponent,
    TimeRowComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './breastfeed-sheet.component.html',
  styleUrl: './breastfeed-sheet.component.scss',
})
export class BreastfeedSheetComponent {
  private readonly feeds = inject(FeedService);
  private readonly sheetRef = inject<SheetRef<EntrySheetResult<Feed>>>(SheetRef);
  private readonly now = inject(NowService).now;
  private readonly entry = inject<EntrySheetData<Feed>>(SHEET_DATA).entry;
  private readonly babyId = this.entry?.babyId ?? inject(SelectedBabyService).selected()?.id;
  /** The id a new feed gets, kept across attempts so a retried Start can't create two. */
  private readonly newId = crypto.randomUUID();

  /** Null until a side starts (or while loading the one in progress). */
  protected readonly feed = signal<Feed | null>(this.entry);
  /** The side the latest saved breastfeed ended on. */
  private readonly lastSide = signal<BreastSide | null>(null);

  readonly form = new FormGroup({
    startTime: new FormControl<Date | null>(
      this.entry ? new Date(this.entry.startTime) : new Date(),
      [Validators.required, notInFuture()],
    ),
    notes: notesControl(this.entry?.notes ?? ''),
  });

  protected readonly left = computed(() => this.seconds('left'));
  protected readonly right = computed(() => this.seconds('right'));
  protected readonly total = computed(() => this.left() + this.right());
  protected readonly running = computed(() => {
    const feed = this.feed();
    return feed ? runningSide(feed) : null;
  });
  /** "last side" helps choose where to start: not shown on a saved feed. */
  protected readonly markedSide = computed(() => (this.feed()?.endTime ? null : this.lastSide()));
  protected readonly edited = computed(() => {
    const feed = this.feed();
    return !!feed && feed.updatedAt !== feed.createdAt;
  });
  /** Sending a tap, saving or deleting. */
  protected readonly busy = signal(false);
  /** Translation key of the form-level error. */
  protected readonly formError = signal<string | null>(null);

  constructor() {
    if (this.babyId) {
      this.loadState(this.babyId);
    }
  }

  protected start(side: BreastSide): void {
    const id = this.feed()?.id ?? this.newId;
    this.send(this.feeds.startSide(id, this.babyId!, side, new Date().toISOString()));
  }

  protected stop(): void {
    this.send(this.feeds.stopSide(this.feed()!.id, new Date().toISOString()));
  }

  protected save(): void {
    const feed = this.feed();
    if (!feed || this.form.invalid || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    const fields = this.fields();
    const request =
      feed.endTime === null
        ? this.feeds.finish(feed.id, fields, new Date().toISOString())
        : this.feeds.update(feed.id, fields);
    request.subscribe((result) => {
      this.busy.set(false);
      if (result.ok) {
        this.sheetRef.close({ saved: result.feed });
        return;
      }
      const { durations, ...errors } = result.errors;
      if (durations) {
        this.formError.set(FORM_ERRORS['durations']);
        applyServerErrors(this.form, errors);
        return;
      }
      this.showFormError(applyServerErrors(this.form, errors));
    });
  }

  protected delete(): void {
    const feed = this.feed()!;
    this.busy.set(true);
    this.formError.set(null);
    this.feeds.delete(feed.id).subscribe((result) => {
      this.busy.set(false);
      if (result.ok) {
        this.sheetRef.close({ deleted: feed.id });
      } else {
        this.showFormError(result.errors['form'] ?? 'unknown');
      }
    });
  }

  /** Sends a timer tap and shows the feed the server answers with. */
  private send(request: Observable<FeedResult>): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    request.subscribe((result) => {
      this.busy.set(false);
      if (result.ok) {
        this.show(result.feed);
      } else if (result.errors['form'] === 'breastfeedInProgress') {
        // Started from another device meanwhile: open that one.
        this.loadState(this.babyId!);
      } else {
        this.showFormError(result.errors['form'] ?? 'unknown');
      }
    });
  }

  private loadState(babyId: string): void {
    this.feeds.breastfeedState(babyId).subscribe((state) => {
      this.lastSide.set(state.lastSide);
      if (!this.entry && state.inProgress) {
        this.adopt(state.inProgress);
      }
    });
  }

  /** Opens `feed` in the sheet, with its start time and notes. */
  private adopt(feed: Feed): void {
    this.feed.set(feed);
    this.form.reset({ startTime: new Date(feed.startTime), notes: feed.notes ?? '' });
  }

  /** The feed after a tap; a start time not edited yet follows the server's. */
  private show(feed: Feed): void {
    this.feed.set(feed);
    const startTime = this.form.controls.startTime;
    if (startTime.pristine) {
      startTime.setValue(new Date(feed.startTime));
    }
  }

  private seconds(side: BreastSide): number {
    const feed = this.feed();
    return feed ? Math.floor(sideSeconds(feed, side, this.now())) : 0;
  }

  private showFormError(code: string | null): void {
    this.formError.set(code === null ? null : (FORM_ERRORS[code] ?? 'feed.errors.unknown'));
  }

  /** Call only on a valid form. */
  private fields(): BreastfeedFields {
    const value = this.form.getRawValue();
    return { startTime: value.startTime!.toISOString(), notes: value.notes.trim() || null };
  }
}
