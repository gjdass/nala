import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  contentChild,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SectionKey } from '../../../core/sections/section.models';
import { filter } from 'rxjs';
import { EntrySheetResult } from '../entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../entry-sheet/entry-sheet.service';
import { SectionEntryDirective } from './section-entry.directive';

/** How many recent entries "Show more" lists inline. */
export const RECENT_ENTRIES = 10;

const storageKey = (key: SectionKey) => `nala.sectionExpanded.${key}`;

/**
 * The frame of every home section card (spec 04): header band in the section colour with its title
 * and a + small FAB opening the section's kind picker or entry sheet (`changed` once an entry is
 * saved), the highlight (`[sectionHighlight]`) or, without entries, the empty state
 * (`[sectionEmpty]`), Show more / Show less over the first 10 `entries` rendered through the
 * `nalaSectionEntry` template, and a link to the section's history. `entries` is null while loading.
 * The expanded state is remembered per device and section.
 */
@Component({
  selector: 'nala-section-card',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatListModule,
    NgTemplateOutlet,
    RouterLink,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './section-card.component.html',
  styleUrl: './section-card.component.scss',
})
export class SectionCardComponent<T = unknown> {
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage;
  private readonly entrySheets = inject(EntrySheetService);

  readonly key = input.required<SectionKey>();
  /** The section's entries, newest first; null while loading. */
  readonly entries = input<readonly T[] | null>(null);
  /** An entry was added through +: the section reloads its entries. */
  readonly changed = output<EntrySheetResult>();

  protected readonly entryTemplate = contentChild(SectionEntryDirective, { read: TemplateRef });
  protected readonly recent = computed(() => (this.entries() ?? []).slice(0, RECENT_ENTRIES));
  protected readonly expanded = linkedSignal(() => this.readExpanded(this.key()));

  /** + : the kind picker or the entry sheet, per the section's kinds. */
  protected add(): void {
    this.entrySheets
      .add(this.key())
      .pipe(filter((result) => result !== undefined))
      .subscribe((result) => this.changed.emit(result));
  }

  protected toggle(): void {
    const expanded = !this.expanded();
    this.expanded.set(expanded);
    try {
      this.storage?.setItem(storageKey(this.key()), String(expanded));
    } catch {
      // Storage unavailable (private mode, blocked): the state lasts for this page only.
    }
  }

  private readExpanded(key: SectionKey): boolean {
    try {
      return this.storage?.getItem(storageKey(key)) === 'true';
    } catch {
      return false;
    }
  }
}
