import { Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, map, merge, of, startWith } from 'rxjs';
import { EntryDeleteResult, EntryResult } from '../../../core/entries/entry-result';
import { UserName } from '../../../core/entries/entry.models';
import { applyServerErrors } from '../../../core/http/apply-server-errors';
import { sectionScheme } from '../../../core/sections/section-scheme';
import { afterStart } from '../../../core/time/after-start';
import { isLiveLongerThan } from '../../../core/time/live-longer-than';
import { NowService } from '../../../core/time/now.service';
import { spanSeconds } from '../../../core/time/span-seconds';
import { LiveEntriesSync } from '../../../core/timers/live-entries-sync';
import { stoppedEntry } from '../../../core/timers/stopped-entry';
import { notesControl } from '../notes-row/notes-row.component';
import {
  DurationDialogComponent,
  DurationDialogData,
} from '../duration-dialog/duration-dialog.component';
import { SHEET_DATA, SheetRef } from '../sheet/sheet-ref';
import { EntrySheetData, EntrySheetResult } from './entry-sheet.models';

/** An entry with a single timer (spec 04 Timers: Sleep, Pump), as the API returns it. */
export interface TimedEntry {
  id: string;
  babyId: string;
  /** ISO date-time (UTC). */
  startTime: string;
  /** ISO date-time (UTC); null while live. */
  endTime: string | null;
  notes: string | null;
  updatedBy: UserName;
  createdAt: string;
  updatedAt: string;
}

/** The start time, end time and notes every timed entry sends, to add or to edit. */
export interface TimedEntryFields {
  startTime: string;
  /** Null for a live entry, which keeps running. */
  endTime: string | null;
  notes: string | null;
}

/** A section's API for its timed entries (e.g. `SleepService`). */
export interface TimedEntryApi<T extends TimedEntry, F extends TimedEntryFields> {
  create(babyId: string, fields: F, id: string): Observable<EntryResult<T>>;
  update(id: string, fields: F): Observable<EntryResult<T>>;
  delete(id: string): Observable<EntryDeleteResult>;
  get(id: string): Observable<T | null>;
  start(id: string, babyId: string, at: string): Observable<EntryResult<T>>;
  stop(id: string, at: string): Observable<EntryResult<T>>;
}

export interface LiveEntrySheetConfig<T extends TimedEntry, F extends TimedEntryFields> {
  /** The entry the sheet was opened with; null when adding. */
  entry: T | null;
  /** The baby a new entry is for. */
  babyId: string | undefined;
  api: TimedEntryApi<T, F>;
  sync: LiveEntriesSync<T>;
  /** The code a Start refused because another entry of the baby is live answers (e.g. `sleepInProgress`). */
  inProgressCode: string;
  /** Form-level codes with their own message; anything else is "unknown". */
  formErrors: readonly string[];
  /** Translation key of the message once the entry was deleted on another device. */
  deletedElsewhere: string;
  /** How long an entry may stay live before the sheet asks "Still …?". */
  stillLiveAfterMs: number;
}

/** What a sheet adds to the shared controls: its own controls following the stored entry. */
export interface LiveEntrySheetHooks<T, F extends TimedEntryFields> {
  /** The sheet's own fields, sent with the shared ones by Save (and by a tap saving the changes first). */
  fields?(): Omit<F, keyof TimedEntryFields>;
  /** The sheet's own control values for `entry`, when the sheet opens it (merged into the form reset). */
  values?(entry: T): Record<string, unknown>;
  /** The stored `entry` changed: the sheet's own controls not edited here follow it. */
  follow?(entry: T): void;
}

/** Applies `validators` only while `when()` holds. */
const onlyWhen =
  (when: () => boolean, validators: ValidatorFn[]): ValidatorFn =>
  (control) =>
    when() ? Validators.compose(validators)!(control) : null;

/**
 * The shared logic of a sheet with a single timer (spec 04 Timers; Sleep, Pump): its start time (now by
 * default), end time and notes controls, the timer, Save, Delete and ×. Created in the sheet's
 * injection context; the sheet builds its form from `startTime`, `endTime` and `notes` (plus its own
 * controls) and hands it to `connect`.
 *
 * The timer lives on the server: Start creates the entry live, with its start time (or makes a
 * stopped one live again, its duration running from its start time); Stop ends it now. Opened to add
 * while the baby has a live entry, the sheet opens that one (the oldest); a Start refused because
 * another entry went live meanwhile opens that one too.
 *
 * A typed duration (`editDuration`) corrects the timer without stopping it: on a live entry the start
 * moves to now − duration and the timer keeps running from it; otherwise the end moves to start +
 * duration. The timer always shows the form's times. Start / Stop is never turned off: a tap while
 * the form has changes Save would accept saves them first (the sheet stays open), then is sent
 * (spec 04). Save sends the fields (`PUT`, or `POST` for an entry that only exists in the sheet) and
 * never starts or stops the timer. ×
 * discards the form: on a sheet opened to add whose Start created the entry, it deletes it (after
 * confirming); on an entry whose timer was tapped here, it closes with the entry as the taps left it,
 * so lists show it.
 *
 * Taps, Save and Delete apply to the shared live state (`sync`) at once. The sheet follows what other
 * devices do to its live entry: new values (unless edited here), and once it leaves the live list, it
 * is fetched: stopped, it is shown; deleted, the sheet closes with a message. A tap kept on the device
 * (offline) shows as the shared state applies it.
 *
 * Closes with the saved entry, or the id of the deleted one; offline, with `queued` once the change
 * is kept on the device.
 */
export class LiveEntrySheet<T extends TimedEntry, F extends TimedEntryFields> {
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);
  private readonly sheetRef = inject<SheetRef<EntrySheetResult<T>>>(SheetRef);
  private readonly dialog = inject(MatDialog);
  private readonly section = inject<EntrySheetData<T>>(SHEET_DATA).section;
  private readonly now = inject(NowService).now;
  private readonly api: TimedEntryApi<T, F>;
  private readonly sync: LiveEntriesSync<T>;
  /** The id a new entry gets, kept across attempts so saving or starting again can't add it twice. */
  private readonly newId = crypto.randomUUID();
  private form!: FormGroup;
  private hooks: LiveEntrySheetHooks<T, F> = {};

  /** As stored; null until Start creates it (or while looking for the live one). */
  readonly entry = signal<T | null>(null);
  readonly live = computed(() => this.entry()?.endTime === null);
  /** Live for longer than the section allows: "Still …?". */
  readonly stillLive = computed(() => {
    const entry = this.entry();
    return !!entry && isLiveLongerThan(entry, this.config.stillLiveAfterMs, this.now());
  });
  readonly edited = computed(() => {
    const entry = this.entry();
    return !!entry && entry.updatedAt !== entry.createdAt;
  });
  /** Sending a tap, saving or deleting. */
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly startTime: FormControl<Date | null>;
  readonly endTime: FormControl<Date | null>;
  readonly notes: FormControl<string>;

  private readonly times: Signal<{ startTime: Date | null; endTime: Date | null }>;
  /**
   * From the form's start to its end, or to now while live (counting up); null until both are set
   * and the end is after the start.
   */
  readonly seconds = computed(() => {
    const { startTime, endTime } = this.times();
    if (this.live()) {
      return startTime ? Math.max(0, Math.floor((this.now() - startTime.getTime()) / 1000)) : null;
    }
    const seconds =
      startTime && endTime
        ? spanSeconds({ startTime: startTime.toISOString(), endTime: endTime.toISOString() })
        : null;
    return seconds !== null && seconds > 0 ? seconds : null;
  });

  /** What the timer shows: the form's duration, 0 without one. */
  readonly shownSeconds = computed(() => this.seconds() ?? 0);

  /** This sheet, opened to add, created the entry with a Start: × deletes it. */
  private readonly createdHere = signal(false);
  /** The entry was listed as live by the shared state. */
  private listed = false;
  /** This sheet saved or deleted the entry itself. */
  private settled = false;
  /** A timer tap here changed the entry: × closes with it as the taps left it. */
  private readonly tapped = signal(false);
  readonly discard = computed(() => {
    if (this.createdHere()) {
      return () => this.delete();
    }
    return this.tapped() ? () => this.sheetRef.close({ saved: this.entry()! }) : null;
  });

  constructor(private readonly config: LiveEntrySheetConfig<T, F>) {
    this.api = config.api;
    this.sync = config.sync;
    const entry = config.entry;
    this.entry.set(entry);
    this.startTime = new FormControl<Date | null>(
      entry ? new Date(entry.startTime) : new Date(),
      Validators.required,
    );
    this.endTime = new FormControl<Date | null>(
      entry?.endTime ? new Date(entry.endTime) : null,
      // A live entry has no end time yet.
      onlyWhen(() => !this.live(), [Validators.required, afterStart(() => this.startTime.value)]),
    );
    this.notes = notesControl(entry?.notes ?? '');
    this.times = toSignal(
      merge(this.startTime.valueChanges, this.endTime.valueChanges).pipe(
        startWith(null),
        map(() => ({ startTime: this.startTime.value, endTime: this.endTime.value })),
      ),
      { requireSync: true },
    );
    // The end must stay after the start when the start moves.
    this.startTime.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.endTime.updateValueAndValidity());
  }

  /**
   * Hands the sheet's form (built from `startTime`, `endTime`, `notes` and the sheet's own controls)
   * and its hooks; opens the baby's live entry when adding, and starts following the shared state.
   * Call from the sheet's constructor.
   */
  connect(form: FormGroup, hooks: LiveEntrySheetHooks<T, F> = {}): void {
    this.form = form;
    this.hooks = hooks;
    const { entry, babyId } = this.config;
    if (!entry && babyId) {
      const current = this.sync.forBaby(babyId);
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

  /** The fields of a valid form: the shared ones and the sheet's own. A live entry has no end time. */
  fields(): F {
    return {
      startTime: this.startTime.value!.toISOString(),
      endTime: this.live() ? null : this.endTime.value!.toISOString(),
      notes: this.notes.value.trim() || null,
      ...this.hooks.fields?.(),
    } as F;
  }

  start(): void {
    this.tap(() => {
      const id = this.entry()?.id ?? this.newId;
      return {
        request: this.api.start(id, this.config.babyId!, new Date().toISOString()),
        offline: () => this.sync.inProgress().find((e) => e.id === id),
        done: () => {
          if (id === this.newId && !this.config.entry) {
            this.createdHere.set(true);
            this.form.markAsDirty();
          }
        },
      };
    });
  }

  stop(): void {
    this.tap(() => {
      const entry = this.entry()!;
      const at = new Date().toISOString();
      return { request: this.api.stop(entry.id, at), offline: () => stoppedEntry(entry, at) };
    });
  }

  /**
   * Opens the duration dialog on what the timer shows. A typed duration corrects the timer without
   * stopping it: on a live entry the start moves to now − duration, otherwise the end moves to the
   * start plus it.
   */
  editDuration(): void {
    this.dialog
      .open<DurationDialogComponent, DurationDialogData, number | undefined>(
        DurationDialogComponent,
        {
          data: {
            title: this.transloco.translate('timer.duration'),
            seconds: this.shownSeconds(),
          },
          panelClass: sectionScheme(this.section),
        },
      )
      .afterClosed()
      .subscribe((seconds) => {
        const start = this.startTime.value;
        if (seconds === undefined || !start) {
          return;
        }
        const moved = this.live() ? this.startTime : this.endTime;
        moved.setValue(
          this.live()
            ? new Date(Date.now() - seconds * 1000)
            : new Date(start.getTime() + seconds * 1000),
        );
        moved.markAsDirty();
        moved.markAsTouched();
        this.form.markAsDirty();
      });
  }

  /** Saves the form (when valid); Save never starts or stops the timer. */
  save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    this.send(this.fields()).subscribe((result) => {
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

  delete(): void {
    const entry = this.entry()!;
    this.saving.set(true);
    this.formError.set(null);
    this.api.delete(entry.id).subscribe((result) => {
      this.saving.set(false);
      if (result.ok) {
        this.settled = true;
        if (result.queued) {
          this.sheetRef.close({ queued: true });
          return;
        }
        this.sync.remove(entry.id);
        this.sheetRef.close({ deleted: entry.id });
      } else {
        this.showFormError(result.errors['form'] ?? 'unknown');
      }
    });
  }

  /** Sends `fields`: an update, or a create for an entry that only exists in the sheet. */
  private send(fields: F): Observable<EntryResult<T>> {
    const entry = this.entry();
    return entry
      ? this.api.update(entry.id, fields)
      : this.api.create(this.config.babyId!, fields, this.newId);
  }

  /**
   * The form's changes Save would accept, saved before a tap (the sheet stays open), so the tap
   * doesn't lose them; nothing to save: null.
   */
  private saveFirst(): Observable<EntryResult<T>> | null {
    const changed = Object.values(this.form.controls).some((control) => control.dirty);
    return changed && this.form.valid ? this.send(this.fields()) : null;
  }

  /**
   * Sends a timer tap (built by `tap` once the form's changes are saved, see `saveFirst`) and shows
   * the entry the server answers with, or, when the tap is kept on the device (offline), the entry as
   * it will be once applied (`offline`, after the shared state applied it). `done` runs once the tap
   * is accepted or kept. Refused because another entry of the baby is live, it opens that one.
   */
  private tap(
    tap: () => {
      request: Observable<EntryResult<T>>;
      offline: () => T | undefined;
      done?: () => void;
    },
  ): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    const first = this.saveFirst();
    (first ?? of(null as EntryResult<T> | null)).subscribe((saved) => {
      if (saved && !saved.ok) {
        this.saving.set(false);
        this.showFormError(applyServerErrors(this.form, saved.errors));
        return;
      }
      if (saved) {
        Object.values(this.form.controls).forEach((control) => control.markAsPristine());
        if (!saved.queued) {
          this.sync.put(saved.entry);
          this.show(saved.entry);
        }
      }
      this.sendTap(tap());
    });
  }

  private sendTap({
    request,
    offline,
    done = () => undefined,
  }: {
    request: Observable<EntryResult<T>>;
    offline: () => T | undefined;
    done?: () => void;
  }): void {
    request.subscribe((result) => {
      this.saving.set(false);
      if (result.ok && result.queued) {
        this.sync.applyWaiting(this.entry() ?? undefined);
        const local = offline();
        if (local) {
          this.tapped.set(true);
          this.show(local);
        }
        done();
      } else if (result.ok) {
        this.tapped.set(true);
        this.sync.put(result.entry);
        this.show(result.entry);
        done();
      } else if (!result.ok && result.errors['form'] === this.config.inProgressCode) {
        this.openLive();
      } else if (!result.ok) {
        this.showFormError(result.errors['form'] ?? 'unknown');
      }
    });
  }

  /**
   * Opens the baby's live entry (the oldest), if any, unless this sheet already has one, once the
   * shared live poll has answered. Without an answer the sheet still works, and Start would be
   * refused with the live one.
   */
  private openLive(): void {
    const babyId = this.config.babyId;
    this.sync.refresh().subscribe(() => {
      const current = babyId ? this.sync.forBaby(babyId) : null;
      if (current && !this.entry()) {
        this.adopt(current);
      }
    });
  }

  /** Opens the live `entry` in the sheet, with its values. */
  private adopt(entry: T): void {
    this.entry.set(entry);
    this.form.reset({
      startTime: new Date(entry.startTime),
      endTime: null,
      notes: entry.notes ?? '',
      ...this.hooks.values?.(entry),
    });
  }

  /**
   * Follows what other devices did to this sheet's live entry. Once it leaves the live list without
   * this sheet stopping it, it was stopped or deleted elsewhere: the entry is fetched to tell which.
   */
  private follow(list: readonly T[]): void {
    const entry = this.entry();
    if (!entry || this.saving() || this.settled) {
      return;
    }
    const shared = list.find((e) => e.id === entry.id);
    if (shared) {
      this.listed = true;
      if (shared.updatedAt !== entry.updatedAt) {
        this.show(shared);
      }
    } else if (this.listed && entry.endTime === null) {
      this.listed = false;
      this.api.get(entry.id).subscribe({
        next: (current) => (current ? this.ended(current) : this.deletedElsewhere()),
        // Offline or failing: keep what is shown.
        error: () => undefined,
      });
    }
  }

  /** Stopped on another device: shown as it is now, unless this sheet moved on meanwhile. */
  private ended(entry: T): void {
    if (!this.settled && this.entry()?.id === entry.id) {
      this.show(entry);
    }
  }

  private deletedElsewhere(): void {
    if (this.settled) {
      return;
    }
    this.snackBar.open(this.transloco.translate(this.config.deletedElsewhere), undefined, {
      duration: 5000,
    });
    this.sheetRef.close();
  }

  /** The entry as stored now; values not edited here follow it. */
  private show(entry: T): void {
    this.entry.set(entry);
    if (this.startTime.pristine) {
      this.startTime.setValue(new Date(entry.startTime));
    }
    if (this.notes.pristine) {
      this.notes.setValue(entry.notes ?? '');
    }
    if (entry.endTime === null) {
      this.endTime.reset(null);
    } else if (this.endTime.pristine) {
      this.endTime.setValue(new Date(entry.endTime));
    }
    this.endTime.updateValueAndValidity();
    this.hooks.follow?.(entry);
  }

  private showFormError(code: string | null): void {
    this.formError.set(
      code === null ? null : this.config.formErrors.includes(code) ? code : 'unknown',
    );
  }
}
