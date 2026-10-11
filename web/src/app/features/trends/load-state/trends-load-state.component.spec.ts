import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import { TrendsLoadStateComponent } from './trends-load-state.component';

@Component({
  imports: [TrendsLoadStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nala-trends-load-state [error]="error()" [loaded]="loaded()" (retry)="retries = retries + 1">
    <p data-testid="cards">Cards</p>
  </nala-trends-load-state>`,
})
class HostComponent {
  readonly error = signal(false);
  readonly loaded = signal(false);
  retries = 0;
}

describe('TrendsLoadStateComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  const find = (testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const set = async (state: { error?: boolean; loaded?: boolean }) => {
    fixture.componentInstance.error.set(state.error ?? false);
    fixture.componentInstance.loaded.set(state.loaded ?? false);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  it('shows a spinner until the trends are loaded', () => {
    expect(find('trends-loading')).not.toBeNull();
    expect(find('cards')).toBeNull();
  });

  it('shows the cards once loaded', async () => {
    await set({ loaded: true });

    expect(find('cards')).not.toBeNull();
    expect(find('trends-loading')).toBeNull();
  });

  it('shows an error with Try again instead of the cards', async () => {
    await set({ error: true, loaded: true });

    expect(find('trends-error')!.textContent).toContain(en.trends.loadError);
    expect(find('cards')).toBeNull();

    find('trends-retry')!.click();
    expect(fixture.componentInstance.retries).toBe(1);
  });
});
