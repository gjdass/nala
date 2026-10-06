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
import { TranslocoPipe } from '@jsverse/transloco';
import { map, startWith } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { notBeforeBirth, today } from '../../../core/growth-entries/growth-date';
import {
  GrowthEntry,
  MILESTONES,
  Milestone,
  MilestoneFields,
  TITLE_MAX_LENGTH,
} from '../../../core/growth-entries/growth-entry.models';
import { GrowthEntryService } from '../../../core/growth-entries/growth-entry.service';
import { isoDate, localDate } from '../../../core/growth-entries/measurement';
import { applyServerErrors } from '../../../core/http/apply-server-errors';
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

/** A custom title: not blank, at most 100 characters once trimmed. */
const titleValidator: ValidatorFn = (control) => {
  const title = ((control.value as string | null) ?? '').trim();
  if (!title) {
    return { required: true };
  }
  return title.length > TITLE_MAX_LENGTH ? { maxlength: true } : null;
};

/** Form-level codes with their own message; anything else is "unknown". */
const FORM_ERRORS = ['growthEntryNotFound', 'babyNotFound'];

/**
 * The Milestone sheet (spec 10), adding a milestone for the selected baby or editing the one it was
 * opened with: the milestone (one of the preset chips, or Other with its own title, 1 to 100
 * characters), the date (today by default, without a time, not before the baby's
 * birth date) and notes. The title only shows, and only counts, while Other is chosen: a preset is
 * saved without it, though what was typed stays while the sheet is open. No timer: Save is the only
 * action, and × discards the form. Closes with the saved entry, or the id of the deleted one;
 * offline, with `queued` once the change is kept on the device.
 */
@Component({
  selector: 'nala-milestone-sheet',
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
  templateUrl: './milestone-sheet.component.html',
  styleUrl: './milestone-sheet.component.scss',
})
export class MilestoneSheetComponent {
  private readonly growthEntries = inject(GrowthEntryService);
  private readonly sheetRef = inject<SheetRef<EntrySheetResult<GrowthEntry>>>(SheetRef);
  private readonly store = inject(SelectedBabyService);
  /** Null when adding. */
  protected readonly growthEntry = inject<EntrySheetData<GrowthEntry>>(SHEET_DATA).entry;
  /** Kept across attempts, so saving again after a failure can't add the entry twice. */
  private readonly id = crypto.randomUUID();

  readonly form = new FormGroup({
    milestone: new FormControl<Milestone | null>(this.growthEntry?.milestone ?? null, [
      Validators.required,
    ]),
    // Disabled, so not validated, unless the milestone is custom.
    title: new FormControl(this.growthEntry?.title ?? '', {
      nonNullable: true,
      validators: [titleValidator],
    }),
    date: new FormControl<Date | null>(
      this.growthEntry ? localDate(this.growthEntry.date) : today(),
      [Validators.required, notBeforeBirth(() => this.store.selected()?.birthDate ?? null)],
    ),
    notes: notesControl(this.growthEntry?.notes ?? ''),
  });

  protected readonly milestones = MILESTONES;
  protected readonly titleMaxLength = TITLE_MAX_LENGTH;
  protected readonly edited =
    !!this.growthEntry && this.growthEntry.updatedAt !== this.growthEntry.createdAt;
  /** Saving or deleting. */
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  private readonly milestone = toSignal(
    this.form.controls.milestone.valueChanges.pipe(
      startWith(this.form.controls.milestone.value),
    ),
    { requireSync: true },
  );
  protected readonly custom = computed(() => this.milestone() === 'custom');
  private readonly titleErrors = toSignal(
    this.form.events.pipe(
      startWith(null),
      map(() => this.form.controls.title.errors),
    ),
    { requireSync: true },
  );
  protected readonly titleError = computed(() => {
    const errors = this.titleErrors();
    return errors?.['maxlength'] || errors?.['server'] === 'tooLong'
      ? 'titleTooLong'
      : 'titleRequired';
  });

  constructor() {
    const { milestone, title } = this.form.controls;
    const followMilestone = (value: Milestone | null) =>
      value === 'custom' ? title.enable() : title.disable();
    followMilestone(milestone.value);
    milestone.valueChanges.subscribe(followMilestone);
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    const fields = this.fields();
    const request = this.growthEntry
      ? this.growthEntries.update(this.growthEntry.id, fields)
      : this.growthEntries.create(this.store.selected()!.id, 'milestone', fields, this.id);
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

  /** Call only on a valid form. */
  private fields(): MilestoneFields {
    const value = this.form.getRawValue();
    return {
      date: isoDate(value.date!),
      milestone: value.milestone!,
      title: value.milestone === 'custom' ? value.title.trim() : null,
      notes: value.notes.trim() || null,
    };
  }
}
