import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';

/** A range of whole local days, as the datepicker holds them (local midnight). */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * A Material date range field: start and end inputs and a range picker toggle. It shows `start` and
 * `end`, and emits `rangeChange` when the parent changes a date and the range is complete with its
 * start not after its end; an incomplete or reversed range emits nothing.
 */
@Component({
  selector: 'nala-date-range-field',
  imports: [
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './date-range-field.component.html',
  styleUrl: './date-range-field.component.scss',
})
export class DateRangeFieldComponent {
  /** Translation key of the field's label. */
  readonly label = input.required<string>();
  readonly start = input.required<Date>();
  readonly end = input.required<Date>();
  /** The latest day that can be picked. */
  readonly max = input<Date | null>(null);
  readonly rangeChange = output<DateRange>();

  protected readonly form = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  constructor() {
    effect(() => {
      this.form.setValue({ start: this.start(), end: this.end() }, { emitEvent: false });
    });
  }

  /** Emits the range once a date changed, if it is complete and in order. */
  protected changed(): void {
    const { start, end } = this.form.getRawValue();
    if (start && end && start.getTime() <= end.getTime()) {
      this.rangeChange.emit({ start, end });
    }
  }
}
