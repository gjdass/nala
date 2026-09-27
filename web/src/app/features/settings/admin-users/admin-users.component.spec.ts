import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { AdminUser, AdminUserResult, AdminUsersResult } from '../../../core/admin/admin.models';
import { AdminService } from '../../../core/admin/admin.service';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { translocoTesting } from '../../../testing/transloco-testing';
import { AdminUsersComponent } from './admin-users.component';

describe('AdminUsersComponent', () => {
  let fixture: ComponentFixture<AdminUsersComponent>;
  let admin: { users: ReturnType<typeof vi.fn>; setDisabled: ReturnType<typeof vi.fn> };
  let updated: Subject<AdminUserResult>;
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
  const action = (name: string) => row(name).querySelector<HTMLButtonElement>('[memberAction]');
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
    admin = { users: vi.fn(), setDisabled: vi.fn(() => updated) };
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

  it('offers Disable for an enabled member, Enable for a disabled one, and nothing for the admin', async () => {
    await render();

    expect(action('Anna')).toBeNull();
    expect(action('Ben')?.textContent?.trim()).toBe(en.settings.admin.disable);
    expect(action('Chloe')?.textContent?.trim()).toBe(en.settings.admin.enable);
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
      await click(action('Ben')!);

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
      await click(action('Ben')!);
      dialogClosed.next(false);
      await fixture.whenStable();

      expect(admin.setDisabled).not.toHaveBeenCalled();
    });

    it('disables once confirmed, updates the row and confirms with a snackbar', async () => {
      await render();
      await click(action('Ben')!);
      dialogClosed.next(true);
      await fixture.whenStable();

      expect(admin.setDisabled).toHaveBeenCalledWith('u2', true);
      updated.next({ ok: true, user: { ...ben, isDisabled: true } });
      await fixture.whenStable();

      expect(row('Ben').textContent).toContain(en.settings.admin.disabled);
      expect(action('Ben')?.textContent?.trim()).toBe(en.settings.admin.enable);
      expect(snackBar.open).toHaveBeenCalledWith(
        en.settings.admin.disabledDone.replace('{{name}}', 'Ben'),
        undefined,
        { duration: 3000 },
      );
    });

    it('shows the refusal in a snackbar and leaves the row unchanged', async () => {
      await render();
      await click(action('Ben')!);
      dialogClosed.next(true);
      await fixture.whenStable();
      updated.next({ ok: false, errors: { form: 'userNotFound' } });
      await fixture.whenStable();

      expect(action('Ben')?.textContent?.trim()).toBe(en.settings.admin.disable);
      expect(snackBar.open).toHaveBeenCalledWith(en.auth.errors.form.userNotFound, undefined, {
        duration: 3000,
      });
    });
  });

  describe('enable', () => {
    it('enables right away, updates the row and confirms with a snackbar', async () => {
      await render();
      await click(action('Chloe')!);

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
});
