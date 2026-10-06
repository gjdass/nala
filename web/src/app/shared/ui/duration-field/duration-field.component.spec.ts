import { ComponentFixture, TestBed } from '@angular/core/testing';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import {
  DurationFieldComponent,
  DurationGroup,
  durationGroup,
  durationSeconds,
} from './duration-field.component';

describe('DurationFieldComponent', () => {
  let fixture: ComponentFixture<DurationFieldComponent>;
  let group: DurationGroup;

  const host = () => fixture.nativeElement as HTMLElement;
  const input = (part: 'minutes' | 'seconds') =>
    host().querySelector<HTMLInputElement>(`[data-testid="duration-${part}"]`)!;
  const type = async (part: 'minutes' | 'seconds', value: string) => {
    input(part).value = value;
    input(part).dispatchEvent(new Event('input'));
    input(part).dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  };

  const render = async (seconds: number) => {
    group = durationGroup(seconds);
    fixture.componentRef.setInput('group', group);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DurationFieldComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(DurationFieldComponent);
  });

  it('shows the duration as minutes and seconds', async () => {
    await render(305);

    expect(input('minutes').value).toBe('5');
    expect(input('seconds').value).toBe('5');
    expect(host().textContent).toContain(en.durationField.minutes);
    expect(host().textContent).toContain(en.durationField.seconds);
  });

  it('selects a part once it gets the focus, so typing replaces it', async () => {
    await render(305);
    const select = vi.spyOn(input('minutes'), 'select');

    input('minutes').dispatchEvent(new FocusEvent('focus'));

    expect(select).toHaveBeenCalled();
  });

  it('gives the typed duration in seconds, an empty part counting as 0', async () => {
    await render(0);

    await type('minutes', '12');
    expect(durationSeconds(group)).toBe(720);

    await type('seconds', '4');
    expect(durationSeconds(group)).toBe(724);

    await type('minutes', '');
    expect(durationSeconds(group)).toBe(4);
    expect(group.valid).toBe(true);
  });

  it('refuses seconds above 59 and minutes above 240', async () => {
    await render(0);

    await type('seconds', '60');
    expect(group.invalid).toBe(true);
    expect(host().textContent).toContain(en.durationField.secondsRange);

    await type('seconds', '59');
    await type('minutes', '241');
    expect(group.invalid).toBe(true);
    expect(host().textContent).toContain(en.durationField.minutesRange);
  });

  it('refuses more than 4 hours in all', async () => {
    await render(0);

    await type('minutes', '240');
    expect(group.valid).toBe(true);

    await type('seconds', '1');
    expect(group.invalid).toBe(true);
    expect(host().textContent).toContain(en.durationField.tooLong);
  });

  it('refuses negative and fractional values', async () => {
    await render(0);

    await type('minutes', '-1');
    expect(group.invalid).toBe(true);

    await type('minutes', '1.5');
    expect(group.invalid).toBe(true);
  });
});
