import { SECTION_KEYS } from './section.models';
import { sectionScheme } from './section-scheme';

describe('sectionScheme', () => {
  it("names the global class holding each section's colour scheme", () => {
    expect(SECTION_KEYS.map(sectionScheme)).toEqual([
      'nala-scheme-feed',
      'nala-scheme-sleep',
      'nala-scheme-diaper',
      'nala-scheme-pump',
      'nala-scheme-growth',
      'nala-scheme-health',
    ]);
  });
});
