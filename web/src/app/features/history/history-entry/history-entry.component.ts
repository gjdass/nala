import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ComponentRef,
  ViewContainerRef,
  computed,
  effect,
  inject,
  input,
  output,
  outputBinding,
  viewChild,
} from '@angular/core';
import { HistoryLoaderService } from '../../../core/history/history-loader.service';
import { HistoryItem } from '../../../core/history/history-source.models';
import { sectionScheme } from '../../../core/sections/section-scheme';

/**
 * One entry of History's list (spec 11): its section's own list item (`nala-feed-entry`…), given by the
 * section's History source, inside the section's colour scheme. Emits `open` when the item is tapped.
 */
@Component({
  selector: 'nala-history-entry',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-container #outlet />',
  styles: ':host { display: block; }',
  host: { '[class]': 'scheme()' },
})
export class HistoryEntryComponent {
  readonly item = input.required<HistoryItem>();
  readonly open = output<void>();

  protected readonly scheme = computed(() => sectionScheme(this.item().section));

  private readonly outlet = viewChild.required('outlet', { read: ViewContainerRef });
  private readonly sources = inject(HistoryLoaderService);
  private readonly changes = inject(ChangeDetectorRef);
  private rendered?: ComponentRef<unknown>;

  constructor() {
    effect(() => {
      const item = this.item();
      const outlet = this.outlet();
      void this.sources.source(item.section).then((source) => {
        if (item !== this.item()) {
          return;
        }
        // The same entry saved from its sheet keeps its list item, with new inputs.
        this.rendered ??= outlet.createComponent(source.item, {
          bindings: [outputBinding('open', () => this.open.emit())],
        });
        Object.entries(source.inputs(item.entry)).forEach(([name, value]) =>
          this.rendered!.setInput(name, value),
        );
        this.changes.markForCheck();
      });
    });
  }
}
