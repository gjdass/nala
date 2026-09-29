import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/** An ISO date-time in the given language, e.g. "Sep 20, 2026, 10:30 AM" (in the device's time zone). */
export function formatDateTime(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

/** `formatDateTime` in the language the app shows; impure so it follows a language change. */
@Pipe({ name: 'nalaDateTime', pure: false })
export class DateTimePipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(iso: string): string {
    return formatDateTime(iso, this.transloco.getActiveLang());
  }
}
