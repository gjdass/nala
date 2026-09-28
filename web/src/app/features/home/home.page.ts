import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import { Baby } from '../../core/babies/baby.models';
import { BabyService } from '../../core/babies/baby.service';
import { HealthService, HealthStatus } from '../../core/health/health.service';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { SheetService } from '../../shared/ui/sheet/sheet.service';
import { BabySheetComponent } from '../babies/baby-sheet/baby-sheet.component';

/** Until the family has a baby, home shows only the invitation to add one. */
@Component({
  selector: 'nala-home',
  imports: [EmptyStateComponent, MatButtonModule, MatCardModule, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly health$: Observable<HealthStatus | 'loading'> = inject(HealthService).check();
  private readonly sheet = inject(SheetService);

  protected readonly status = toSignal(this.health$, { initialValue: 'loading' });

  /** Null while loading. */
  protected readonly babies = signal<Baby[] | null>(null);
  protected readonly loadError = signal(false);

  constructor() {
    inject(BabyService)
      .list()
      .subscribe((result) => {
        if (result.ok) {
          this.babies.set(result.babies);
        } else {
          this.loadError.set(true);
        }
      });
  }

  protected addBaby(): void {
    this.sheet.open<BabySheetComponent, Baby>(BabySheetComponent).subscribe((baby) => {
      if (baby) {
        this.babies.update((babies) => [...(babies ?? []), baby]);
      }
    });
  }
}
