import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import { HealthService, HealthStatus } from '../../core/health/health.service';
import { LANGS, Lang } from '../../core/i18n/initial-lang';
import { THEME_MODES, ThemeMode, ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'nala-home',
  imports: [MatButtonToggleModule, MatCardModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly transloco = inject(TranslocoService);
  private readonly theme = inject(ThemeService);
  private readonly health$: Observable<HealthStatus | 'loading'> = inject(HealthService).check();

  protected readonly langs = LANGS;
  protected readonly themeModes = THEME_MODES;
  protected readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  protected readonly themeMode = this.theme.mode;
  protected readonly status = toSignal(this.health$, { initialValue: 'loading' });

  protected setLang(lang: Lang): void {
    this.transloco.setActiveLang(lang);
  }

  protected setTheme(mode: ThemeMode): void {
    this.theme.setMode(mode);
  }
}
