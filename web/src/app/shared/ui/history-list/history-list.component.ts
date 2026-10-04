import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  TemplateRef,
  computed,
  contentChild,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { HistoryPageLoader, SectionKey } from '../../../core/sections/section.models';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { EntrySheetResult } from '../entry-sheet/entry-sheet.models';
import { SectionEntryDirective } from '../section-card/section-entry.directive';
import { HistoryEndDirective } from './history-end.directive';

/**
 * A section's full history (spec 04): the entries `loader` returns, page by page as the end of the
 * list scrolls into view, each rendered through the `nalaSectionEntry` template, then the optional
 * `nalaHistoryEnd` template once the last page is loaded, with a progress indicator, an empty state
 * (none with an end template), and an error with Try again that keeps the pages already loaded. A new
 * `loader` (e.g. another baby) starts again from the first page. `apply()` patches an entry edited
 * or deleted from the list in place.
 */
@Component({
  selector: 'nala-history-list',
  imports: [
    EmptyStateComponent,
    MatButtonModule,
    MatListModule,
    MatProgressSpinnerModule,
    NgTemplateOutlet,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history-list.component.html',
  styleUrl: './history-list.component.scss',
})
export class HistoryListComponent<T extends { id: string } = { id: string }> {
  readonly key = input.required<SectionKey>();
  readonly loader = input.required<HistoryPageLoader<T>>();

  protected readonly entryTemplate = contentChild(SectionEntryDirective, { read: TemplateRef });
  protected readonly endTemplate = contentChild(HistoryEndDirective, { read: TemplateRef });
  protected readonly entries = signal<readonly T[]>([]);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  private readonly done = signal(false);
  /** The end template, once the last page is loaded. */
  protected readonly end = computed(() => (this.done() ? (this.endTemplate() ?? null) : null));
  protected readonly empty = computed(
    () => this.done() && this.entries().length === 0 && !this.endTemplate(),
  );

  private readonly sentinel = viewChild.required<ElementRef<HTMLElement>>('sentinel');
  private cursor: string | null = null;
  private endInView = false;
  private request?: Subscription;

  constructor() {
    effect(() => {
      const loader = this.loader();
      untracked(() => this.restart(loader));
    });
    effect((onCleanup) => {
      const observer = new IntersectionObserver((seen) => {
        this.endInView = seen.some((s) => s.isIntersecting);
        if (this.endInView) {
          this.loadNext();
        }
      });
      observer.observe(this.sentinel().nativeElement);
      onCleanup(() => observer.disconnect());
    });
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  /**
   * Puts an entry edited from the list back where it is, or removes a deleted one; a change kept on
   * the device (offline) leaves the list as it is.
   */
  apply(result: EntrySheetResult<T>): void {
    if ('queued' in result) {
      return;
    }
    if ('deleted' in result) {
      this.entries.update((list) => list.filter((e) => e.id !== result.deleted));
    } else {
      this.entries.update((list) => list.map((e) => (e.id === result.saved.id ? result.saved : e)));
    }
  }

  protected retry(): void {
    this.failed.set(false);
    this.loadNext();
  }

  private restart(loader: HistoryPageLoader<T>): void {
    this.request?.unsubscribe();
    this.entries.set([]);
    this.cursor = null;
    this.done.set(false);
    this.failed.set(false);
    this.loading.set(false);
    this.load(loader);
  }

  private loadNext(): void {
    this.load(this.loader());
  }

  private load(loader: HistoryPageLoader<T>): void {
    if (this.loading() || this.failed() || this.done()) {
      return;
    }
    this.loading.set(true);
    this.request = loader(this.cursor).subscribe({
      next: (page) => {
        this.entries.update((list) => [...list, ...page.entries]);
        this.cursor = page.next;
        this.done.set(page.next === null);
        this.loading.set(false);
        // A short page leaves the end in view: the observer won't fire again, so keep going.
        if (this.endInView) {
          this.loadNext();
        }
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }
}
