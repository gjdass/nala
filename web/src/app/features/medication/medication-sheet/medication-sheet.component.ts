import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { map, startWith } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { applyServerErrors } from '../../../core/http/apply-server-errors';
import {
  MEDICATION_UNITS,
  Medication,
  MedicationFields,
  MedicationUnit,
} from '../../../core/medications/medication.models';
import { MedicationService } from '../../../core/medications/medication.service';
import { notInFuture } from '../../../core/time/not-in-future';
import { ChipChoiceRowComponent } from '../../../shared/ui/chip-choice-row/chip-choice-row.component';
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

export const NAME_MAX_LENGTH = 100;
const AMOUNT_MIN = 0.01;
const AMOUNT_MAX = 1000;

/** The name is required and at most 100 characters, both once trimmed (as the API counts them). */
const name: ValidatorFn = (control) => {
  const length = (control.value as string).trim().length;
  if (length === 0) {
    return { required: true };
  }
  return length > NAME_MAX_LENGTH ? { maxlength: true } : null;
};

/** At most 2 decimals. */
const twoDecimals: ValidatorFn = (control) => {
  const value = control.value as number | null;
  return value === null || Math.round(value * 100) / 100 === value ? null : { decimals: true };
};

/** An amount needs a unit. */
const unitWithAmount: ValidatorFn = (group) => {
  const { amount, unit } = (group as FormGroup).getRawValue() as {
    amount: number | null;
    unit: MedicationUnit | null;
  };
  return amount !== null && unit === null ? { unitRequired: true } : null;
};

/** Form-level codes with their own message; anything else is "unknown". */
const FORM_ERRORS = ['medicationNotFound', 'babyNotFound'];

/**
 * The Medication sheet (spec 09), adding a dose for the selected baby or editing the one it was
 * opened with: time (now by default), name (required), dose (an optional amount, 0.01 to 1000 with
 * at most 2 decimals, and its unit chips, required with an amount), and notes. No timer: Save is the
 * only action, and × discards the form. Without an amount the unit is saved as null. Closes with the
 * saved dose, or the id of the deleted one; offline, with `queued` once the change is kept on the
 * device. Never suggests or warns about a dose (spec 09).
 */
@Component({
  selector: 'nala-medication-sheet',
  imports: [
    ChipChoiceRowComponent,
    EntryAuditComponent,
    EntrySheetComponent,
    FormRowComponent,
    MatFormFieldModule,
    MatInputModule,
    NotesRowComponent,
    ReactiveFormsModule,
    TimeRowComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './medication-sheet.component.html',
  styleUrl: './medication-sheet.component.scss',
})
export class MedicationSheetComponent {
  private readonly medications = inject(MedicationService);
  private readonly sheetRef = inject<SheetRef<EntrySheetResult<Medication>>>(SheetRef);
  private readonly store = inject(SelectedBabyService);
  private readonly transloco = inject(TranslocoService);
  /** Null when adding. */
  protected readonly medication = inject<EntrySheetData<Medication>>(SHEET_DATA).entry;
  /** Kept across attempts, so saving again after a failure can't add the dose twice. */
  private readonly id = crypto.randomUUID();

  readonly form = new FormGroup(
    {
      time: new FormControl<Date | null>(
        this.medication ? new Date(this.medication.time) : new Date(),
        [Validators.required, notInFuture()],
      ),
      name: new FormControl(this.medication?.name ?? '', { nonNullable: true, validators: name }),
      amount: new FormControl<number | null>(this.medication?.amount ?? null, [
        Validators.min(AMOUNT_MIN),
        Validators.max(AMOUNT_MAX),
        twoDecimals,
      ]),
      unit: new FormControl<MedicationUnit | null>(this.medication?.unit ?? null),
      notes: notesControl(this.medication?.notes ?? ''),
    },
    { validators: unitWithAmount },
  );

  protected readonly nameMaxLength = NAME_MAX_LENGTH;
  protected readonly units = MEDICATION_UNITS;
  protected readonly edited =
    !!this.medication && this.medication.updatedAt !== this.medication.createdAt;
  /** Saving or deleting. */
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  /** The errors shown under the fields, following every change. */
  private readonly errors = toSignal(
    this.form.events.pipe(
      startWith(null),
      map(() => ({
        name: this.form.controls.name.errors,
        amount: this.form.controls.amount.errors,
        unitRequired: this.form.hasError('unitRequired'),
      })),
    ),
    { requireSync: true },
  );

  protected readonly nameError = computed(() =>
    this.errors().name?.['maxlength'] ? 'nameTooLong' : 'nameRequired',
  );
  protected readonly amountError = computed(() =>
    this.errors().amount?.['decimals'] ? 'amountDecimals' : 'amountRange',
  );
  protected readonly unitError = computed(() =>
    this.errors().unitRequired ? this.transloco.translate('medication.errors.unitRequired') : null,
  );

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    const fields = this.fields();
    const request = this.medication
      ? this.medications.update(this.medication.id, fields)
      : this.medications.create(this.store.selected()!.id, fields, this.id);
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
    const medication = this.medication!;
    this.saving.set(true);
    this.formError.set(null);
    this.medications.delete(medication.id).subscribe((result) => {
      this.saving.set(false);
      if (result.ok) {
        this.sheetRef.close(result.queued ? { queued: true } : { deleted: medication.id });
      } else {
        this.showFormError(result.errors['form'] ?? 'unknown');
      }
    });
  }

  private showFormError(code: string | null): void {
    this.formError.set(code === null ? null : FORM_ERRORS.includes(code) ? code : 'unknown');
  }

  /** Call only on a valid form. */
  private fields(): MedicationFields {
    const value = this.form.getRawValue();
    return {
      time: value.time!.toISOString(),
      name: value.name.trim(),
      amount: value.amount,
      unit: value.amount === null ? null : value.unit,
      notes: value.notes.trim() || null,
    };
  }
}
