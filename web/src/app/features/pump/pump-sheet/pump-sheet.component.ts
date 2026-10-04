import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { map, startWith } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { applyServerErrors } from '../../../core/http/apply-server-errors';
import { pumpTotalMl } from '../../../core/pumps/pump';
import { PUMP_VOLUME_MAX_ML, Pump, PumpFields } from '../../../core/pumps/pump.models';
import { PumpService } from '../../../core/pumps/pump.service';
import { afterStart } from '../../../core/time/after-start';
import { DurationPipe } from '../../../core/time/duration';
import { notInFuture } from '../../../core/time/not-in-future';
import { spanSeconds } from '../../../core/time/span-seconds';
import { EntryAuditComponent } from '../../../shared/ui/entry-audit/entry-audit.component';
import { EntrySheetComponent } from '../../../shared/ui/entry-sheet/entry-sheet.component';
import {
  EntrySheetData,
  EntrySheetResult,
} from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { FormRowComponent } from '../../../shared/ui/form-row/form-row.component';
import { NotesRowComponent, notesControl } from '../../../shared/ui/notes-row/notes-row.component';
import { NumberFieldsRowComponent } from '../../../shared/ui/number-fields-row/number-fields-row.component';
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';
import { TimeRowComponent } from '../../../shared/ui/time-row/time-row.component';

/** Form-level codes with their own message; anything else is "unknown". */
const FORM_ERRORS = ['pumpNotFound', 'babyNotFound'];

/** An optional volume: a whole number of ml, 0–500. */
const volume = (ml: number | null) =>
  new FormControl<number | null>(ml, [
    Validators.min(0),
    Validators.max(PUMP_VOLUME_MAX_ML),
    Validators.pattern(/^\d+$/),
  ]);

/**
 * The Pump sheet (spec 08), adding a pumping session typed by hand for the selected baby or editing
 * the one it was opened with: start time (now by default), end time (none until tapped, then now;
 * after the start), the duration between them, Left ml and Right ml side by side (optional, 0–500),
 * the total once a side has a volume, and notes. Closes with the saved session, or the id of the
 * deleted one; offline, with `queued` once the change is kept on the device.
 */
@Component({
  selector: 'nala-pump-sheet',
  imports: [
    DurationPipe,
    EntryAuditComponent,
    EntrySheetComponent,
    FormRowComponent,
    NotesRowComponent,
    NumberFieldsRowComponent,
    TimeRowComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pump-sheet.component.html',
  styleUrl: './pump-sheet.component.scss',
})
export class PumpSheetComponent {
  private readonly pumps = inject(PumpService);
  private readonly sheetRef = inject<SheetRef<EntrySheetResult<Pump>>>(SheetRef);
  private readonly store = inject(SelectedBabyService);
  /** Null when adding. */
  protected readonly pump = inject<EntrySheetData<Pump>>(SHEET_DATA).entry;
  /** Kept across attempts, so saving again after a failure can't add the session twice. */
  private readonly id = crypto.randomUUID();

  private readonly startTime = new FormControl<Date | null>(
    this.pump ? new Date(this.pump.startTime) : new Date(),
    [Validators.required, notInFuture()],
  );

  readonly form = new FormGroup({
    startTime: this.startTime,
    endTime: new FormControl<Date | null>(this.pump?.endTime ? new Date(this.pump.endTime) : null, [
      Validators.required,
      notInFuture(),
      afterStart(() => this.startTime.value),
    ]),
    leftMl: volume(this.pump?.leftMl ?? null),
    rightMl: volume(this.pump?.rightMl ?? null),
    notes: notesControl(this.pump?.notes ?? ''),
  });

  protected readonly maxMl = PUMP_VOLUME_MAX_ML;

  protected readonly edited = !!this.pump && this.pump.updatedAt !== this.pump.createdAt;
  /** Saving or deleting. */
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  private readonly values = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { requireSync: true },
  );

  /** From the start to the end; null until both are set and the end is after the start. */
  protected readonly seconds = computed(() => {
    const { startTime, endTime } = this.values();
    const seconds =
      startTime && endTime
        ? spanSeconds({ startTime: startTime.toISOString(), endTime: endTime.toISOString() })
        : null;
    return seconds !== null && seconds > 0 ? seconds : null;
  });

  /** Left + right; null while neither side has a volume. */
  protected readonly total = computed(() => {
    const { leftMl, rightMl } = this.values();
    return pumpTotalMl({ leftMl: ml(leftMl), rightMl: ml(rightMl) });
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
    const request = this.pump
      ? this.pumps.update(this.pump.id, fields)
      : this.pumps.create(this.store.selected()!.id, fields, this.id);
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
    const pump = this.pump!;
    this.saving.set(true);
    this.formError.set(null);
    this.pumps.delete(pump.id).subscribe((result) => {
      this.saving.set(false);
      if (result.ok) {
        this.sheetRef.close(result.queued ? { queued: true } : { deleted: pump.id });
      } else {
        this.showFormError(result.errors['form'] ?? 'unknown');
      }
    });
  }

  private showFormError(code: string | null): void {
    this.formError.set(code === null ? null : FORM_ERRORS.includes(code) ? code : 'unknown');
  }

  /** Call only on a valid form. */
  private fields(): PumpFields {
    const value = this.form.getRawValue();
    return {
      startTime: value.startTime!.toISOString(),
      endTime: value.endTime!.toISOString(),
      leftMl: ml(value.leftMl),
      rightMl: ml(value.rightMl),
      notes: value.notes.trim() || null,
    };
  }
}

/** A typed volume; an emptied number field may hold null or an empty string. */
function ml(value: number | string | null): number | null {
  return value === null || value === '' ? null : Number(value);
}
