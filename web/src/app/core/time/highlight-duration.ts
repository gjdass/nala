import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * A duration in seconds as a card highlight shows it (spec 04), in the active language: hours and
 * minutes only, never seconds: "<1m", "26m", "2h 15m", "2h", and ">24h" from 24 hours on.
 * Impure to follow language changes.
 */
@Pipe({ name: 'nalaHighlightDuration', pure: false })
export class HighlightDurationPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const h = Math.floor(total / HOUR);
    const m = Math.floor((total % HOUR) / MINUTE);
    const [key, params] =
      total >= DAY
        ? ['highlight.over24h', {}]
        : h > 0
          ? m > 0
            ? ['duration.hm', { h, m }]
            : ['duration.h', { h }]
          : m > 0
            ? ['duration.m', { m }]
            : ['highlight.underMinute', {}];
    return this.transloco.translate(`time.${key}`, params, this.transloco.getActiveLang());
  }
}
