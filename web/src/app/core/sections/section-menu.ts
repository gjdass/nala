import { SectionDefinition, SectionKey, SectionPreference } from './section.models';

/** A section in a filter bar's sections menu, in the home order. */
export interface MenuSection {
  key: SectionKey;
  /** Material Symbols name. */
  icon: string;
  /** Visible on home: listed first; the hidden ones follow after a divider. */
  visible: boolean;
}

/**
 * The registered sections in the home order (the default one, all visible, while `order` is null),
 * keeping only the `allowed` ones when given.
 */
export function menuSections(
  order: readonly SectionPreference[] | null,
  sections: readonly SectionDefinition[],
  allowed?: readonly SectionKey[],
): MenuSection[] {
  return (order ?? sections.map((s) => ({ key: s.key, visible: true }))).flatMap(
    ({ key, visible }) => {
      const section = sections.find((s) => s.key === key);
      return section && (!allowed || allowed.includes(key))
        ? [{ key, icon: section.icon, visible }]
        : [];
    },
  );
}

/** The visible sections, then the hidden ones, each in order. */
export function splitByVisibility(sections: readonly MenuSection[]): {
  visible: MenuSection[];
  hidden: MenuSection[];
} {
  return {
    visible: sections.filter((s) => s.visible),
    hidden: sections.filter((s) => !s.visible),
  };
}
