import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { BabyAgePipe } from '../../../core/babies/baby-age.pipe';
import { GrowthEntry } from '../../../core/growth-entries/growth-entry.models';
import { MeasurementPipe, localDate } from '../../../core/growth-entries/measurement';
import { EntryListItemComponent } from '../../../shared/ui/entry-list-item/entry-list-item.component';

/**
 * A growth entry as an entry list item (spec 10), in the Growth card and history: its kind's icon,
 * its date and the baby's age on that date ("Sep 28 · 6 weeks 2 days", no age without `birthDate`),
 * then a measurement's filled values ("4.250 kg · 55.5 cm · Head 38.0 cm") or a milestone's preset
 * label or custom title. Tapping it emits `open`.
 */
@Component({
  selector: 'nala-growth-entry',
  imports: [BabyAgePipe, EntryListItemComponent],
  providers: [MeasurementPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let birth = birthDate();
    <nala-entry-list-item
      [icon]="growthEntry().kind === 'milestone' ? 'celebration' : 'monitor_weight'"
      dateOnly
      [time]="day().toISOString()"
      [label]="birth ? (birth | babyAge: day()) : ''"
      [summary]="summary()"
      (open)="open.emit()"
    />
  `,
})
export class GrowthEntryComponent {
  private readonly measurement = inject(MeasurementPipe);
  private readonly transloco = inject(TranslocoService);

  readonly growthEntry = input.required<GrowthEntry>();
  /** The baby's `yyyy-MM-dd` birth date, for the age on the entry's date. */
  readonly birthDate = input<string | null>(null);
  readonly open = output<void>();

  /** The entry's date at local midnight. */
  protected readonly day = computed(() => localDate(this.growthEntry().date));

  /** A measurement's filled values, joined, or the milestone; re-read on every check to follow the language. */
  protected summary(): string {
    const { weightG, lengthCm, headCircumferenceCm, milestone, title } = this.growthEntry();
    if (milestone) {
      return milestone === 'custom'
        ? (title ?? '')
        : this.transloco.translate(`growth.milestone.${milestone}`);
    }
    const head = this.measurement.transform(headCircumferenceCm, 'cm');
    return [
      this.measurement.transform(weightG, 'g'),
      this.measurement.transform(lengthCm, 'cm'),
      head ? this.transloco.translate('growth.summary.head', { value: head }) : '',
    ]
      .filter((part) => part !== '')
      .join(' · ');
  }
}
