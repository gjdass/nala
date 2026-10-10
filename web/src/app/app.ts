import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from './core/auth/auth.service';
import { RunningTimersService } from './core/timers/running-timers.service';
import { BottomNavComponent } from './shared/ui/bottom-nav/bottom-nav.component';
import { EmptyStateComponent } from './shared/ui/empty-state/empty-state.component';
import { RunningTimersBarComponent } from './shared/ui/running-timers-bar/running-timers-bar.component';

@Component({
  selector: 'nala-root',
  imports: [BottomNavComponent, EmptyStateComponent, RouterOutlet, RunningTimersBarComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The mini-bar (and the sheets it opens) loads only once a timer runs, keeping it out of the initial bundle.
  // It shows inside the navigation bar's pill, above the destinations, in a dock pinned at the bottom.
  // The edge guard keeps iOS from blurring the top of the screen; the turn-upright message shows on a phone in landscape only
  // (spec 04, `_layout.scss`).
  template: `
    <div class="nala-edge-guard" aria-hidden="true"></div>
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
    <div class="nala-upright">
      <nala-empty-state icon="screen_rotation" [title]="'app.turnUpright' | transloco" />
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

  constructor() {
    // iOS ignores `user-scalable=no` and still pinch-zooms; cancelling its gesture events stops it (spec 04).
    const document = inject(DOCUMENT);
    const cancel = (event: Event) => event.preventDefault();
    document.addEventListener('gesturestart', cancel);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('gesturestart', cancel));
  }
}
