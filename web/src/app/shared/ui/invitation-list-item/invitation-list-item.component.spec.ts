import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatListModule } from '@angular/material/list';
import en from '../../../../../public/i18n/en.json';
import { formatDateTime } from '../../../core/i18n/date-time';
import { translocoTesting } from '../../../testing/transloco-testing';
import { InvitationListItemComponent } from './invitation-list-item.component';

const EXPIRES = '2026-10-04T20:00:00Z';

@Component({
  imports: [MatListModule, InvitationListItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-list>
      <nala-invitation-list-item createdBy="Anna" expiresAt="${EXPIRES}">
        <button invitationAction data-testid="action">Revoke</button>
      </nala-invitation-list-item>
    </mat-list>
  `,
})
class Host {}

describe('InvitationListItemComponent', () => {
  const render = async () => {
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('shows who created it as the headline and when it expires below, in a Material list item', async () => {
    const host = await render();

    expect(host.querySelector('mat-list-item [matListItemTitle]')?.textContent?.trim()).toBe(
      en.invitations.invitedBy.replace('{{name}}', 'Anna'),
    );
    expect(host.querySelector('mat-list-item [data-testid="expires"]')?.textContent?.trim()).toBe(
      en.invitations.expires.replace('{{date}}', formatDateTime(EXPIRES, 'en')),
    );
  });

  it('projects a trailing action', async () => {
    const host = await render();

    expect(
      host.querySelector('mat-list-item [matListItemMeta] [data-testid="action"]'),
    ).not.toBeNull();
  });
});
