import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HealthService, HealthStatus } from '../../core/health/health.service';
import { LANGS, Lang } from '../../core/i18n/initial-lang';

@Component({
  selector: 'nala-home',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
})
export class HomePage {
  private readonly transloco = inject(TranslocoService);

  protected readonly langs = LANGS;
  protected readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  private readonly health$: Observable<HealthStatus | 'loading'> = inject(HealthService).check();
  protected readonly status = toSignal(this.health$, { initialValue: 'loading' });

  protected setLang(lang: Lang): void {
    this.transloco.setActiveLang(lang);
  }
}
