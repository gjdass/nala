import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import en from '../../../../../public/i18n/en.json';
import { CurrentFamilyService } from '../../../core/families/current-family.service';
import { Family } from '../../../core/families/family.models';
import { translocoTesting } from '../../../testing/transloco-testing';
import { RenameFamilyDialogComponent } from '../rename-family-dialog/rename-family-dialog.component';
import { SettingsFamilyComponent } from './settings-family.component';

describe('SettingsFamilyComponent', () => {
  let fixture: ComponentFixture<SettingsFamilyComponent>;
  let families: {
    current: ReturnType<typeof signal<Family | null>>;
    refresh: ReturnType<typeof vi.fn>;
  };
  let dialogClosed: Subject<Family | undefined>;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };

  const martins: Family = { id: 'f1', name: 'Martins', isAdmin: true };

  const host = () => fixture.nativeElement as HTMLElement;
  const rename = () => host().querySelector<HTMLButtonElement>('[data-testid="rename-family"]');
  const closeDialog = async (result?: Family) => {
    dialogClosed.next(result);
    dialogClosed.complete();
    await fixture.whenStable();
  };

  const create = async (current: Family) => {
    families.current.set(current);
    fixture = TestBed.createComponent(SettingsFamilyComponent);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    families = {
      current: signal<Family | null>(null),
      refresh: vi.fn(),
    };
    dialogClosed = new Subject<Family | undefined>();
    dialog = { open: vi.fn(() => ({ afterClosed: () => dialogClosed })) };
    snackBar = { open: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [SettingsFamilyComponent, translocoTesting()],
      providers: [
        { provide: CurrentFamilyService, useValue: families },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();
  });

  it("shows the current family's name", async () => {
    await create(martins);

    expect(host().querySelector('[data-testid="family-name"]')?.textContent?.trim()).toBe(
      'Martins',
    );
  });

  it('offers Rename to the family admin only', async () => {
    await create(martins);
    expect(rename()?.textContent?.trim()).toBe(en.families.rename.open);

    await create({ ...martins, isAdmin: false });
    expect(rename()).toBeNull();
  });

  it('opens the rename dialog with the current family', async () => {
    await create(martins);

    rename()!.click();

    expect(dialog.open).toHaveBeenCalledWith(RenameFamilyDialogComponent, {
      data: { family: martins },
    });
  });

  it('reloads the families and confirms once renamed', async () => {
    await create(martins);
    rename()!.click();

    await closeDialog({ ...martins, name: 'The Martins' });

    expect(families.refresh).toHaveBeenCalledOnce();
    expect(snackBar.open).toHaveBeenCalledWith(en.families.rename.done, undefined, {
      duration: 3000,
    });
  });

  it('does nothing when the dialog is cancelled', async () => {
    await create(martins);
    rename()!.click();

    await closeDialog();

    expect(families.refresh).not.toHaveBeenCalled();
    expect(snackBar.open).not.toHaveBeenCalled();
  });
});
