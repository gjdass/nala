import { CdkTextareaAutosize } from '@angular/cdk/text-field';
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
import {
  Feed,
  MEAL_TYPES,
  MealType,
  SOLIDS_REACTIONS,
  SolidsFields,
  SolidsReaction,
} from '../../../core/feeds/feed.models';
import { FeedService } from '../../../core/feeds/feed.service';
import { applyServerErrors } from '../../../core/http/apply-server-errors';
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

export const FOOD_MAX_LENGTH = 500;

/** Food is required and at most 500 characters, both once trimmed (as the API counts them). */
const food: ValidatorFn = (control) => {
  const length = (control.value as string).trim().length;
  if (length === 0) {
    return { required: true };
  }
  return length > FOOD_MAX_LENGTH ? { maxlength: true } : null;
};

/** Form-level codes with their own message; anything else is "unknown". */
const FORM_ERRORS = ['feedNotFound', 'babyNotFound'];

/**
 * The Solids sheet (spec 05), adding solids for the selected baby or editing the ones it was opened
 * with: meal type chips at the top (optional), start time (now by default), food (multi-line, required),
 * reaction chips (optional) and notes. Closes with the saved feed, or the id of the deleted one.
 */
@Component({
  selector: 'nala-solids-sheet',
  imports: [
    CdkTextareaAutosize,
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
  templateUrl: './solids-sheet.component.html',
  styleUrl: './solids-sheet.component.scss',
})
export class SolidsSheetComponent {
  private readonly feeds = inject(FeedService);
  private readonly sheetRef = inject<SheetRef<EntrySheetResult<Feed>>>(SheetRef);
  private readonly store = inject(SelectedBabyService);
  /** Null when adding. */
  protected readonly feed = inject<EntrySheetData<Feed>>(SHEET_DATA).entry;
  /** Kept across attempts, so saving again after a failure can't add the solids twice. */
  private readonly id = crypto.randomUUID();

  readonly form = new FormGroup({
    mealType: new FormControl<MealType | null>(this.feed?.mealType ?? null),
    startTime: new FormControl<Date | null>(
      this.feed ? new Date(this.feed.startTime) : new Date(),
      [Validators.required, notInFuture()],
    ),
    food: new FormControl(this.feed?.food ?? '', { nonNullable: true, validators: food }),
    reaction: new FormControl<SolidsReaction | null>(this.feed?.reaction ?? null),
    notes: notesControl(this.feed?.notes ?? ''),
  });

  protected readonly mealTypes = MEAL_TYPES;
  protected readonly reactions = SOLIDS_REACTIONS;
  protected readonly foodMaxLength = FOOD_MAX_LENGTH;
  protected readonly edited = !!this.feed && this.feed.updatedAt !== this.feed.createdAt;
  /** Saving or deleting. */
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  private readonly foodErrors = toSignal(
    this.form.events.pipe(
      startWith(null),
      map(() => this.form.controls.food.errors),
    ),
    { requireSync: true },
  );

  protected readonly foodError = computed(() => {
    const errors = this.foodErrors();
    return errors?.['required'] || errors?.['server'] === 'required'
      ? 'foodRequired'
      : 'foodTooLong';
  });

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    const fields = this.fields();
    const request = this.feed
      ? this.feeds.update(this.feed.id, fields)
      : this.feeds.create(this.store.selected()!.id, 'solids', fields, this.id);
    request.subscribe((result) => {
      this.saving.set(false);
      if (result.ok) {
        this.sheetRef.close({ saved: result.feed });
        return;
      }
      this.showFormError(applyServerErrors(this.form, result.errors));
    });
  }

  protected delete(): void {
    const feed = this.feed!;
    this.saving.set(true);
    this.formError.set(null);
    this.feeds.delete(feed.id).subscribe((result) => {
      this.saving.set(false);
      if (result.ok) {
        this.sheetRef.close({ deleted: feed.id });
      } else {
        this.showFormError(result.errors['form'] ?? 'unknown');
      }
    });
  }

  private showFormError(code: string | null): void {
    this.formError.set(code === null ? null : FORM_ERRORS.includes(code) ? code : 'unknown');
  }

  /** Call only on a valid form. */
  private fields(): SolidsFields {
    const value = this.form.getRawValue();
    return {
      startTime: value.startTime!.toISOString(),
      mealType: value.mealType,
      food: value.food.trim(),
      reaction: value.reaction,
      notes: value.notes.trim() || null,
    };
  }
}
