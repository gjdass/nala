import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { AdminUser, AdminUsersResult, ResetLinkResult } from '../../../core/admin/admin.models';
import { AdminService } from '../../../core/admin/admin.service';
import { ShareLinkDialogComponent } from '../../../shared/ui/share-link-dialog/share-link-dialog.component';
import { translocoTesting } from '../../../testing/transloco-testing';
import { AdminUsersComponent } from './admin-users.component';

describe('AdminUsersComponent', () => {
  let fixture: ComponentFixture<AdminUsersComponent>;
  let admin: {
    users: ReturnType<typeof vi.fn>;
    createResetLink: ReturnType<typeof vi.fn>;
  };
  let resetLink: Subject<ResetLinkResult>;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };

  const anna: AdminUser = {
    id: 'u1',
    email: 'anna@mail.com',
    displayName: 'Anna',
    isAdmin: true,
    lastActivityAt: '2026-09-27T20:00:00Z',
  };
  const ben: AdminUser = {
    id: 'u2',
    email: 'ben@mail.com',
    displayName: 'Ben',
    isAdmin: false,
    lastActivityAt: '2026-09-20T08:30:00Z',
  };
  const chloe: AdminUser = {
    id: 'u3',
    email: 'chloe@mail.com',
    displayName: 'Chloe',
    isAdmin: false,
    lastActivityAt: null,
  };

  const host = () => fixture.nativeElement as HTMLElement;
  const rows = () => [...host().querySelectorAll<HTMLElement>('nala-member-list-item')];
  const row = (name: string) => rows().find((r) => r.textContent?.includes(name))!;
  /** The row's ⋮ button, which opens its actions menu. */
  const actions = (name: string) =>
    row(name).querySelector<HTMLButtonElement>('button[data-testid="actions"]');
  /** Menu items render in the overlay, outside the component. */
  const menuItem = (id: string) =>
    document.querySelector<HTMLButtonElement>(`.mat-mdc-menu-panel [data-testid="${id}"]`);
  const openMenu = async (name: string) => {
    actions(name)!.click();
    await fixture.whenStable();
  };
  const menuItems = () => [...document.querySelectorAll('.mat-mdc-menu-panel [mat-menu-item]')];
  /** Opens the row's menu and picks an item. */
  const pick = async (name: string, id: string) => {
    await openMenu(name);
    await click(menuItem(id)!);
  };
  const formatted = (iso: string) =>
    new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  const click = async (element: HTMLElement) => {
    element.click();
    await fixture.whenStable();
  };

  const render = async (result: AdminUsersResult = { ok: true, users: [anna, ben, chloe] }) => {
    admin.users.mockReturnValue(of(result));
    fixture = TestBed.createComponent(AdminUsersComponent);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    resetLink = new Subject<ResetLinkResult>();
    admin = {
      users: vi.fn(),
      createResetLink: vi.fn(() => resetLink),
    };
    dialog = { open: vi.fn() };
    snackBar = { open: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AdminUsersComponent, translocoTesting()],
      providers: [
        { provide: AdminService, useValue: admin },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();
  });

  it('lists every user with name, email, admin badge and last activity', async () => {
    await render();

    expect(rows().map((r) => r.querySelector('[matListItemTitle]')?.textContent?.trim())).toEqual([
      expect.stringContaining('Anna'),
      expect.stringContaining('Ben'),
      expect.stringContaining('Chloe'),
    ]);
    expect(row('Ben').textContent).toContain('ben@mail.com');
    expect(row('Anna').querySelector('[data-testid="admin-badge"]')).not.toBeNull();
    expect(row('Ben').querySelector('[data-testid="admin-badge"]')).toBeNull();
    expect(row('Ben').textContent).toContain(
      en.settings.admin.lastActive.replace('{{date}}', formatted(ben.lastActivityAt!)),
    );
    expect(row('Chloe').textContent).toContain(en.settings.admin.noActivity);
  });

  it('has an actions menu, named for the user, on every row but the admin', async () => {
    await render();

    expect(actions('Anna')).toBeNull();
    expect(actions('Ben')?.getAttribute('aria-label')).toBe(
      en.settings.admin.actions.replace('{{name}}', 'Ben'),
    );
    expect(actions('Chloe')).not.toBeNull();
  });

  it('offers only Reset link', async () => {
    await render();
    await openMenu('Ben');

    expect(menuItems().map((item) => item.textContent?.trim())).toEqual([
      en.settings.admin.resetLink,
    ]);
  });

  it('shows an error when the list cannot be loaded', async () => {
    await render({ ok: false, errors: { form: 'unknown' } });

    expect(rows()).toEqual([]);
    expect(host().querySelector('[data-testid="load-error"]')?.textContent?.trim()).toBe(
      en.auth.errors.form.unknown,
    );
  });

  describe('reset link', () => {
    const expiresAt = '2026-09-28T20:00:00Z';

    it('creates a link and opens the share dialog with its url and expiry', async () => {
      await render();
      await pick('Ben', 'reset-link');

      expect(admin.createResetLink).toHaveBeenCalledWith('u2');
      resetLink.next({ ok: true, link: { token: 'a-b_c', expiresAt } });
      await fixture.whenStable();

      expect(dialog.open).toHaveBeenCalledWith(ShareLinkDialogComponent, {
        data: {
          title: en.settings.admin.resetLinkTitle.replace('{{name}}', 'Ben'),
          text: en.settings.admin.resetLinkText
            .replace('{{name}}', 'Ben')
            .replace('{{date}}', formatted(expiresAt)),
          url: `${location.origin}/reset/a-b_c`,
        },
      });
    });

    it('shows a refusal in a snackbar', async () => {
      await render();
      await pick('Ben', 'reset-link');
      resetLink.next({ ok: false, errors: { form: 'userNotFound' } });
      await fixture.whenStable();

      expect(dialog.open).not.toHaveBeenCalled();
      expect(snackBar.open).toHaveBeenCalledWith(en.auth.errors.form.userNotFound, undefined, {
        duration: 3000,
      });
    });
  });
});
