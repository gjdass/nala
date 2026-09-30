import {
  ChangeDetectionStrategy,
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
import { EntryTimePipe } from '../../../core/time/entry-time';
import { FormRowComponent } from '../form-row/form-row.component';

/** Translation keys of the errors a time row shows, by code (also as `{ server: code }` from the API). */
const ERRORS: Record<string, string> = {
  required: 'entrySheet.required',
  inFuture: 'entrySheet.inFuture',
  afterEnd: 'entrySheet.afterEnd',
};

/**
 * A date-and-time row of an entry sheet (spec 04, e.g. Start time): the value as "Today 2:37 PM",
 * "Yesterday …" or a date, and, once tapped, a datepicker and a timepicker that edit the date and the
 * time of `control` separately. Shows the control's `required` / `inFuture` errors once touched.
 */
@Component({
  selector: 'nala-time-row',
  imports: [
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

  protected readonly open = signal(false);
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
    return ERRORS[code] ?? ERRORS['inFuture'];
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
      if (date && current) {
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

  private change(value: Date): void {
    const control = this.control();
    control.setValue(value);
    control.markAsDirty();
    control.markAsTouched();
  }
}
