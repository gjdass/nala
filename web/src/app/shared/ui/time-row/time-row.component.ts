import {
  ChangeDetectionStrategy,
  booleanAttribute,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { map, merge, startWith, switchMap } from 'rxjs';
import { SECTION_SCHEME } from '../../../core/sections/section-scheme';
import { EntryDatePipe, EntryTimePipe } from '../../../core/time/entry-time';
import { FormRowComponent } from '../form-row/form-row.component';

/** Translation keys of the errors a time row shows, by code (also as `{ server: code }` from the API). */
const ERRORS: Record<string, string> = {
  required: 'entrySheet.required',
  afterEnd: 'entrySheet.afterEnd',
  beforeStart: 'entrySheet.beforeStart',
  beforeBirth: 'entrySheet.beforeBirth',
};

type Period = 'am' | 'pm';

/** Whether `lang` writes times on 12 hours with AM / PM (English) rather than 24 (French). */
const usesTwelveHours = (lang: string) =>
  new Intl.DateTimeFormat(lang, { hour: 'numeric' }).resolvedOptions().hour12 === true;

/** The rules of a part of the time typed with the numeric keypad: one or two digits, `min` to `max`. */
const timePart = (min: number, max: number) => [
  Validators.required,
  Validators.pattern(/^\d{1,2}$/),
  Validators.min(min),
  Validators.max(max),
];

/**
 * A date-and-time row of an entry sheet (spec 04, e.g. Start time): the value as "Today 2:37 PM",
 * "Yesterday …" or a date, and, once tapped, a datepicker for the date and an hour field and a minute
 * field for the time, typed with the numeric keypad, exact to the minute: 1–12 with AM / PM in a
 * language written on 12 hours (English), 0–23 otherwise (French). A part that isn't a valid number
 * shows its error and leaves the value as it was. Without a value it offers "Add", and tapping it
 * sets the value to now (e.g. End time). Shows the control's errors once touched (`required`,
 * `afterEnd`, `beforeStart`, `beforeBirth`).
 *
 * With `dateOnly` (entries dated without a time, spec 10), the value reads "Today", "Yesterday" or a
 * date, only the datepicker is offered, and the value is the picked day at local midnight ("Add" sets
 * today).
 */
@Component({
  selector: 'nala-time-row',
  imports: [
    EntryDatePipe,
    EntryTimePipe,
    FormRowComponent,
    MatDatepickerModule,
    MatFormFieldModule,
    MatButtonToggleModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './time-row.component.html',
  styleUrl: './time-row.component.scss',
})
export class TimeRowComponent {
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<Date | null>>();
  readonly dateOnly = input(false, { transform: booleanAttribute });

  protected readonly open = signal(false);
  /** The pickers open in the colour scheme of the section the row sits in. */
  protected readonly scheme = inject(SECTION_SCHEME, { optional: true }) ?? undefined;
  protected readonly date = new FormControl<Date | null>(null);
  private readonly transloco = inject(TranslocoService);
  protected readonly twelveHours = toSignal(
    this.transloco.langChanges$.pipe(map(usesTwelveHours)),
    { initialValue: usesTwelveHours(this.transloco.getActiveLang()) },
  );
  protected readonly hour = new FormControl('', { nonNullable: true });
  protected readonly minute = new FormControl('', {
    nonNullable: true,
    validators: timePart(0, 59),
  });
  protected readonly period = new FormControl<Period>('am', { nonNullable: true });

  /** The control's value, errors and touched state, following every change to it. */
  private readonly state = toSignal(
    toObservable(this.control).pipe(
      switchMap((control) =>
        control.events.pipe(
          startWith(null),
          map(() => ({ value: control.value, errors: control.errors, touched: control.touched })),
        ),
      ),
    ),
  );
  protected readonly iso = computed(() => this.state()?.value?.toISOString() ?? null);
  protected readonly errorKey = computed(() => {
    const state = this.state();
    if (!state?.touched || !state.errors) {
      return null;
    }
    const code = (state.errors['server'] as string | undefined) ?? Object.keys(state.errors)[0];
    return ERRORS[code] ?? ERRORS['required'];
  });

  constructor() {
    effect(() => {
      const value = this.state()?.value ?? null;
      const twelveHours = this.twelveHours();
      this.hour.setValidators(twelveHours ? timePart(1, 12) : timePart(0, 23));
      this.hour.updateValueAndValidity({ emitEvent: false });
      this.date.setValue(value, { emitEvent: false });
      if (value) {
        this.showTime(value, twelveHours);
      }
    });
    const destroyed = inject(DestroyRef);
    this.date.valueChanges.pipe(takeUntilDestroyed(destroyed)).subscribe((date) => {
      const current = this.control().value;
      if (date && this.dateOnly()) {
        this.change(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
      } else if (date && current) {
        this.change(
          new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            current.getHours(),
            current.getMinutes(),
          ),
        );
      }
    });
    merge(this.hour.valueChanges, this.minute.valueChanges, this.period.valueChanges)
      .pipe(takeUntilDestroyed(destroyed))
      .subscribe(() => this.typedTime());
  }

  /** A focused field is selected, so typing replaces it. */
  protected selectAll(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  /** Shows `value`'s time in the fields, unless they already read it (e.g. "08" typed for 8). */
  private showTime(value: Date, twelveHours: boolean): void {
    const hours = value.getHours();
    const hour = twelveHours ? hours % 12 || 12 : hours;
    if (this.hour.invalid || Number(this.hour.value) !== hour) {
      this.hour.setValue(String(hour), { emitEvent: false });
    }
    if (this.minute.invalid || Number(this.minute.value) !== value.getMinutes()) {
      this.minute.setValue(String(value.getMinutes()).padStart(2, '0'), { emitEvent: false });
    }
    this.period.setValue(hours < 12 ? 'am' : 'pm', { emitEvent: false });
  }

  /** The hour, minute and AM / PM typed, once all valid, on the control's day. */
  private typedTime(): void {
    const current = this.control().value;
    this.hour.markAsTouched();
    this.minute.markAsTouched();
    if (!current || this.hour.invalid || this.minute.invalid) {
      return;
    }
    const typed = Number(this.hour.value);
    const hours = !this.twelveHours()
      ? typed
      : (typed % 12) + (this.period.value === 'pm' ? 12 : 0);
    this.change(
      new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate(),
        hours,
        Number(this.minute.value),
      ),
    );
  }

  /** Opens or closes the pickers; a row without a value starts from now (today with `dateOnly`). */
  protected toggle(): void {
    if (this.control().value === null) {
      const now = new Date();
      this.change(
        this.dateOnly() ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : now,
      );
    }
    this.open.set(!this.open());
  }

  private change(value: Date): void {
    const control = this.control();
    control.setValue(value);
    control.markAsDirty();
    control.markAsTouched();
  }
}
