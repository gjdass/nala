import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { HealthEntry } from './health-entry.models';

/**
 * A dose's amount with its unit (spec 09), in the active language: "2.5 ml", FR "2,5 ml"; drops and
 * doses take the singular for exactly 1 ("1 drop", "10 drops"). Empty without an amount. Impure to
 * follow language changes.
 */
@Pipe({ name: 'nalaDose', pure: false })
export class DosePipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform({ amount, unit }: Pick<HealthEntry, 'amount' | 'unit'>): string {
    if (amount === null || unit === null) {
      return '';
    }
    const lang = this.transloco.getActiveLang();
    const singular = amount === 1 && (unit === 'drops' || unit === 'dose');
    return this.transloco.translate(
      `health.dose.${unit}${singular ? '_one' : ''}`,
      { amount: new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(amount) },
      lang,
    );
  }
}
