import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/**
 * A duration in seconds, in the active language (spec 04): "45s", "8m 30s", "8m", "1h 5m", "2h".
 * Zero parts are left out, and seconds from one hour. Impure to follow language changes.
 */
@Pipe({ name: 'nalaDuration', pure: false })
export class DurationPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const [key, params] =
      h > 0
        ? m > 0
          ? ['hm', { h, m }]
          : ['h', { h }]
        : m > 0
          ? s > 0
            ? ['ms', { m, s }]
            : ['m', { m }]
          : ['s', { s }];
    return this.transloco.translate(`time.duration.${key}`, params, this.transloco.getActiveLang());
  }
}
