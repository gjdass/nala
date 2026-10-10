import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, map } from 'rxjs';

interface Destination {
  key: 'dashboard' | 'history' | 'trends' | 'settings';
  path: string;
  icon: string;
}

const DESTINATIONS: Destination[] = [
  { key: 'dashboard', path: '/', icon: 'dashboard' },
  { key: 'history', path: '/history', icon: 'history' },
  { key: 'trends', path: '/trends', icon: 'insights' },
  { key: 'settings', path: '/settings', icon: 'settings' },
];

/** The destination a URL belongs to, whatever its query. */
const destinationOf = (url: string): Destination['key'] | null => {
  const path = url.split(/[?#]/)[0];
  return DESTINATIONS.find((d) => d.path === path)?.key ?? null;
};

/**
 * The floating bottom navigation bar of the signed-in screens (spec 04): Dashboard, History,
 * Trends and Settings, each an icon only (its name as accessible name and tooltip), the current one with the M3 active indicator.
 * The running timers (the mini-bar) are projected into the same pill, above the destinations: while
 * `withTimers`, a divider separates them and the pill takes the large corner instead of fully round ends.
 */
@Component({
  selector: 'nala-bottom-nav',
  imports: [
    MatDividerModule,
    MatIconModule,
    MatRippleModule,
    MatTooltipModule,
    RouterLink,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** The projected running timers show: divider and large corner. */
  readonly withTimers = input(false);

  protected readonly destinations = DESTINATIONS;
  protected readonly current = computed(() => destinationOf(this.url()));
}
