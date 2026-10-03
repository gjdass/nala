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
import { SelectedBabyService } from '../../../core/babies/selected-baby.service';
import { FOLDED_ENTRIES } from '../../../core/sections/recent-entries';
import { SectionKey } from '../../../core/sections/section.models';
import { RunningTimer } from '../../../core/timers/running-timer.models';
import { RunningTimersService } from '../../../core/timers/running-timers.service';
import { Observable, filter } from 'rxjs';
import { EntrySheetResult } from '../entry-sheet/entry-sheet.models';
import { EntrySheetService } from '../entry-sheet/entry-sheet.service';
import { SectionEntryDirective } from './section-entry.directive';

const storageKey = (key: SectionKey) => `nala.sectionExpanded.${key}`;

/**
 * The frame of every home section card (spec 04): header band in the section colour with its title
 * and a + small FAB opening the section's kind picker or entry sheet (`changed` once an entry is
 * saved), replaced by the timer button while the section has a live entry for the selected baby (from
 * `RunningTimersService`, the oldest with two), which opens that entry's sheet; an optional banner (`[sectionBanner]`, shown whatever the entries), the highlight
 * (`[sectionHighlight]`) or, without entries, the empty state (`[sectionEmpty]`), unchanged while an
 * entry is live (no timer on the card), then the 3 most recent `entries` rendered
 * through the `nalaSectionEntry` template, Show more / Show less listing all of them (hidden when
 * there are no more than 3), and "All activities", the section's history. `entries` is null while
 * loading. The expanded state is remembered per device and section.
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
  private readonly timers = inject(RunningTimersService).timers;
  private readonly selected = inject(SelectedBabyService).selected;

  readonly key = input.required<SectionKey>();
  /** The section's entries of the last 24 hours, at least the 3 most recent (`loadRecentEntries`), newest first; null while loading. */
  readonly entries = input<readonly T[] | null>(null);
  /** An entry was added through +: the section reloads its entries. */
  readonly changed = output<EntrySheetResult>();

  /** The section's live entry for the selected baby: + becomes the timer button opening it. */
  protected readonly live = computed(() => {
    const babyId = this.selected()?.id;
    return (
      this.timers().find((timer) => timer.section === this.key() && timer.babyId === babyId) ?? null
    );
  });
  protected readonly entryTemplate = contentChild(SectionEntryDirective, { read: TemplateRef });
  protected readonly expanded = linkedSignal(() => this.readExpanded(this.key()));
  protected readonly canExpand = computed(() => (this.entries() ?? []).length > FOLDED_ENTRIES);
  protected readonly shown = computed(() => {
    const entries = this.entries() ?? [];
    return this.expanded() ? entries : entries.slice(0, FOLDED_ENTRIES);
  });

  /** + : the kind picker or the entry sheet, per the section's kinds. */
  protected add(): void {
    this.emitChanged(this.entrySheets.add(this.key()));
  }

  /** Timer button: the live entry's sheet. */
  protected openLive(timer: RunningTimer): void {
    this.emitChanged(this.entrySheets.edit(this.key(), timer.kind, timer.entry));
  }

  private emitChanged(closed: Observable<EntrySheetResult | undefined>): void {
    closed
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
