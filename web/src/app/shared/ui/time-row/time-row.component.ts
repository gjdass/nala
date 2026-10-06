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
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { TranslocoPipe } from '@jsverse/transloco';
import { map, startWith, switchMap } from 'rxjs';
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

/**
 * A date-and-time row of an entry sheet (spec 04, e.g. Start time): the value as "Today 2:37 PM",
 * "Yesterday …" or a date, and, once tapped, a datepicker and a timepicker that edit the date and the
 * time of `control` separately. Without a value it offers "Add", and tapping it sets the value to now
 * (e.g. End time). Shows the control's errors once touched (`required`, `afterEnd`,
 * `beforeStart`, `beforeBirth`).
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
    MatInputModule,
    MatTimepickerModule,
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
  protected readonly time = new FormControl<Date | null>(null);

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
      this.date.setValue(value, { emitEvent: false });
      this.time.setValue(value, { emitEvent: false });
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
    this.time.valueChanges.pipe(takeUntilDestroyed(destroyed)).subscribe((time) => {
      const current = this.control().value;
      if (time && current) {
        this.change(
          new Date(
            current.getFullYear(),
            current.getMonth(),
            current.getDate(),
            time.getHours(),
            time.getMinutes(),
          ),
        );
      }
    });
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
