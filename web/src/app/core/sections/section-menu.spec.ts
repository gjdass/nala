import { SectionDefinition, SectionKey } from './section.models';
import { menuSections, splitByVisibility } from './section-menu';

const section = (key: SectionKey): SectionDefinition =>
  ({ key, icon: `${key}-icon`, kinds: [] }) as unknown as SectionDefinition;

describe('section menu', () => {
  const sections = (['feed', 'sleep', 'health'] as const).map(section);

  it('lists the registered sections in the home order, with their icon and visibility', () => {
    expect(
      menuSections(
        [
          { key: 'health', visible: true },
          { key: 'pump', visible: true },
          { key: 'feed', visible: false },
          { key: 'sleep', visible: true },
        ],
        sections,
      ),
    ).toEqual([
      { key: 'health', icon: 'health-icon', visible: true },
      { key: 'feed', icon: 'feed-icon', visible: false },
      { key: 'sleep', icon: 'sleep-icon', visible: true },
    ]);
  });

  it('uses the default order, all visible, until the home order is known', () => {
    expect(menuSections(null, sections).map((s) => [s.key, s.visible])).toEqual([
      ['feed', true],
      ['sleep', true],
      ['health', true],
    ]);
  });

  it('keeps only the sections allowed, when given', () => {
    expect(menuSections(null, sections, ['sleep', 'feed']).map((s) => s.key)).toEqual([
      'feed',
      'sleep',
    ]);
  });

  it('splits the visible sections from the hidden ones, each in order', () => {
    const list = menuSections(
      [
        { key: 'sleep', visible: false },
        { key: 'feed', visible: true },
        { key: 'health', visible: false },
      ],
      sections,
    );

    const { visible, hidden } = splitByVisibility(list);

    expect(visible.map((s) => s.key)).toEqual(['feed']);
    expect(hidden.map((s) => s.key)).toEqual(['sleep', 'health']);
  });
});
