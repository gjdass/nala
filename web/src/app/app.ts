import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { RunningTimersService } from './core/timers/running-timers.service';
import { BottomNavComponent } from './shared/ui/bottom-nav/bottom-nav.component';
import { RunningTimersBarComponent } from './shared/ui/running-timers-bar/running-timers-bar.component';

@Component({
  selector: 'nala-root',
  imports: [BottomNavComponent, RouterOutlet, RunningTimersBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The mini-bar (and the sheets it opens) loads only once a timer runs, keeping it out of the initial bundle.
  // It shows inside the navigation bar's pill, above the destinations, in a dock pinned at the bottom.
  template: `
    <router-outlet />
    <div class="dock">
      @if (signedIn()) {
        <nala-bottom-nav [withTimers]="running()">
          @defer (when running()) {
            <nala-running-timers-bar />
          }
        </nala-bottom-nav>
      }
    </div>
  `,
  // A column at least a screen tall (below the body's top safe-area padding), so the dock sits at the bottom of a short page; being sticky
  // and after the page, the page's last element always scrolls above it.
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: calc(100dvh - var(--nala-safe-top));
    }

    .dock {
      position: sticky;
      bottom: 0;
      margin-top: auto;
      z-index: 1;
    }
  `,
})
export class App {
  private readonly timers = inject(RunningTimersService).timers;
  private readonly auth = inject(AuthService).state;

  protected readonly running = computed(() => this.timers().length > 0);
  protected readonly signedIn = computed(() => !!this.auth()?.user);
}
