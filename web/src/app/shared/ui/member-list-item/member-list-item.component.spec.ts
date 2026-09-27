import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatListModule } from '@angular/material/list';
import en from '../../../../../public/i18n/en.json';
import { translocoTesting } from '../../../testing/transloco-testing';
import { MemberListItemComponent } from './member-list-item.component';

@Component({
  imports: [MatListModule, MemberListItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-list>
      <nala-member-list-item displayName="Ben" email="ben@mail.com" [isAdmin]="isAdmin()">
        <span memberDetail data-testid="detail">Disabled</span>
        <button memberAction data-testid="action">Enable</button>
      </nala-member-list-item>
    </mat-list>
  `,
})
class Host {
  readonly isAdmin = signal(false);
}

describe('MemberListItemComponent', () => {
  const render = async (isAdmin = false) => {
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.isAdmin.set(isAdmin);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('shows the display name as the headline and the email below, in a Material list item', async () => {
    const host = await render();
    expect(host.querySelector('mat-list-item [matListItemTitle]')?.textContent).toContain('Ben');
    expect(host.querySelector('mat-list-item [data-testid="email"]')?.textContent?.trim()).toBe(
      'ben@mail.com',
    );
  });

  it('shows the admin badge only for the admin', async () => {
    expect((await render(false)).querySelector('[data-testid="admin-badge"]')).toBeNull();

    TestBed.resetTestingModule();
    const host = await render(true);
    expect(host.querySelector('[data-testid="admin-badge"]')?.textContent?.trim()).toBe(
      en.members.admin,
    );
  });

  it('projects a detail line and a trailing action', async () => {
    const host = await render();
    expect(host.querySelector('mat-list-item [data-testid="detail"]')).not.toBeNull();
    expect(
      host.querySelector('mat-list-item [matListItemMeta] [data-testid="action"]'),
    ).not.toBeNull();
  });
});
