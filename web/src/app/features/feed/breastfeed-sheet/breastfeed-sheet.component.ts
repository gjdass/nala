import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { isStillFeeding, runningSide, sideSeconds } from '../../../core/feeds/breastfeed';
import { BreastfeedSyncService } from '../../../core/feeds/breastfeed-sync.service';
import {
  BREAST_SIDES,
  BreastSide,
  BreastfeedFields,
  Feed,
  FeedResult,
} from '../../../core/feeds/feed.models';
import { FeedService } from '../../../core/feeds/feed.service';
import { applyServerErrors } from '../../../core/http/apply-server-errors';
import { DurationPipe } from '../../../core/time/duration';
import { NowService } from '../../../core/time/now.service';
import { notInFuture } from '../../../core/time/not-in-future';
import { TimeSincePipe } from '../../../core/time/time-since';
import { BannerComponent } from '../../../shared/ui/banner/banner.component';
import {
  DurationDialogComponent,
  DurationDialogData,
} from '../../../shared/ui/duration-dialog/duration-dialog.component';
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
};

/** Translation keys of the `durations` codes, and of any `endedOn` code. */
const DURATION_ERRORS: Record<string, string> = {
  zero: 'feed.breastfeed.errors.durationsZero',
  inFuture: 'feed.breastfeed.errors.durationsInFuture',
  outOfRange: 'feed.breastfeed.errors.durationsOutOfRange',
  endedOn: 'feed.breastfeed.errors.endedOnRequired',
};

type Durations = Record<BreastSide, number>;

/**
 * The Breastfeed sheet (spec 05): two per-side timers side by side (the hard requirement), the start
 * time, the total time and notes. The timers live on the server: each tap is sent at once (the first
 * Start creates the feed in progress, with its start time; Start on a saved feed reopens it), and the
 * durations come from the stored segments, live. Opened to add while a breastfeed is in progress for
 * the baby, it opens that one. × leaves the feed running; Save finishes it (or saves the edits of a
 * saved one), refused while both sides are at 0 s. Closes with the saved feed or the deleted id.
 *
 * Each side's pencil lets its duration be typed: both durations are then frozen (the timers are off
 * until Save or ×), the ended-on side is asked when both are above 0, and Save sends the durations
 * (adding a feed logged by hand, or replacing the timed ones). An in-progress feed started more than
 * 3 hours ago shows "Still feeding?".
 *
 * Other devices: its own actions update the shared in-progress state at once; changes made elsewhere
 * (side switch, pause) show live, unless durations are being typed; if the feed is saved or deleted
 * elsewhere, the sheet closes with a snackbar (unless durations are being typed).
 */
@Component({
  selector: 'nala-breastfeed-sheet',
  imports: [
    BannerComponent,
    DurationPipe,
    MatButtonToggleModule,
    ReactiveFormsModule,
    TimeSincePipe,
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
  private readonly dialog = inject(MatDialog);
  private readonly transloco = inject(TranslocoService);
  private readonly sync = inject(BreastfeedSyncService);
  private readonly snackBar = inject(MatSnackBar);
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
    /** Asked only when both typed durations are above 0. */
    endedOn: new FormControl<BreastSide | null>(null),
  });

  protected readonly sides = BREAST_SIDES;
  /** The durations typed with the pencils, in seconds; null while the timers give them. */
  protected readonly typed = signal<Durations | null>(null);
  protected readonly left = computed(() => this.typed()?.left ?? this.seconds('left'));
  protected readonly right = computed(() => this.typed()?.right ?? this.seconds('right'));
  protected readonly askEndedOn = computed(
    () => this.left() > 0 && this.right() > 0 && !!this.typed(),
  );
  protected readonly stillFeeding = computed(() => {
    const feed = this.feed();
    return !!feed && isStillFeeding(feed, this.now());
  });
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

  /** The feed was listed as in progress by the shared state. */
  private listed = false;
  /** This sheet saved or deleted the feed itself. */
  private settled = false;

  constructor() {
    if (this.babyId) {
      this.loadState(this.babyId);
    }
    effect(() => {
      const list = this.sync.inProgress();
      untracked(() => this.follow(list));
    });
  }

  protected start(side: BreastSide): void {
    const id = this.feed()?.id ?? this.newId;
    this.send(this.feeds.startSide(id, this.babyId!, side, new Date().toISOString()));
  }

  protected stop(): void {
    this.send(this.feeds.stopSide(this.feed()!.id, new Date().toISOString()));
  }

  /** Opens the duration dialog for `side`; a typed duration freezes both sides. */
  protected editDuration(side: BreastSide): void {
    this.dialog
      .open<DurationDialogComponent, DurationDialogData, number | undefined>(
        DurationDialogComponent,
        {
          data: {
            title: this.transloco.translate(`feed.breastfeed.editDuration.${side}`),
            seconds: side === 'left' ? this.left() : this.right(),
          },
        },
      )
      .afterClosed()
      .subscribe((seconds) => {
        if (seconds === undefined) {
          return;
        }
        const current = this.typed() ?? { left: this.left(), right: this.right() };
        this.typed.set({ ...current, [side]: seconds });
        this.form.controls.endedOn.setValue(side);
        this.form.markAsDirty();
      });
  }

  protected save(): void {
    const feed = this.feed();
    const typed = this.typed();
    if ((!feed && !typed) || this.form.invalid || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    const fields = this.fields();
    let request: Observable<FeedResult>;
    if (!feed) {
      request = this.feeds.create(this.babyId!, 'breastfeed', fields, this.newId);
    } else if (typed || feed.endTime !== null) {
      request = this.feeds.update(feed.id, fields);
    } else {
      request = this.feeds.finish(feed.id, fields, new Date().toISOString());
    }
    request.subscribe((result) => {
      this.busy.set(false);
      if (result.ok) {
        this.settled = true;
        this.sync.put(result.feed);
        this.sheetRef.close({ saved: result.feed });
        return;
      }
      const { durations, endedOn, ...errors } = result.errors;
      const durationError = durations ?? (endedOn ? 'endedOn' : null);
      if (durationError) {
        this.formError.set(DURATION_ERRORS[durationError] ?? 'feed.errors.unknown');
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
        this.settled = true;
        this.sync.remove(feed.id);
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
        this.sync.put(result.feed);
        this.show(result.feed);
      } else if (result.errors['form'] === 'breastfeedInProgress') {
        // Started from another device meanwhile: open that one.
        this.loadState(this.babyId!);
      } else {
        this.showFormError(result.errors['form'] ?? 'unknown');
      }
    });
  }

  /** Follows what other devices did to this sheet's feed. */
  private follow(list: readonly Feed[]): void {
    const feed = this.feed();
    if (!feed || this.busy() || this.typed() || this.settled) {
      return;
    }
    const shared = list.find((f) => f.id === feed.id);
    if (shared) {
      this.listed = true;
      if (shared.updatedAt !== feed.updatedAt) {
        this.show(shared);
      }
    } else if (this.listed && feed.endTime === null) {
      this.snackBar.open(this.transloco.translate('feed.breastfeed.endedElsewhere'), undefined, {
        duration: 5000,
      });
      this.sheetRef.close();
    }
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

  /** Call only on a valid form. With typed durations, they come along with the ended-on side. */
  private fields(): BreastfeedFields {
    const value = this.form.getRawValue();
    const fields: BreastfeedFields = {
      startTime: value.startTime!.toISOString(),
      notes: value.notes.trim() || null,
    };
    const typed = this.typed();
    if (typed) {
      const endedOn =
        typed.left === 0 ? 'right' : typed.right === 0 ? 'left' : (value.endedOn ?? 'right');
      fields.durations = { leftSeconds: typed.left, rightSeconds: typed.right, endedOn };
    }
    return fields;
  }
}
