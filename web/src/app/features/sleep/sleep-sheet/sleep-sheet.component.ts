import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Observable, map, startWith } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { EntryResult } from '../../../core/entries/entry-result';
import { applyServerErrors } from '../../../core/http/apply-server-errors';
import { Sleep, SleepFields } from '../../../core/sleeps/sleep.models';
import { SleepService } from '../../../core/sleeps/sleep.service';
import { SleepSyncService } from '../../../core/sleeps/sleep-sync.service';
import { DurationPipe } from '../../../core/time/duration';
import { NowService } from '../../../core/time/now.service';
import { notInFuture } from '../../../core/time/not-in-future';
import { TimeSincePipe } from '../../../core/time/time-since';
import { BannerComponent } from '../../../shared/ui/banner/banner.component';
import { EntryAuditComponent } from '../../../shared/ui/entry-audit/entry-audit.component';
import { EntrySheetComponent } from '../../../shared/ui/entry-sheet/entry-sheet.component';
import {
  EntrySheetData,
  EntrySheetResult,
} from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { FormRowComponent } from '../../../shared/ui/form-row/form-row.component';
import { NotesRowComponent, notesControl } from '../../../shared/ui/notes-row/notes-row.component';
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';
import { TimeRowComponent } from '../../../shared/ui/time-row/time-row.component';
import { TimerComponent } from '../../../shared/ui/timer/timer.component';
import { isStillSleeping, sleepSeconds } from '../sleep-duration';

/** Form-level codes with their own message; anything else is "unknown". */
const FORM_ERRORS = ['sleepNotFound', 'babyNotFound'];

/** Refuses an end that isn't after `start()` with `{ beforeStart: true }`; leaves empty values alone. */
const afterStart =
  (start: () => Date | null): ValidatorFn =>
  (control) => {
    const end = control.value as Date | null;
    const from = start();
    return end && from && end.getTime() <= from.getTime() ? { beforeStart: true } : null;
  };

/** Applies `validators` only while `when()` holds. */
const onlyWhen =
  (when: () => boolean, validators: ValidatorFn[]): ValidatorFn =>
  (control) =>
    when() ? Validators.compose(validators)!(control) : null;

/**
 * The Sleep sheet (spec 06): a single timer, the start time (now by default), the end time, the
 * duration between them, and notes, for the selected baby's sleep or the one it was opened with.
 *
 * The timer lives on the server (spec 04 Timers): Start creates the sleep live, with its start time
 * (or makes a stopped one live again, its duration running from its start time); Stop ends it now.
 * While live, the End time row reads "Sleeping…" and the duration ticks from the stored start time.
 * Opened to add while the baby has a live sleep, it opens that one (the oldest); a Start refused
 * because another sleep went live meanwhile opens that one too.
 *
 * A past sleep can be typed by hand: typing an end time on a sleep that isn't live turns Start off
 * until Save or ×. Save saves the start time, end time and notes (`PUT`, or `POST` for a sleep that
 * only exists in the sheet) and never starts or stops the timer. × discards the form: on a sheet
 * opened to add whose Start created the sleep, it deletes it (after confirming); on a sleep whose
 * timer was tapped here, it closes with the sleep as the taps left it, so lists show it.
 *
 * Taps, Save and Delete apply to the shared live state (`SleepSyncService`) at once. The sheet follows
 * what other devices do to its live sleep: a new start time or notes (unless edited here), and once it
 * leaves the live list, it is fetched: stopped, it is shown; deleted, the sheet closes with a message.
 * A sleep live for more than 12 hours shows "Still sleeping?".
 *
 * Closes with the saved sleep, or the id of the deleted one; offline, with `queued` once the change is
 * kept on the device.
 */
@Component({
  selector: 'nala-sleep-sheet',
  imports: [
    BannerComponent,
    DurationPipe,
    EntryAuditComponent,
    EntrySheetComponent,
    FormRowComponent,
    NotesRowComponent,
    TimeRowComponent,
    TimeSincePipe,
    TimerComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sleep-sheet.component.html',
  styleUrl: './sleep-sheet.component.scss',
})
export class SleepSheetComponent {
  private readonly sleeps = inject(SleepService);
  private readonly sync = inject(SleepSyncService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);
  private readonly sheetRef = inject<SheetRef<EntrySheetResult<Sleep>>>(SheetRef);
  private readonly now = inject(NowService).now;
  /** Null when adding. */
  private readonly entry = inject<EntrySheetData<Sleep>>(SHEET_DATA).entry;
  private readonly babyId = this.entry?.babyId ?? inject(SelectedBabyService).selected()?.id;
  /** The id a new sleep gets, kept across attempts so saving or starting again can't add it twice. */
  private readonly newId = crypto.randomUUID();

  /** As stored; null until Start creates it (or while looking for the live one). */
  protected readonly sleep = signal<Sleep | null>(this.entry);
  protected readonly live = computed(() => this.sleep()?.endTime === null);
  protected readonly stillSleeping = computed(() => {
    const sleep = this.sleep();
    return !!sleep && isStillSleeping(sleep, this.now());
  });

  private readonly startTime = new FormControl<Date | null>(
    this.entry ? new Date(this.entry.startTime) : new Date(),
    [Validators.required, notInFuture()],
  );
  private readonly endTime = new FormControl<Date | null>(
    this.entry?.endTime ? new Date(this.entry.endTime) : null,
    // A live sleep has no end time yet.
    onlyWhen(
      () => !this.live(),
      [Validators.required, notInFuture(), afterStart(() => this.startTime.value)],
    ),
  );

  private readonly notes = notesControl(this.entry?.notes ?? '');

  readonly form = new FormGroup({
    startTime: this.startTime,
    endTime: this.endTime,
    notes: this.notes,
  });

  protected readonly edited = computed(() => {
    const sleep = this.sleep();
    return !!sleep && sleep.updatedAt !== sleep.createdAt;
  });
  /** Sending a tap, saving or deleting. */
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  private readonly times = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { requireSync: true },
  );
  /** An end time typed on a sleep that isn't live: the timer is off until Save or ×. */
  private readonly endTyped = toSignal(this.endTime.events.pipe(map(() => this.endTime.dirty)), {
    initialValue: false,
  });
  protected readonly manual = computed(() => !this.live() && this.endTyped());

  /** The stored sleep's duration, live while it runs; 0 before Start. */
  protected readonly timerSeconds = computed(() => {
    const sleep = this.sleep();
    return sleep ? Math.max(0, sleepSeconds(sleep, this.now()) ?? 0) : 0;
  });

  /** From the start to the end (live while it runs); null until both are set and the end is after the start. */
  protected readonly seconds = computed(() => {
    if (this.live()) {
      return this.timerSeconds();
    }
    const { startTime, endTime } = this.times();
    const seconds =
      startTime && endTime
        ? sleepSeconds({ startTime: startTime.toISOString(), endTime: endTime.toISOString() })
        : null;
    return seconds !== null && seconds > 0 ? seconds : null;
  });

  /** This sheet, opened to add, created the sleep with a Start: × deletes it. */
  private readonly createdHere = signal(false);
  /** The sleep was listed as live by the shared state. */
  private listed = false;
  /** This sheet saved or deleted the sleep itself. */
  private settled = false;
  /** A timer tap here changed the sleep: × closes with it as the taps left it. */
  private readonly tapped = signal(false);
  protected readonly discard = computed(() => {
    if (this.createdHere()) {
      return () => this.delete();
    }
    return this.tapped() ? () => this.sheetRef.close({ saved: this.sleep()! }) : null;
  });

  constructor() {
    // The end must stay after the start when the start moves.
    this.startTime.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.endTime.updateValueAndValidity());
    if (!this.entry && this.babyId) {
      const current = this.sync.forBaby(this.babyId);
      if (current) {
        this.adopt(current);
      } else {
        this.openLive();
      }
    }
    effect(() => {
      const list = this.sync.inProgress();
      untracked(() => this.follow(list));
    });
  }

  protected start(): void {
    const id = this.sleep()?.id ?? this.newId;
    this.tap(this.sleeps.start(id, this.babyId!, new Date().toISOString()), () => {
      if (id === this.newId && !this.entry) {
        this.createdHere.set(true);
        this.form.markAsDirty();
      }
    });
  }

  protected stop(): void {
    this.tap(this.sleeps.stop(this.sleep()!.id, new Date().toISOString()));
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    const fields = this.fields();
    // Live or not, Save never starts or stops the timer.
    const sleep = this.sleep();
    const request = sleep
      ? this.sleeps.update(sleep.id, fields)
      : this.sleeps.create(this.babyId!, fields, this.newId);
    request.subscribe((result) => {
      this.saving.set(false);
      if (result.ok) {
        this.settled = true;
        if (result.queued) {
          this.sheetRef.close({ queued: true });
          return;
        }
        this.sync.put(result.entry);
        this.sheetRef.close({ saved: result.entry });
        return;
      }
      this.showFormError(applyServerErrors(this.form, result.errors));
    });
  }

  protected delete(): void {
    const sleep = this.sleep()!;
    this.saving.set(true);
    this.formError.set(null);
    this.sleeps.delete(sleep.id).subscribe((result) => {
      this.saving.set(false);
      if (result.ok) {
        this.settled = true;
        if (result.queued) {
          this.sheetRef.close({ queued: true });
          return;
        }
        this.sync.remove(sleep.id);
        this.sheetRef.close({ deleted: sleep.id });
      } else {
        this.showFormError(result.errors['form'] ?? 'unknown');
      }
    });
  }

  /**
   * Sends a timer tap and shows the sleep the server answers with; `done` runs once it is accepted.
   * Kept on the device (offline), the tap is sent later. Refused because another sleep of the baby is
   * live, it opens that one.
   */
  private tap(request: Observable<EntryResult<Sleep>>, done: () => void = () => undefined): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    request.subscribe((result) => {
      this.saving.set(false);
      if (result.ok && !result.queued) {
        this.tapped.set(true);
        this.sync.put(result.entry);
        this.show(result.entry);
        done();
      } else if (!result.ok && result.errors['form'] === 'sleepInProgress') {
        this.openLive();
      } else if (!result.ok) {
        this.showFormError(result.errors['form'] ?? 'unknown');
      }
    });
  }

  /** Opens the baby's live sleep (the oldest), if any, unless this sheet already has one. */
  private openLive(): void {
    this.sleeps.inProgress().subscribe({
      next: (live) => {
        const current = live.find((sleep) => sleep.babyId === this.babyId);
        if (current && !this.sleep()) {
          this.adopt(current);
        }
      },
      // Can't be loaded: the sheet still works, and Start would be refused with the live one.
      error: () => undefined,
    });
  }

  /** Opens the live `sleep` in the sheet, with its start time and notes. */
  private adopt(sleep: Sleep): void {
    this.sleep.set(sleep);
    this.form.reset({
      startTime: new Date(sleep.startTime),
      endTime: null,
      notes: sleep.notes ?? '',
    });
  }

  /**
   * Follows what other devices did to this sheet's live sleep. Once it leaves the live list without
   * this sheet stopping it, it was stopped or deleted elsewhere: the sleep is fetched to tell which.
   */
  private follow(list: readonly Sleep[]): void {
    const sleep = this.sleep();
    if (!sleep || this.saving() || this.settled) {
      return;
    }
    const shared = list.find((s) => s.id === sleep.id);
    if (shared) {
      this.listed = true;
      if (shared.updatedAt !== sleep.updatedAt) {
        this.show(shared);
      }
    } else if (this.listed && sleep.endTime === null) {
      this.listed = false;
      this.sleeps.get(sleep.id).subscribe({
        next: (current) => (current ? this.ended(current) : this.deletedElsewhere()),
        // Offline or failing: keep what is shown.
        error: () => undefined,
      });
    }
  }

  /** Stopped on another device: shown as it is now, unless this sheet moved on meanwhile. */
  private ended(sleep: Sleep): void {
    if (!this.settled && this.sleep()?.id === sleep.id) {
      this.show(sleep);
    }
  }

  private deletedElsewhere(): void {
    if (this.settled) {
      return;
    }
    this.snackBar.open(this.transloco.translate('sleep.sheet.deletedElsewhere'), undefined, {
      duration: 5000,
    });
    this.sheetRef.close();
  }

  /** The sleep as stored now; a start time, end time or notes not edited here follow it. */
  private show(sleep: Sleep): void {
    this.sleep.set(sleep);
    if (this.startTime.pristine) {
      this.startTime.setValue(new Date(sleep.startTime));
    }
    if (this.notes.pristine) {
      this.notes.setValue(sleep.notes ?? '');
    }
    if (sleep.endTime === null) {
      this.endTime.reset(null);
    } else if (this.endTime.pristine) {
      this.endTime.setValue(new Date(sleep.endTime));
    }
    this.endTime.updateValueAndValidity();
  }

  private showFormError(code: string | null): void {
    this.formError.set(code === null ? null : FORM_ERRORS.includes(code) ? code : 'unknown');
  }

  /** Call only on a valid form. A live sleep has no end time. */
  private fields(): SleepFields {
    const value = this.form.getRawValue();
    return {
      startTime: value.startTime!.toISOString(),
      endTime: this.live() ? null : value.endTime!.toISOString(),
      notes: value.notes.trim() || null,
    };
  }
}
