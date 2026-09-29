import { InjectionToken, Type } from '@angular/core';
import { FieldErrors } from '../auth/auth.models';

/** Every home section, in the default order (the API owns the list; spec 04). */
export const SECTION_KEYS = ['feed', 'sleep', 'diaper', 'pump', 'growth', 'medication'] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

/** One section of the user's home, in their order. */
export interface SectionPreference {
  key: SectionKey;
  visible: boolean;
}

export type SectionsSaveResult = { ok: true } | { ok: false; errors: FieldErrors };

/** A section the app has built; each feature registers its own through `SECTIONS`. */
export interface SectionDefinition {
  key: SectionKey;
  /** Material Symbols name. */
  icon: string;
  /** The section's home card: loads its own entries for the selected baby and wraps `nala-section-card`. */
  card: Type<unknown>;
}

/** The built sections; home and settings only show these. */
export const SECTIONS = new InjectionToken<readonly SectionDefinition[]>('SECTIONS', {
  providedIn: 'root',
  factory: () => [],
});
