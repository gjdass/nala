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
import { DosePipe } from '../../../core/health-entries/dose';
import {
  DOSE_UNITS,
  HealthEntry,
  HealthEntryFields,
  DoseUnit,
  RecentMedicine,
} from '../../../core/health-entries/health-entry.models';
import { HealthEntryService } from '../../../core/health-entries/health-entry.service';
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
import { SuggestionRowComponent } from '../../../shared/ui/suggestion-row/suggestion-row.component';
import { TimeRowComponent } from '../../../shared/ui/time-row/time-row.component';

export const NAME_MAX_LENGTH = 100;
const AMOUNT_MIN = 0.01;
const AMOUNT_MAX = 1000;
const TEMPERATURE_MIN = 30;
const TEMPERATURE_MAX = 45;

const isBlank = (value: string | null | undefined) => !value?.trim();

/**
 * The name is at most 100 characters once trimmed (as the API counts them), and required without a
 * temperature.
 */
const name: ValidatorFn = (control) => {
  const length = (control.value as string).trim().length;
  if (length === 0) {
    return control.parent?.get('temperature')?.value == null ? { required: true } : null;
  }
  return length > NAME_MAX_LENGTH ? { maxlength: true } : null;
};

/** An amount needs a name. */
const nameForAmount: ValidatorFn = (control) =>
  control.value !== null && isBlank(control.parent?.get('name')?.value)
    ? { nameRequired: true }
    : null;

/** At most `digits` decimals. */
const decimals =
  (digits: number): ValidatorFn =>
  (control) => {
    const value = control.value as number | null;
    const factor = 10 ** digits;
    return value === null || Math.round(value * factor) / factor === value
      ? null
      : { decimals: true };
  };

/** An amount needs a unit. */
const unitWithAmount: ValidatorFn = (group) => {
  const { amount, unit } = (group as FormGroup).getRawValue() as {
    amount: number | null;
    unit: DoseUnit | null;
  };
  return amount !== null && unit === null ? { unitRequired: true } : null;
};

/** Form-level codes with their own message; anything else is "unknown". */
const FORM_ERRORS = ['healthEntryNotFound', 'babyNotFound'];

/** Names are matched trimmed and whatever their case (spec 09). */
const nameKey = (name: string) => name.trim().toLowerCase();

/**
 * The Health sheet (spec 09), adding an entry for the selected baby or editing the one it was
 * opened with: time (now by default), name with the baby's recent names as chips, dose (an optional
 * amount, 0.01 to 1000 with at most 2 decimals, only with a name, and its unit chips, required with an
 * amount) with "Use last dose" while the amount is empty and the name is a recent one, temperature
 * (optional, 30 to 45 °C with at most 1 decimal), and notes; a name or a temperature is required. No
 * timer: Save is the only action, and × discards the form. Without an amount the unit is saved as
 * null, and a blank name as null. Closes with the saved entry, or the id of the deleted one; offline,
 * with `queued` once the change is kept on the device. Never suggests or warns about a dose nor
 * interprets a temperature (spec 09).
 */
@Component({
  selector: 'nala-health-sheet',
  imports: [
    ChipChoiceRowComponent,
    EntryAuditComponent,
    EntrySheetComponent,
    FormRowComponent,
    MatFormFieldModule,
    MatInputModule,
    DosePipe,
    NotesRowComponent,
    ReactiveFormsModule,
    SuggestionRowComponent,
    TimeRowComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './health-sheet.component.html',
  styleUrl: './health-sheet.component.scss',
})
export class HealthSheetComponent {
  private readonly healthEntries = inject(HealthEntryService);
  private readonly sheetRef = inject<SheetRef<EntrySheetResult<HealthEntry>>>(SheetRef);
  private readonly store = inject(SelectedBabyService);
  private readonly transloco = inject(TranslocoService);
  /** Null when adding. */
  protected readonly healthEntry = inject<EntrySheetData<HealthEntry>>(SHEET_DATA).entry;
  /** Kept across attempts, so saving again after a failure can't add the dose twice. */
  private readonly id = crypto.randomUUID();

  readonly form = new FormGroup(
    {
      time: new FormControl<Date | null>(
        this.healthEntry ? new Date(this.healthEntry.time) : new Date(),
        [Validators.required, notInFuture()],
      ),
      name: new FormControl(this.healthEntry?.name ?? '', { nonNullable: true, validators: name }),
      amount: new FormControl<number | null>(this.healthEntry?.amount ?? null, [
        Validators.min(AMOUNT_MIN),
        Validators.max(AMOUNT_MAX),
        decimals(2),
        nameForAmount,
      ]),
      unit: new FormControl<DoseUnit | null>(this.healthEntry?.unit ?? null),
      temperature: new FormControl<number | null>(this.healthEntry?.temperature ?? null, [
        Validators.min(TEMPERATURE_MIN),
        Validators.max(TEMPERATURE_MAX),
        decimals(1),
      ]),
      notes: notesControl(this.healthEntry?.notes ?? ''),
    },
    { validators: unitWithAmount },
  );

  protected readonly nameMaxLength = NAME_MAX_LENGTH;
  protected readonly units = DOSE_UNITS;
  protected readonly temperatureMin = TEMPERATURE_MIN;
  protected readonly temperatureMax = TEMPERATURE_MAX;
  protected readonly edited =
    !!this.healthEntry && this.healthEntry.updatedAt !== this.healthEntry.createdAt;
  /** Saving or deleting. */
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  /** The baby's recently given names with their last dose; none until loaded, offline or on error. */
  private readonly recent = signal<RecentMedicine[]>([]);
  protected readonly recentNames = computed(() => this.recent().map((r) => r.name));
  /**
   * The recent-name chips: the chip matching the name is selected; tapping another one fills the name.
   * Outside the form, so it is never saved.
   */
  protected readonly recentName = new FormControl<string | null>(null);

  /** The name and amount, and the errors shown under the fields, following every change. */
  private readonly state = toSignal(
    this.form.events.pipe(
      startWith(null),
      map(() => ({
        nameValue: this.form.controls.name.value,
        amountValue: this.form.controls.amount.value,
        name: this.form.controls.name.errors,
        amount: this.form.controls.amount.errors,
        temperature: this.form.controls.temperature.errors,
        unitRequired: this.form.hasError('unitRequired'),
      })),
    ),
    { requireSync: true },
  );

  /** The last dose of the recent name typed, offered while the amount is empty; none without an amount. */
  protected readonly suggestion = computed(() => {
    const { nameValue, amountValue } = this.state();
    const last = amountValue === null ? this.match(nameValue) : null;
    return last?.amount != null && last.unit !== null ? last : null;
  });

  protected readonly nameError = computed(() =>
    this.state().name?.['maxlength'] ? 'nameTooLong' : 'nameOrTemperature',
  );
  protected readonly amountError = computed(() => {
    const errors = this.state().amount;
    if (errors?.['decimals']) {
      return 'amountDecimals';
    }
    return errors?.['nameRequired'] && !errors['min'] && !errors['max']
      ? 'amountNameRequired'
      : 'amountRange';
  });
  protected readonly temperatureError = computed(() =>
    this.state().temperature?.['decimals'] ? 'temperatureDecimals' : 'temperatureRange',
  );
  protected readonly unitError = computed(() =>
    this.state().unitRequired ? this.transloco.translate('health.errors.unitRequired') : null,
  );

  constructor() {
    // The name and the amount depend on each other and on the temperature (validated once the form
    // exists, then on every change of the field they depend on).
    const controls = this.form.controls;
    controls.temperature.valueChanges.subscribe(() => controls.name.updateValueAndValidity());
    controls.name.valueChanges.subscribe(() => controls.amount.updateValueAndValidity());
    controls.name.updateValueAndValidity();
    const babyId = this.healthEntry?.babyId ?? this.store.selected()?.id;
    if (babyId) {
      this.healthEntries.recent(babyId).subscribe((recent) => {
        this.recent.set(recent);
        this.syncRecentName();
      });
    }
    this.form.controls.name.valueChanges.subscribe(() => this.syncRecentName());
    this.recentName.valueChanges.subscribe((chosen) => {
      if (chosen !== null && chosen !== this.match(this.form.controls.name.value)?.name) {
        const name = this.form.controls.name;
        name.setValue(chosen);
        name.markAsDirty();
        name.markAsTouched();
      }
    });
  }

  protected useLast({ amount, unit }: RecentMedicine): void {
    this.form.controls.amount.setValue(amount);
    this.form.controls.unit.setValue(unit);
    this.form.controls.amount.markAsDirty();
    this.form.controls.unit.markAsDirty();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    const fields = this.fields();
    const request = this.healthEntry
      ? this.healthEntries.update(this.healthEntry.id, fields)
      : this.healthEntries.create(this.store.selected()!.id, fields, this.id);
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
    const healthEntry = this.healthEntry!;
    this.saving.set(true);
    this.formError.set(null);
    this.healthEntries.delete(healthEntry.id).subscribe((result) => {
      this.saving.set(false);
      if (result.ok) {
        this.sheetRef.close(result.queued ? { queued: true } : { deleted: healthEntry.id });
      } else {
        this.showFormError(result.errors['form'] ?? 'unknown');
      }
    });
  }

  private showFormError(code: string | null): void {
    this.formError.set(code === null ? null : FORM_ERRORS.includes(code) ? code : 'unknown');
  }

  private match(name: string): RecentMedicine | undefined {
    const key = nameKey(name);
    return key ? this.recent().find((r) => nameKey(r.name) === key) : undefined;
  }

  /** Selects the chip of the recent name typed, if any. */
  private syncRecentName(): void {
    const matched = this.match(this.form.controls.name.value)?.name ?? null;
    if (this.recentName.value !== matched) {
      this.recentName.setValue(matched);
    }
  }

  /** Call only on a valid form. */
  private fields(): HealthEntryFields {
    const value = this.form.getRawValue();
    return {
      time: value.time!.toISOString(),
      name: value.name.trim() || null,
      amount: value.amount,
      unit: value.amount === null ? null : value.unit,
      temperature: value.temperature,
      notes: value.notes.trim() || null,
    };
  }
}
