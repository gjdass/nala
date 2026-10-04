import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { map, startWith } from 'rxjs';
import { FieldErrors } from '../../../core/auth/auth.models';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { decimals } from '../../../core/forms/decimals';
import { GrowthEntry, MeasurementFields } from '../../../core/growth-entries/growth-entry.models';
import { GrowthEntryService } from '../../../core/growth-entries/growth-entry.service';
import { gramsToKg, isoDate, kgToGrams, localDate } from '../../../core/growth-entries/measurement';
import { applyServerErrors } from '../../../core/http/apply-server-errors';
import { notInFuture } from '../../../core/time/not-in-future';
import { EntryAuditComponent } from '../../../shared/ui/entry-audit/entry-audit.component';
import { EntrySheetComponent } from '../../../shared/ui/entry-sheet/entry-sheet.component';
import {
  EntrySheetData,
  EntrySheetResult,
} from '../../../shared/ui/entry-sheet/entry-sheet.models';
import { NotesRowComponent, notesControl } from '../../../shared/ui/notes-row/notes-row.component';
import { NumberFieldsRowComponent } from '../../../shared/ui/number-fields-row/number-fields-row.component';
import { SHEET_DATA, SheetRef } from '../../../shared/ui/sheet/sheet-ref';
import { TimeRowComponent } from '../../../shared/ui/time-row/time-row.component';

/** Bounds of each value as typed (spec 10): kg for the weight, cm otherwise. */
export const WEIGHT_KG = { min: 0.3, max: 30, step: 0.001 };
export const LENGTH_CM = { min: 20, max: 130, step: 0.1 };
export const HEAD_CM = { min: 15, max: 60, step: 0.1 };

const today = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/** Not before the `yyyy-MM-dd` birth date `birthDate()` (none known: no check). */
const notBeforeBirth =
  (birthDate: () => string | null): ValidatorFn =>
  (control) => {
    const value = control.value as Date | null;
    const birth = birthDate();
    return value && birth && value < localDate(birth) ? { beforeBirth: true } : null;
  };

/** At least one value (`measurementRequired` on the form otherwise). */
const measurementRequired: ValidatorFn = (group) => {
  const { weight, length, head } = (group as FormGroup).getRawValue() as Record<
    string,
    number | null
  >;
  return weight === null && length === null && head === null ? { measurementRequired: true } : null;
};

/** Form-level codes with their own message; anything else is "unknown". */
const FORM_ERRORS = ['growthEntryNotFound', 'babyNotFound'];

/** The API's field names, by the sheet's control names. */
const SERVER_FIELDS: Record<string, string> = {
  weightG: 'weight',
  lengthCm: 'length',
  headCircumferenceCm: 'head',
};

/**
 * The Measurement sheet (spec 10), adding a measurement for the selected baby or editing the one it
 * was opened with: the date (today by default, without a time, not in the future nor before the
 * baby's birth date), then weight (kg, 0.3 to 30, up to 3 decimals, saved as grams), length (cm, 20 to
 * 130) and head circumference (cm, 15 to 60, both up to 1 decimal) in one row, at least one of them,
 * and notes. No timer: Save is the only action, and × discards the form. Closes with the saved entry,
 * or the id of the deleted one; offline, with `queued` once the change is kept on the device.
 */
@Component({
  selector: 'nala-measurement-sheet',
  imports: [
    EntryAuditComponent,
    EntrySheetComponent,
    NotesRowComponent,
    NumberFieldsRowComponent,
    ReactiveFormsModule,
    TimeRowComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './measurement-sheet.component.html',
  styleUrl: './measurement-sheet.component.scss',
})
export class MeasurementSheetComponent {
  private readonly growthEntries = inject(GrowthEntryService);
  private readonly sheetRef = inject<SheetRef<EntrySheetResult<GrowthEntry>>>(SheetRef);
  private readonly store = inject(SelectedBabyService);
  /** Null when adding. */
  protected readonly growthEntry = inject<EntrySheetData<GrowthEntry>>(SHEET_DATA).entry;
  /** Kept across attempts, so saving again after a failure can't add the entry twice. */
  private readonly id = crypto.randomUUID();

  readonly form = new FormGroup(
    {
      date: new FormControl<Date | null>(
        this.growthEntry ? localDate(this.growthEntry.date) : today(),
        [
          Validators.required,
          notInFuture(),
          notBeforeBirth(() => this.store.selected()?.birthDate ?? null),
        ],
      ),
      weight: new FormControl<number | null>(
        this.growthEntry?.weightG != null ? gramsToKg(this.growthEntry.weightG) : null,
        [Validators.min(WEIGHT_KG.min), Validators.max(WEIGHT_KG.max), decimals(3)],
      ),
      length: new FormControl<number | null>(this.growthEntry?.lengthCm ?? null, [
        Validators.min(LENGTH_CM.min),
        Validators.max(LENGTH_CM.max),
        decimals(1),
      ]),
      head: new FormControl<number | null>(this.growthEntry?.headCircumferenceCm ?? null, [
        Validators.min(HEAD_CM.min),
        Validators.max(HEAD_CM.max),
        decimals(1),
      ]),
      notes: notesControl(this.growthEntry?.notes ?? ''),
    },
    { validators: measurementRequired },
  );

  protected readonly weightKg = WEIGHT_KG;
  protected readonly lengthCm = LENGTH_CM;
  protected readonly headCm = HEAD_CM;
  protected readonly edited =
    !!this.growthEntry && this.growthEntry.updatedAt !== this.growthEntry.createdAt;
  /** Saving or deleting. */
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  /** "Enter a value" once a value was touched and none is left. */
  protected readonly measurementsError = toSignal(
    this.form.events.pipe(
      startWith(null),
      map(() => {
        const { weight, length, head } = this.form.controls;
        return (
          this.form.hasError('measurementRequired') &&
          (weight.touched || length.touched || head.touched)
        );
      }),
    ),
    { requireSync: true },
  );

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    const fields = this.fields();
    const request = this.growthEntry
      ? this.growthEntries.update(this.growthEntry.id, fields)
      : this.growthEntries.create(this.store.selected()!.id, 'measurement', fields, this.id);
    request.subscribe((result) => {
      this.saving.set(false);
      if (result.ok) {
        this.sheetRef.close(result.queued ? { queued: true } : { saved: result.entry });
        return;
      }
      this.showFormError(applyServerErrors(this.form, this.toControls(result.errors)));
    });
  }

  protected delete(): void {
    const growthEntry = this.growthEntry!;
    this.saving.set(true);
    this.formError.set(null);
    this.growthEntries.delete(growthEntry.id).subscribe((result) => {
      this.saving.set(false);
      if (result.ok) {
        this.sheetRef.close(result.queued ? { queued: true } : { deleted: growthEntry.id });
      } else {
        this.showFormError(result.errors['form'] ?? 'unknown');
      }
    });
  }

  private showFormError(code: string | null): void {
    this.formError.set(code === null ? null : FORM_ERRORS.includes(code) ? code : 'unknown');
  }

  /** The API's field errors under the sheet's control names. */
  private toControls(errors: FieldErrors): FieldErrors {
    return Object.fromEntries(
      Object.entries(errors).map(([field, code]) => [SERVER_FIELDS[field] ?? field, code]),
    );
  }

  /** Call only on a valid form. */
  private fields(): MeasurementFields {
    const value = this.form.getRawValue();
    return {
      date: isoDate(value.date!),
      weightG: value.weight === null ? null : kgToGrams(value.weight),
      lengthCm: value.length,
      headCircumferenceCm: value.head,
      notes: value.notes.trim() || null,
    };
  }
}
