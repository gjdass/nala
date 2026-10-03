import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { NowService } from './now.service';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago an ISO date-time was, in the active language (spec 04): "just now", "26m ago",
 * "2h 15m ago", and ">24h ago" from 24 hours on (never seconds). Impure: it follows the language and the shared clock, so it updates live.
 */
@Pipe({ name: 'nalaTimeSince', pure: false })
export class TimeSincePipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);
  private readonly clock = inject(NowService);

  transform(iso: string): string {
    const lang = this.transloco.getActiveLang();
    const t = (key: string, params: Record<string, number>) =>
      this.transloco.translate(`time.${key}`, params, lang);
    const elapsed = Math.max(0, this.clock.now() - new Date(iso).getTime());
    if (elapsed < MINUTE) {
      return t('justNow', {});
    }
    if (elapsed < HOUR) {
      return t('minutesAgo', { m: Math.floor(elapsed / MINUTE) });
    }
    if (elapsed < DAY) {
      const h = Math.floor(elapsed / HOUR);
      const m = Math.floor((elapsed % HOUR) / MINUTE);
      return m > 0 ? t('hoursMinutesAgo', { h, m }) : t('hoursAgo', { h });
    }
    return t('over24hAgo', {});
  }
}
