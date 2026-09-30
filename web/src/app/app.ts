import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RunningTimersService } from './core/timers/running-timers.service';
import { RunningTimersBarComponent } from './shared/ui/running-timers-bar/running-timers-bar.component';

@Component({
  selector: 'nala-root',
  imports: [RouterOutlet, RunningTimersBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The mini-bar (and the sheets it opens) loads only once a timer runs, keeping it out of the initial bundle.
  template: `
    <router-outlet />
    @defer (when running()) {
      <nala-running-timers-bar />
    }
  `,
  // A column at least a screen tall, so the mini-bar sits at the bottom of a short page.
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }
  `,
})
export class App {
  private readonly timers = inject(RunningTimersService).timers;

  protected readonly running = computed(() => this.timers().length > 0);
}
