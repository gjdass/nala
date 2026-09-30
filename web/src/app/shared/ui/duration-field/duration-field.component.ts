import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { map, startWith, switchMap } from 'rxjs';

/** The longest duration that can be typed: 4 h (spec 05). */
export const DURATION_MAX_SECONDS = 4 * 60 * 60;

const MAX_MINUTES = DURATION_MAX_SECONDS / 60;

export type DurationGroup = FormGroup<{
  minutes: FormControl<number | null>;
  seconds: FormControl<number | null>;
}>;

/** The typed duration in seconds; an empty part counts as 0. Call only on a valid group. */
export function durationSeconds(group: DurationGroup): number {
  const { minutes, seconds } = group.getRawValue();
  return (minutes ?? 0) * 60 + (seconds ?? 0);
}

const notTooLong = (group: AbstractControl): ValidationErrors | null =>
  durationSeconds(group as DurationGroup) > DURATION_MAX_SECONDS ? { tooLong: true } : null;

const part = (value: number, max: number) =>
  new FormControl<number | null>(value, [
    Validators.min(0),
    Validators.max(max),
    Validators.pattern(/^\d+$/),
  ]);

/** The controls of a duration field holding `seconds`: minutes 0–240, seconds 0–59, 4 h at most. */
export function durationGroup(seconds = 0): DurationGroup {
  const whole = Math.max(0, Math.floor(seconds));
  return new FormGroup(
    { minutes: part(Math.floor(whole / 60), MAX_MINUTES), seconds: part(whole % 60, 59) },
    { validators: notTooLong },
  );
}

/**
 * A duration typed as minutes and seconds, side by side (spec 04 "duration field"; used by the
 * Breastfeed pencils, later by Sleep and Pump). Bound to a `durationGroup()`.
 */
@Component({
  selector: 'nala-duration-field',
  imports: [MatFormFieldModule, MatInputModule, ReactiveFormsModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './duration-field.component.html',
  styleUrl: './duration-field.component.scss',
})
export class DurationFieldComponent {
  readonly group = input.required<DurationGroup>();

  private readonly status = toSignal(
    toObservable(this.group).pipe(
      switchMap((group) =>
        group.events.pipe(
          startWith(null),
          map(() => group.errors),
        ),
      ),
    ),
  );
  protected readonly tooLong = computed(() => !!this.status()?.['tooLong']);
}
