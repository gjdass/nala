import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SectionDefinition, SectionKey, SectionKind } from '../core/sections/section.models';

@Component({
  selector: 'nala-fake-section-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class FakeSectionCard {}

@Component({
  selector: 'nala-fake-kind-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class FakeKindSheet {}

@Component({
  selector: 'nala-fake-section-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class FakeSectionHistory {}

/** A kind whose sheet renders nothing; labelled with an existing translation key. */
export const fakeKind = (key: string, icon = 'circle', label = 'sections.feed'): SectionKind => ({
  key,
  icon,
  label,
  loadSheet: () => Promise.resolve(FakeKindSheet),
});

/** A registered section for tests that don't render its card or history. */
export const fakeSection = (
  key: SectionKey,
  icon = 'circle',
  kinds: readonly SectionKind[] = [fakeKind('only')],
): SectionDefinition => ({
  key,
  icon,
  loadCard: () => Promise.resolve(FakeSectionCard),
  kinds,
  loadHistory: () => Promise.resolve(FakeSectionHistory),
});
