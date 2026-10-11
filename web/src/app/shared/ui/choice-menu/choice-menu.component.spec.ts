import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatMenuModule } from '@angular/material/menu';
import { translocoTesting } from '../../../testing/transloco-testing';
import { ChoiceMenuComponent, ChoiceOption } from './choice-menu.component';

@Component({
  selector: 'nala-test-host',
  imports: [ChoiceMenuComponent, MatMenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" data-testid="trigger" [matMenuTriggerFor]="choice.menu()">Open</button>
    <nala-choice-menu
      #choice
      ariaLabel="sections.feed"
      [options]="options()"
      [value]="value()"
      (valueChange)="picked.push($event)"
    />
  `,
})
class Host {
  readonly options = signal<ChoiceOption<string>[]>([
    { value: 'a', labelKey: 'sections.feed' },
    { value: 'b', labelKey: 'sections.sleep', icon: 'bedtime' },
    { value: 'c', labelKey: 'sections.diaper', dividerBefore: true },
  ]);
  readonly value = signal('b');
  readonly picked: string[] = [];
}

describe('ChoiceMenuComponent', () => {
  let fixture: ComponentFixture<Host>;

  const trigger = () =>
    fixture.nativeElement.querySelector('[data-testid="trigger"]') as HTMLElement;
  const rows = () => [
    ...document.querySelectorAll<HTMLButtonElement>('[data-testid="choice-option"]'),
  ];
  const open = async () => {
    trigger().click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  it('lists its options as menuitemradio rows, the current one checked', async () => {
    await open();

    expect(
      rows().map((row) => [
        row.getAttribute('role'),
        row.textContent?.trim(),
        row.getAttribute('aria-checked'),
        !!row.querySelector('mat-pseudo-checkbox.mat-pseudo-checkbox-checked'),
      ]),
    ).toEqual([
      ['menuitemradio', 'Feed', 'false', false],
      ['menuitemradio', 'bedtimeSleep', 'true', true],
      ['menuitemradio', 'Diaper', 'false', false],
    ]);
  });

  it('shows an option icon when it has one, and a divider before a marked option', async () => {
    await open();

    expect(rows().map((r) => r.querySelector('mat-icon')?.textContent?.trim() ?? null)).toEqual([
      null,
      'bedtime',
      null,
    ]);
    const panel = document.querySelector('.mat-mdc-menu-panel')!;
    expect(
      [...panel.querySelectorAll('[data-testid="choice-option"], mat-divider')].map((e) =>
        e.tagName.toLowerCase(),
      ),
    ).toEqual(['button', 'button', 'mat-divider', 'button']);
  });

  it('emits the option picked and closes the menu', async () => {
    await open();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    rows()[2].click();
    await fixture.whenStable();

    expect(fixture.componentInstance.picked).toEqual(['c']);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });
});
