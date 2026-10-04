import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Baby } from '../../../core/babies/baby.models';
import { MeasurementSummaryPipe, localDate } from '../../../core/growth-entries/measurement';
import { EntryListItemComponent } from '../../../shared/ui/entry-list-item/entry-list-item.component';

/**
 * The Birth item ending the Growth history (spec 10): the baby's birth date · "Birth", then the
 * birth measurements of the profile as a measurement ("3.400 kg · 50.5 cm · Head 35.0 cm"). Tapping
 * it emits `open`.
 */
@Component({
  selector: 'nala-growth-birth',
  imports: [EntryListItemComponent, MeasurementSummaryPipe, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let born = baby();
    <nala-entry-list-item
      icon="monitor_weight"
      dateOnly
      [time]="day().toISOString()"
      [label]="'growth.card.birth' | transloco"
      [summary]="
        {
          weightG: born.birthWeightG,
          lengthCm: born.birthLengthCm,
          headCircumferenceCm: born.birthHeadCircumferenceCm,
        } | nalaMeasurementSummary
      "
      (open)="open.emit()"
    />
  `,
})
export class GrowthBirthComponent {
  readonly baby = input.required<Baby>();
  readonly open = output<void>();

  /** The birth date at local midnight. */
  protected readonly day = computed(() => localDate(this.baby().birthDate));
}
