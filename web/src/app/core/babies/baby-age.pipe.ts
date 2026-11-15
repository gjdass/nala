import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { NowService } from '../time/now.service';
import { babyAge } from './baby-age';

/**
 * A baby's age from their `yyyy-MM-dd` birth date, in the active language: "5 days",
 * "6 weeks 2 days", "4 months 10 days". Impure, like `TranslocoPipe`, to follow language changes, and
 * by default the clock's day (`NowService.today`), so the age moves on at midnight.
 */
@Pipe({ name: 'babyAge', pure: false })
export class BabyAgePipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);
  private readonly clock = inject(NowService);

  /** `today` defaults to the device's current local day. */
  transform(birthDate: string, today?: Date): string {
    const { months, weeks, days } = babyAge(birthDate, today ?? new Date(this.clock.today()));
    const lead =
      months > 0 ? this.part('month', months) : weeks > 0 ? this.part('week', weeks) : '';
    if (!lead) {
      return this.part('day', days);
    }
    return days > 0 ? `${lead} ${this.part('day', days)}` : lead;
  }

  private part(unit: 'day' | 'week' | 'month', count: number): string {
    const lang = this.transloco.getActiveLang();
    const form = new Intl.PluralRules(lang).select(count) === 'one' ? 'one' : 'other';
    return this.transloco.translate(`babies.age.${unit}.${form}`, { count }, lang);
  }
}
