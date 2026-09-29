import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { translocoTesting } from '../../testing/transloco-testing';
import { DateTimePipe, formatDateTime } from './date-time';

const ISO = '2026-09-20T08:30:00Z';
const expected = (lang: string) =>
  new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ISO));

@Component({
  imports: [DateTimePipe, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span>{{ 'invitations.expires' | transloco: { date: iso | nalaDateTime } }}</span>`,
})
class Host {
  readonly iso = ISO;
}

describe('formatDateTime', () => {
  it.each(['en', 'fr'])('formats a date-time with medium date and short time in %s', (lang) => {
    expect(formatDateTime(ISO, lang)).toBe(expected(lang));
  });
});

describe('DateTimePipe', () => {
  it('formats in the language the app shows and follows a change', async () => {
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const text = () => (fixture.nativeElement as HTMLElement).textContent;
    expect(text()).toContain(expected('en'));

    TestBed.inject(TranslocoService).setActiveLang('fr');
    await fixture.whenStable();
    expect(text()).toContain(expected('fr'));
  });
});
