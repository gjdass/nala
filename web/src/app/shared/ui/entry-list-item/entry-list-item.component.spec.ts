import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatListModule } from '@angular/material/list';
import { translocoTesting } from '../../../testing/transloco-testing';
import { EntryListItemComponent } from './entry-list-item.component';

const TIME = new Date(2026, 8, 28, 14, 10).toISOString();

@Component({
  imports: [EntryListItemComponent, MatListModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<mat-action-list>
    <nala-entry-list-item
      icon="baby_changing_station"
      [time]="time"
      [dateOnly]="dateOnly()"
      [label]="label()"
      [summary]="summary()"
      (open)="opened = opened + 1"
    />
  </mat-action-list>`,
})
class Host {
  readonly time = TIME;
  readonly dateOnly = signal(false);
  readonly label = signal('');
  readonly summary = signal('L 5m · R 3m 30s');
  opened = 0;
}

describe('EntryListItemComponent', () => {
  let fixture: ComponentFixture<Host>;

  const host = () => fixture.nativeElement as HTMLElement;
  const find = (testId: string) => host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const text = (testId: string) => find(testId)?.textContent?.trim();

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(2026, 8, 28, 18, 0));
    await TestBed.configureTestingModule({
      imports: [Host, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  afterEach(() => vi.useRealTimers());

  it('shows the kind icon, the local time, the summary and a chevron', () => {
    expect(text('entry-icon')).toBe('baby_changing_station');
    expect(text('entry-time')).toBe(
      new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(new Date(TIME)),
    );
    expect(text('entry-summary')).toBe('L 5m · R 3m 30s');
    expect(text('entry-chevron')).toBe('chevron_right');
  });

  it('shows the date instead of the time for an entry dated without a time (spec 10)', async () => {
    fixture.componentInstance.dateOnly.set(true);
    await fixture.whenStable();

    expect(text('entry-time')).toBe('Today');
  });

  const item = () => host().querySelector('button[mat-list-item]')!;

  it("wraps the chevron in the trailing meta, so the two-line item's baseline strut doesn't clip it", () => {
    const chevron = host().querySelector('[data-testid="entry-chevron"]')!;
    expect(chevron.hasAttribute('matListItemMeta')).toBe(false);
    expect(chevron.parentElement!.hasAttribute('matListItemMeta')).toBe(true);
  });
  const headline = () =>
    item().querySelector('[matListItemTitle]')!.textContent!.replace(/\s+/g, ' ').trim();

  it('shows no duration bar', () => {
    expect(find('entry-bar')).toBeNull();
    expect(find('entry-duration')).toBeNull();
  });

  it('shows only the time in the headline without a label', () => {
    expect(find('entry-label')).toBeNull();
    expect(headline()).toBe(text('entry-time'));
  });

  it('shows the time, then the label after " · " in the headline', async () => {
    fixture.componentInstance.label.set('Lunch · Liked');
    await fixture.whenStable();

    expect(text('entry-label')).toBe('Lunch · Liked');
    expect(headline()).toBe(`${text('entry-time')} · Lunch · Liked`);
  });

  it('is always a two-line item, with the summary on one line aligned with the headline', async () => {
    for (const label of ['', 'Lunch · Liked']) {
      fixture.componentInstance.label.set(label);
      fixture.componentInstance.summary.set('A very long food description '.repeat(10));
      await fixture.whenStable();

      expect(item().classList).toContain('mdc-list-item--with-two-lines');
      expect(item().classList).not.toContain('mdc-list-item--with-three-lines');
      expect(find('entry-summary')?.closest('[matListItemLine]')).toBeTruthy();
    }
  });

  it('emits open when tapped', () => {
    host().querySelector<HTMLButtonElement>('button[mat-list-item]')!.click();

    expect(fixture.componentInstance.opened).toBe(1);
  });
});
