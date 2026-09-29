import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import { SuggestionRowComponent } from './suggestion-row.component';

@Component({
  imports: [SuggestionRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-suggestion-row
    text="Use last breast milk amount: 90 ml?"
    (accept)="accepted = accepted + 1"
  />`,
})
class Host {
  accepted = 0;
}

describe('SuggestionRowComponent', () => {
  let fixture: ComponentFixture<Host>;

  const find = (testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      `[data-testid="${testId}"]`,
    )!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  it('shows the suggestion with a Yes text button', () => {
    expect(find('suggestion-text').textContent?.trim()).toBe('Use last breast milk amount: 90 ml?');
    expect(find('suggestion-accept').textContent?.trim()).toBe(en.suggestion.yes);
    expect(find('suggestion-accept').hasAttribute('mat-button')).toBe(true);
  });

  it('emits accept on Yes', () => {
    find('suggestion-accept').click();

    expect(fixture.componentInstance.accepted).toBe(1);
  });
});
