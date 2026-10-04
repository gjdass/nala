import { Pump } from './pump.models';

/** Left + right in ml, a side without a volume counting as 0; null when neither side has one (spec 08). */
export function pumpTotalMl({ leftMl, rightMl }: Pick<Pump, 'leftMl' | 'rightMl'>): number | null {
  return leftMl === null && rightMl === null ? null : (leftMl ?? 0) + (rightMl ?? 0);
}
