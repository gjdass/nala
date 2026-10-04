import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/** A weight typed in kg (up to 3 decimals) as the whole grams the API stores (spec 10). */
export const kgToGrams = (kg: number): number => Math.round(kg * 1000);

/** Grams as kg, for the Measurement sheet's weight field. */
export const gramsToKg = (grams: number): number => grams / 1000;

/** A `yyyy-MM-dd` calendar date as its local midnight. */
export const localDate = (date: string): Date => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** The local calendar day of `date` as `yyyy-MM-dd`. */
export const isoDate = (date: Date): string =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

/**
 * A growth measure in the active language (spec 10): grams as kg with 3 decimals ("4.250 kg"), cm
 * with 1 decimal ("55.5 cm"); FR "4,250 kg" (no-break space before the unit). Empty without a value.
 * Impure to follow language changes.
 */
@Pipe({ name: 'nalaMeasurement', pure: false })
export class MeasurementPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(value: number | null, unit: 'g' | 'cm'): string {
    if (value === null) {
      return '';
    }
    const lang = this.transloco.getActiveLang();
    const digits = unit === 'g' ? 3 : 1;
    const formatted = new Intl.NumberFormat(lang, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(unit === 'g' ? gramsToKg(value) : value);
    return this.transloco.translate(
      `growth.unit.${unit === 'g' ? 'kg' : 'cm'}`,
      { value: formatted },
      lang,
    );
  }
}

/** The measures a summary shows: an entry's, or the baby's birth ones. */
export interface Measures {
  weightG: number | null;
  lengthCm: number | null;
  headCircumferenceCm: number | null;
}

/**
 * A measurement's filled values, joined, in the active language (spec 10): "4.250 kg · 55.5 cm ·
 * Head 38.0 cm", empty ones left out. Impure to follow language changes.
 */
@Pipe({ name: 'nalaMeasurementSummary', pure: false })
export class MeasurementSummaryPipe implements PipeTransform {
  private readonly measurement = new MeasurementPipe();
  private readonly transloco = inject(TranslocoService);

  transform({ weightG, lengthCm, headCircumferenceCm }: Measures): string {
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
