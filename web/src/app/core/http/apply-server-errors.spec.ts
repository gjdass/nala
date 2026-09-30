import { FormControl, FormGroup } from '@angular/forms';
import { applyServerErrors } from './apply-server-errors';

describe('applyServerErrors', () => {
  const form = () =>
    new FormGroup({
      food: new FormControl('Carrot'),
      notes: new FormControl(''),
    });

  it('puts each field code on its control as a touched server error, with no form error', () => {
    const group = form();

    expect(applyServerErrors(group, { food: 'tooLong' })).toBeNull();
    expect(group.controls.food.errors).toEqual({ server: 'tooLong' });
    expect(group.controls.food.touched).toBe(true);
    expect(group.controls.notes.errors).toBeNull();
  });

  it('answers the form-level code', () => {
    expect(applyServerErrors(form(), { form: 'feedNotFound' })).toBe('feedNotFound');
  });

  it('answers unknown when no field of the form matches', () => {
    expect(applyServerErrors(form(), {})).toBe('unknown');
    expect(applyServerErrors(form(), { kind: 'invalid' })).toBe('unknown');
  });
});
