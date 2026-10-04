import { Diaper, DiaperType } from './diaper.models';

/** The diaper's type from its two independent toggles; neither is dry (spec 07). */
export function diaperType({ wet, dirty }: Pick<Diaper, 'wet' | 'dirty'>): DiaperType {
  if (wet && dirty) {
    return 'wetDirty';
  }
  return wet ? 'wet' : dirty ? 'dirty' : 'dry';
}
