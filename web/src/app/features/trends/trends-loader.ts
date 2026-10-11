import { Directive, inject, input } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import { onReload } from '../../core/refresh/data-refresh.service';
import { TrendsPeriod } from './trends-period';

/**
 * What every Trends section (spec 12) loads: its data for the baby and the period, loaded again when
 * either changes and on the reload signal (keeping the cards meanwhile), and the active language.
 */
@Directive()
export abstract class TrendsLoader<T> {
  protected readonly transloco = inject(TranslocoService);
  protected readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly babyId = input.required<string>();
  readonly period = input.required<TrendsPeriod>();
  readonly today = input.required<Date>();

  protected readonly data = rxResource({
    params: () => ({ babyId: this.babyId(), period: this.period() }),
    stream: ({ params }) => this.load(params.babyId, params.period),
  });

  constructor() {
    onReload(() => this.data.reload());
  }

  /** The section's data for the period. */
  protected abstract load(babyId: string, period: TrendsPeriod): Observable<T>;
}
