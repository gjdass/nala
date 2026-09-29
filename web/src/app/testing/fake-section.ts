import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SectionDefinition, SectionKey } from '../core/sections/section.models';

@Component({
  selector: 'nala-fake-section-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class FakeSectionCard {}

/** A registered section for tests that don't render its card. */
export const fakeSection = (key: SectionKey, icon = 'circle'): SectionDefinition => ({
  key,
  icon,
  card: FakeSectionCard,
});
