import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { NowService } from './now.service';

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * When an entry happened, in the device's time zone and the active language (spec 04): the time
 * today ("2:10 PM"), "Yesterday 2:10 PM", then the date and time, with the year when it isn't this one.
 * Impure: it follows the language and the shared clock (today becomes yesterday at midnight).
 */
@Pipe({ name: 'nalaEntryTime', pure: false })
export class EntryTimePipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);
  private readonly clock = inject(NowService);

  transform(iso: string): string {
    const lang = this.transloco.getActiveLang();
    const date = new Date(iso);
    const now = new Date(this.clock.now());
    const time = new Intl.DateTimeFormat(lang, { timeStyle: 'short' }).format(date);
    const today = dayStart(now);
    const day = dayStart(date);
    if (day === today) {
      return time;
    }
    if (day === dayStart(new Date(today - 1))) {
      return this.transloco.translate('time.yesterday', { time }, lang);
    }
    return new Intl.DateTimeFormat(lang, {
      year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }
}
