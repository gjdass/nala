import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { map, startWith } from 'rxjs';
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import {
  BottleDefaults,
  BottleFields,
  Feed,
  MILK_TYPES,
  MilkType,
  NO_BOTTLE_DEFAULTS,
} from '../../../core/feeds/feed.models';
import { FeedService } from '../../../core/feeds/feed.service';
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
import { SuggestionRowComponent } from '../../../shared/ui/suggestion-row/suggestion-row.component';
import { TimeRowComponent } from '../../../shared/ui/time-row/time-row.component';

export const AMOUNT_MIN_ML = 1;
export const AMOUNT_MAX_ML = 500;

const wholeNumber: ValidatorFn = (control) =>
  control.value !== null && !Number.isInteger(control.value) ? { whole: true } : null;

/** Form-level codes with their own message; anything else is "unknown". */
const FORM_ERRORS = ['feedNotFound', 'babyNotFound'];

/**
 * The Bottle Feed sheet (spec 05), adding a bottle for the selected baby or editing the one it was
 * opened with: start time (now by default), milk type (the previous bottle's by default), amount with
 * the "Use last … amount" suggestion while it is empty, and notes. Closes with the saved feed, or the
 * id of the deleted one.
 */
@Component({
  selector: 'nala-bottle-sheet',
  imports: [
    EntryAuditComponent,
    EntrySheetComponent,
    FormRowComponent,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    NotesRowComponent,
    ReactiveFormsModule,
    SuggestionRowComponent,
    TimeRowComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bottle-sheet.component.html',
  styleUrl: './bottle-sheet.component.scss',
})
export class BottleSheetComponent {
  private readonly feeds = inject(FeedService);
  private readonly sheetRef = inject<SheetRef<EntrySheetResult<Feed>>>(SheetRef);
  private readonly store = inject(SelectedBabyService);
  /** Null when adding. */
  protected readonly feed = inject<EntrySheetData<Feed>>(SHEET_DATA).entry;
  /** Kept across attempts, so saving again after a failure can't add the bottle twice. */
  private readonly id = crypto.randomUUID();

  readonly form = new FormGroup({
    startTime: new FormControl<Date | null>(
      this.feed ? new Date(this.feed.startTime) : new Date(),
      [Validators.required, notInFuture()],
    ),
    milkType: new FormControl<MilkType | null>(this.feed?.milkType ?? null, Validators.required),
    amountMl: new FormControl<number | null>(this.feed?.amountMl ?? null, [
      Validators.required,
      Validators.min(AMOUNT_MIN_ML),
      Validators.max(AMOUNT_MAX_ML),
      wholeNumber,
    ]),
    notes: notesControl(this.feed?.notes ?? ''),
  });

  protected readonly milkTypes = MILK_TYPES;
  protected readonly edited = !!this.feed && this.feed.updatedAt !== this.feed.createdAt;
  /** Saving or deleting. */
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  private readonly defaults = signal<BottleDefaults>(NO_BOTTLE_DEFAULTS);

  /** The form's values and the amount's errors, following every change. */
  private readonly state = toSignal(
    this.form.events.pipe(
      startWith(null),
      map(() => ({
        value: this.form.getRawValue(),
        amountErrors: this.form.controls.amountMl.errors,
      })),
    ),
    { requireSync: true },
  );

  /** The last amount of the selected milk type, offered while the amount is empty. */
  protected readonly suggestion = computed(() => {
    const { milkType, amountMl } = this.state().value;
    const amount = milkType && amountMl === null ? this.defaults().lastAmountMl[milkType] : null;
    return milkType && amount !== null ? { milkType, amount } : null;
  });

  protected readonly amountError = computed(() =>
    this.state().amountErrors?.['required'] ? 'amountRequired' : 'amountRange',
  );

  constructor() {
    const babyId = this.feed?.babyId ?? this.store.selected()?.id;
    if (babyId) {
      this.feeds.bottleDefaults(babyId).subscribe((defaults) => {
        this.defaults.set(defaults);
        const milkType = this.form.controls.milkType;
        if (!this.feed && milkType.value === null && milkType.pristine && defaults.milkType) {
          milkType.setValue(defaults.milkType);
        }
      });
    }
  }

  protected useLast(amount: number): void {
    const control = this.form.controls.amountMl;
    control.setValue(amount);
    control.markAsDirty();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    const fields = this.fields();
    const request = this.feed
      ? this.feeds.updateBottle(this.feed.id, fields)
      : this.feeds.createBottle(this.store.selected()!.id, fields, this.id);
    request.subscribe((result) => {
      this.saving.set(false);
      if (result.ok) {
        this.sheetRef.close({ saved: result.feed });
        return;
      }
      const { form, ...fieldErrors } = result.errors;
      for (const [field, code] of Object.entries(fieldErrors)) {
        const control = this.form.get(field);
        control?.setErrors({ server: code });
        control?.markAsTouched();
      }
      if (form || Object.keys(fieldErrors).length === 0) {
        this.showFormError(form);
      }
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
        this.showFormError(result.errors['form']);
      }
    });
  }

  private showFormError(code: string | undefined): void {
    this.formError.set(code && FORM_ERRORS.includes(code) ? code : 'unknown');
  }

  /** Call only on a valid form. */
  private fields(): BottleFields {
    const value = this.form.getRawValue();
    return {
      startTime: value.startTime!.toISOString(),
      milkType: value.milkType!,
      amountMl: value.amountMl!,
      notes: value.notes.trim() || null,
    };
  }
}
