import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import { ChipChoiceRowComponent } from './chip-choice-row.component';

@Component({
  imports: [ChipChoiceRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-chip-choice-row
    label="Meal type"
    name="meal"
    optionLabel="feed.mealType."
    [options]="options"
    [control]="control"
  />`,
})
class Host {
  readonly options = ['breakfast', 'lunch', 'dinner', 'snack'];
  readonly control = new FormControl<string | null>('dinner');
}

@Component({
  imports: [ChipChoiceRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-chip-choice-row
    label="Colour"
    name="color"
    optionLabel="diaper.color."
    dotToken="--nala-stool-"
    [options]="options"
    [control]="control"
  />`,
})
class DotHost {
  readonly options = ['yellow', 'black'];
  readonly control = new FormControl<string | null>('black');
}

describe('ChipChoiceRowComponent', () => {
  let fixture: ComponentFixture<Host>;

  const host = () => fixture.nativeElement as HTMLElement;
  const chip = (value: string) =>
    host().querySelector<HTMLElement>(`[data-testid="meal-${value}"]`)!;
  const selected = (value: string) => chip(value).classList.contains('mat-mdc-chip-selected');
  const tap = async (value: string) => {
    chip(value).querySelector<HTMLElement>('.mdc-evolution-chip__action--primary')!.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  it('shows the label and one filter chip per option, translated', () => {
    expect(host().textContent).toContain('Meal type');
    expect(host().querySelector('mat-chip-listbox')).toBeTruthy();
    expect(host().querySelectorAll('mat-chip-option')).toHaveLength(4);
    expect(chip('breakfast').textContent?.trim()).toBe(en.feed.mealType.breakfast);
    expect(chip('snack').textContent?.trim()).toBe(en.feed.mealType.snack);
  });

  it("reflects the control's value", () => {
    expect(selected('dinner')).toBe(true);
    expect(selected('lunch')).toBe(false);
  });

  it('sets the control to the tapped chip, one at a time', async () => {
    await tap('lunch');

    expect(fixture.componentInstance.control.value).toBe('lunch');
    expect(selected('lunch')).toBe(true);
    expect(selected('dinner')).toBe(false);
  });

  it('clears the choice when the selected chip is tapped again', async () => {
    await tap('dinner');

    expect(fixture.componentInstance.control.value).toBeNull();
    expect(selected('dinner')).toBe(false);
  });

  it('shows no dot without a dot token', () => {
    expect(host().querySelector('[data-testid="meal-breakfast-dot"]')).toBeNull();
  });

  it('shows a colour dot per option from the dot token, also on the selected chip', async () => {
    const dots = TestBed.createComponent(DotHost);
    await dots.whenStable();
    const dot = (option: string) =>
      (dots.nativeElement as HTMLElement).querySelector<HTMLElement>(
        `[data-testid="color-${option}"] [data-testid="color-${option}-dot"]`,
      );

    expect(dot('yellow')?.getAttribute('style')).toContain('var(--nala-stool-yellow)');
    expect(dot('black')?.getAttribute('style')).toContain('var(--nala-stool-black)');
    expect(dot('black')?.getAttribute('aria-hidden')).toBe('true');
  });
});
