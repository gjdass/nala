import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/**
 * A temperature in degrees Celsius (spec 09), in the active language and always with one decimal:
 * "38.5 °C", "38.0 °C", FR "38,5 °C" (no-break space before °C). Empty without a temperature.
 * Impure to follow language changes.
 */
@Pipe({ name: 'nalaTemperature', pure: false })
export class TemperaturePipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(temperature: number | null): string {
    if (temperature === null) {
      return '';
    }
    const lang = this.transloco.getActiveLang();
    const value = new Intl.NumberFormat(lang, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(temperature);
    return this.transloco.translate('health.temperature', { value }, lang);
  }
}
