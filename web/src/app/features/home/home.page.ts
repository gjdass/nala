import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import { HealthService, HealthStatus } from '../../core/health/health.service';

@Component({
  selector: 'nala-home',
  imports: [MatButtonModule, MatCardModule, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly health$: Observable<HealthStatus | 'loading'> = inject(HealthService).check();

  protected readonly status = toSignal(this.health$, { initialValue: 'loading' });
}
