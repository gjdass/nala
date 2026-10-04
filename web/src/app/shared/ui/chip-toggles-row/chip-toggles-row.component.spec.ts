import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import { ChipTogglesRowComponent } from './chip-toggles-row.component';

@Component({
  imports: [ChipTogglesRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-chip-toggles-row
    label="Type"
    name="diaper"
    optionLabel="diaper.toggle."
    [controls]="controls"
  />`,
})
class Host {
  readonly controls = {
    wet: new FormControl(true, { nonNullable: true }),
    dirty: new FormControl(false, { nonNullable: true }),
  };
}

describe('ChipTogglesRowComponent', () => {
  let fixture: ComponentFixture<Host>;

  const host = () => fixture.nativeElement as HTMLElement;
  const controls = () => fixture.componentInstance.controls;
  const chip = (key: string) => host().querySelector<HTMLElement>(`[data-testid="diaper-${key}"]`)!;
  const selected = (key: string) => chip(key).classList.contains('mat-mdc-chip-selected');
  const tap = async (key: string) => {
    chip(key).querySelector<HTMLElement>('.mdc-evolution-chip__action--primary')!.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  it('shows the label and one filter chip per control, translated, in a multi-select listbox', () => {
    expect(host().textContent).toContain('Type');
    expect(host().querySelector('mat-chip-listbox')?.getAttribute('aria-multiselectable')).toBe(
      'true',
    );
    expect(host().querySelectorAll('mat-chip-option')).toHaveLength(2);
    expect(chip('wet').textContent?.trim()).toBe(en.diaper.toggle.wet);
    expect(chip('dirty').textContent?.trim()).toBe(en.diaper.toggle.dirty);
  });

  it('selects each chip from its own control', () => {
    expect(selected('wet')).toBe(true);
    expect(selected('dirty')).toBe(false);
  });

  it('toggles only the tapped control, so both can be on', async () => {
    await tap('dirty');

    expect(controls().dirty.value).toBe(true);
    expect(controls().dirty.dirty).toBe(true);
    expect(controls().wet.value).toBe(true);
    expect(selected('wet') && selected('dirty')).toBe(true);
  });

  it('lets every chip be off', async () => {
    await tap('wet');

    expect(controls().wet.value).toBe(false);
    expect(controls().dirty.value).toBe(false);
    expect(selected('wet')).toBe(false);
  });

  it('follows a control set from outside', async () => {
    controls().dirty.setValue(true);
    await fixture.whenStable();

    expect(selected('dirty')).toBe(true);
  });
});
