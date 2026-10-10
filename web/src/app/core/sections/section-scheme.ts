import { InjectionToken } from '@angular/core';
import { SectionKey } from './section.models';

/**
 * The global class (`_sections.scss`) giving an element and everything in it the section's own
 * Material colour scheme (spec 04). Set on the section's card and History entries, and as the
 * `panelClass` of the overlays a section opens, which render outside it.
 */
export const sectionScheme = (key: SectionKey): string => `nala-scheme-${key}`;

/** The scheme class of the section an element sits in, for the overlays it opens; provided by `nala-entry-sheet`. */
export const SECTION_SCHEME = new InjectionToken<string>('SECTION_SCHEME');
