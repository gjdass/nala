import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SectionDefinition, SectionKey, SectionKind } from '../core/sections/section.models';

@Component({
  selector: 'nala-fake-section-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class FakeSectionCard {}

@Component({
  selector: 'nala-fake-kind-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class FakeKindSheet {}

/** A kind whose sheet renders nothing; labelled with an existing translation key. */
export const fakeKind = (key: string, icon = 'circle', label = 'sections.feed'): SectionKind => ({
  key,
  icon,
  label,
  sheet: FakeKindSheet,
});

/** A registered section for tests that don't render its card. */
export const fakeSection = (
  key: SectionKey,
  icon = 'circle',
  kinds: readonly SectionKind[] = [fakeKind('only')],
): SectionDefinition => ({
  key,
  icon,
  card: FakeSectionCard,
  kinds,
});
