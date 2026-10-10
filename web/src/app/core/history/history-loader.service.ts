import { Injectable, Injector, inject } from '@angular/core';
import { defer, switchMap } from 'rxjs';
import { HistoryPageLoader, SECTIONS, SectionKey } from '../sections/section.models';
import { HistoryItem, HistorySource } from './history-source.models';
import { mergedHistoryLoader } from './merged-history-loader';

/** Builds History's merged loader (spec 11) from the registered sections' sources, loaded on demand. */
@Injectable({ providedIn: 'root' })
export class HistoryLoaderService {
  private readonly sections = inject(SECTIONS);
  private readonly injector = inject(Injector);
  private readonly sources = new Map<SectionKey, Promise<HistorySource>>();

  /**
   * The registered source of a section, loaded once; a failed load (e.g. offline) is tried again on
   * the next call.
   */
  source(key: SectionKey): Promise<HistorySource> {
    let source = this.sources.get(key);
    if (!source) {
      const section = this.sections.find((s) => s.key === key);
      source = section
        ? section.loadSource().then(
            (type) => this.injector.get(type),
            (error: unknown) => {
              this.sources.delete(key);
              throw error;
            },
          )
        : Promise.reject(new Error(`No registered section ${key}`));
      this.sources.set(key, source);
    }
    return source;
  }

  /**
   * The merged pages of the selected baby's entries in `keys` (home order) at or after `since`; a key
   * with no registered section is skipped.
   */
  loader(babyId: string, keys: readonly SectionKey[], since: Date): HistoryPageLoader<HistoryItem> {
    const registered = keys.filter((key) => this.sections.some((s) => s.key === key));
    let merged: Promise<HistoryPageLoader<HistoryItem>> | undefined;
    // The sources load once; a failed load (e.g. offline) is tried again on the next call.
    const resolve = () =>
      (merged ??= Promise.all(
        registered.map(async (key) => ({ key, source: await this.source(key) })),
      ).then(
        (sources) => mergedHistoryLoader(sources, babyId, since),
        (error: unknown) => {
          merged = undefined;
          throw error;
        },
      ));
    return (cursor) => defer(resolve).pipe(switchMap((loader) => loader(cursor)));
  }
}
