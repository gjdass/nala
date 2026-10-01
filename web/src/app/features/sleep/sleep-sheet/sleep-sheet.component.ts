import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { map, startWith } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { applyServerErrors } from '../../../core/http/apply-server-errors';
import { Sleep, SleepFields } from '../../../core/sleeps/sleep.models';
import { SleepService } from '../../../core/sleeps/sleep.service';
import { DurationPipe } from '../../../core/time/duration';
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
import { TimeRowComponent } from '../../../shared/ui/time-row/time-row.component';
import { sleepSeconds } from '../sleep-duration';

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

/**
 * The Sleep sheet (spec 06), adding a sleep typed by hand for the selected baby or editing the one it
 * was opened with: start time (now by default), end time (none until tapped, then now; after the
 * start), the duration between them, and notes. Closes with the saved sleep, or the id of the deleted
 * one; offline, with `queued` once the change is kept on the device.
 */
@Component({
  selector: 'nala-sleep-sheet',
  imports: [
    DurationPipe,
    EntryAuditComponent,
    EntrySheetComponent,
    FormRowComponent,
    NotesRowComponent,
    TimeRowComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sleep-sheet.component.html',
  styleUrl: './sleep-sheet.component.scss',
})
export class SleepSheetComponent {
  private readonly sleeps = inject(SleepService);
  private readonly sheetRef = inject<SheetRef<EntrySheetResult<Sleep>>>(SheetRef);
  private readonly store = inject(SelectedBabyService);
  /** Null when adding. */
  protected readonly sleep = inject<EntrySheetData<Sleep>>(SHEET_DATA).entry;
  /** Kept across attempts, so saving again after a failure can't add the sleep twice. */
  private readonly id = crypto.randomUUID();

  private readonly startTime = new FormControl<Date | null>(
    this.sleep ? new Date(this.sleep.startTime) : new Date(),
    [Validators.required, notInFuture()],
  );

  readonly form = new FormGroup({
    startTime: this.startTime,
    endTime: new FormControl<Date | null>(
      this.sleep?.endTime ? new Date(this.sleep.endTime) : null,
      [Validators.required, notInFuture(), afterStart(() => this.startTime.value)],
    ),
    notes: notesControl(this.sleep?.notes ?? ''),
  });

  protected readonly edited = !!this.sleep && this.sleep.updatedAt !== this.sleep.createdAt;
  /** Saving or deleting. */
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  private readonly times = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { requireSync: true },
  );

  /** From the start to the end; null until both are set and the end is after the start. */
  protected readonly seconds = computed(() => {
    const { startTime, endTime } = this.times();
    const seconds =
      startTime && endTime
        ? sleepSeconds({ startTime: startTime.toISOString(), endTime: endTime.toISOString() })
        : null;
    return seconds !== null && seconds > 0 ? seconds : null;
  });

  constructor() {
    // The end must stay after the start when the start moves.
    this.startTime.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.endTime.updateValueAndValidity());
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    const fields = this.fields();
    const request = this.sleep
      ? this.sleeps.update(this.sleep.id, fields)
      : this.sleeps.create(this.store.selected()!.id, fields, this.id);
    request.subscribe((result) => {
      this.saving.set(false);
      if (result.ok) {
        this.sheetRef.close(result.queued ? { queued: true } : { saved: result.entry });
        return;
      }
      this.showFormError(applyServerErrors(this.form, result.errors));
    });
  }

  protected delete(): void {
    const sleep = this.sleep!;
    this.saving.set(true);
    this.formError.set(null);
    this.sleeps.delete(sleep.id).subscribe((result) => {
      this.saving.set(false);
      if (result.ok) {
        this.sheetRef.close(result.queued ? { queued: true } : { deleted: sleep.id });
      } else {
        this.showFormError(result.errors['form'] ?? 'unknown');
      }
    });
  }

  private showFormError(code: string | null): void {
    this.formError.set(code === null ? null : FORM_ERRORS.includes(code) ? code : 'unknown');
  }

  /** Call only on a valid form. */
  private fields(): SleepFields {
    const value = this.form.getRawValue();
    return {
      startTime: value.startTime!.toISOString(),
      endTime: value.endTime!.toISOString(),
      notes: value.notes.trim() || null,
    };
  }
}
