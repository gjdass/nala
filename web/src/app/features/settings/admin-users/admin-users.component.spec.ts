import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import {
  AdminUser,
  AdminUserResult,
  AdminUsersResult,
  ResetLinkResult,
} from '../../../core/admin/admin.models';
import { AdminService } from '../../../core/admin/admin.service';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ShareLinkDialogComponent } from '../../../shared/ui/share-link-dialog/share-link-dialog.component';
import { translocoTesting } from '../../../testing/transloco-testing';
import { AdminUsersComponent } from './admin-users.component';

describe('AdminUsersComponent', () => {
  let fixture: ComponentFixture<AdminUsersComponent>;
  let admin: {
    users: ReturnType<typeof vi.fn>;
    setDisabled: ReturnType<typeof vi.fn>;
    createResetLink: ReturnType<typeof vi.fn>;
  };
  let updated: Subject<AdminUserResult>;
  let resetLink: Subject<ResetLinkResult>;
  let dialogClosed: Subject<boolean | undefined>;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };

  const anna: AdminUser = {
    id: 'u1',
    email: 'anna@mail.com',
    displayName: 'Anna',
    isAdmin: true,
    isDisabled: false,
    lastActivityAt: '2026-09-27T20:00:00Z',
  };
  const ben: AdminUser = {
    id: 'u2',
    email: 'ben@mail.com',
    displayName: 'Ben',
    isAdmin: false,
    isDisabled: false,
    lastActivityAt: '2026-09-20T08:30:00Z',
  };
  const chloe: AdminUser = {
    id: 'u3',
    email: 'chloe@mail.com',
    displayName: 'Chloe',
    isAdmin: false,
    isDisabled: true,
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
    updated = new Subject<AdminUserResult>();
    resetLink = new Subject<ResetLinkResult>();
    admin = {
      users: vi.fn(),
      setDisabled: vi.fn(() => updated),
      createResetLink: vi.fn(() => resetLink),
    };
    dialogClosed = new Subject<boolean | undefined>();
    dialog = { open: vi.fn(() => ({ afterClosed: () => dialogClosed })) };
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

  it('lists every user with name, email, admin badge, disabled status and last activity', async () => {
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
    expect(row('Ben').textContent).not.toContain(en.settings.admin.disabled);
    expect(row('Chloe').textContent).toContain(en.settings.admin.disabled);
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

  it('offers Reset link and Disable for an enabled member', async () => {
    await render();
    await openMenu('Ben');

    expect(menuItem('reset-link')?.textContent?.trim()).toBe(en.settings.admin.resetLink);
    expect(menuItem('toggle')?.textContent?.trim()).toBe(en.settings.admin.disable);
  });

  it('offers only Enable for a disabled member', async () => {
    await render();
    await openMenu('Chloe');

    expect(menuItem('reset-link')).toBeNull();
    expect(menuItem('toggle')?.textContent?.trim()).toBe(en.settings.admin.enable);
  });

  it('shows an error when the list cannot be loaded', async () => {
    await render({ ok: false, errors: { form: 'unknown' } });

    expect(rows()).toEqual([]);
    expect(host().querySelector('[data-testid="load-error"]')?.textContent?.trim()).toBe(
      en.auth.errors.form.unknown,
    );
  });

  describe('disable', () => {
    it('asks for confirmation first', async () => {
      await render();
      await pick('Ben', 'toggle');

      expect(dialog.open).toHaveBeenCalledWith(ConfirmDialogComponent, {
        data: {
          title: en.settings.admin.disableTitle.replace('{{name}}', 'Ben'),
          text: en.settings.admin.disableText.replace('{{name}}', 'Ben'),
          confirm: en.settings.admin.confirm,
          cancel: en.settings.admin.cancel,
        },
      });
      expect(admin.setDisabled).not.toHaveBeenCalled();
    });

    it('does nothing when cancelled', async () => {
      await render();
      await pick('Ben', 'toggle');
      dialogClosed.next(false);
      await fixture.whenStable();

      expect(admin.setDisabled).not.toHaveBeenCalled();
    });

    it('disables once confirmed, updates the row and confirms with a snackbar', async () => {
      await render();
      await pick('Ben', 'toggle');
      dialogClosed.next(true);
      await fixture.whenStable();

      expect(admin.setDisabled).toHaveBeenCalledWith('u2', true);
      updated.next({ ok: true, user: { ...ben, isDisabled: true } });
      await fixture.whenStable();

      expect(row('Ben').textContent).toContain(en.settings.admin.disabled);
      expect(snackBar.open).toHaveBeenCalledWith(
        en.settings.admin.disabledDone.replace('{{name}}', 'Ben'),
        undefined,
        { duration: 3000 },
      );
    });

    it('shows the refusal in a snackbar and leaves the row unchanged', async () => {
      await render();
      await pick('Ben', 'toggle');
      dialogClosed.next(true);
      await fixture.whenStable();
      updated.next({ ok: false, errors: { form: 'userNotFound' } });
      await fixture.whenStable();

      expect(row('Ben').textContent).not.toContain(en.settings.admin.disabled);
      expect(snackBar.open).toHaveBeenCalledWith(en.auth.errors.form.userNotFound, undefined, {
        duration: 3000,
      });
    });
  });

  describe('enable', () => {
    it('enables right away, updates the row and confirms with a snackbar', async () => {
      await render();
      await pick('Chloe', 'toggle');

      expect(dialog.open).not.toHaveBeenCalled();
      expect(admin.setDisabled).toHaveBeenCalledWith('u3', false);
      updated.next({ ok: true, user: { ...chloe, isDisabled: false } });
      await fixture.whenStable();

      expect(row('Chloe').textContent).not.toContain(en.settings.admin.disabled);
      expect(snackBar.open).toHaveBeenCalledWith(
        en.settings.admin.enabledDone.replace('{{name}}', 'Chloe'),
        undefined,
        { duration: 3000 },
      );
    });
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
      resetLink.next({ ok: false, errors: { form: 'accountDisabled' } });
      await fixture.whenStable();

      expect(dialog.open).not.toHaveBeenCalled();
      expect(snackBar.open).toHaveBeenCalledWith(en.auth.errors.form.accountDisabled, undefined, {
        duration: 3000,
      });
    });
  });
});
