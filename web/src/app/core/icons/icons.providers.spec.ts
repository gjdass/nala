import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatIconRegistry } from '@angular/material/icon';
import { provideNalaIcons } from './icons.providers';

describe('provideNalaIcons', () => {
  it('makes mat-icon use the bundled Material Symbols font', async () => {
    TestBed.configureTestingModule({ providers: [provideNalaIcons()] });
    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(TestBed.inject(MatIconRegistry).getDefaultFontSetClass()).toEqual([
      'material-symbols-outlined',
    ]);
  });
});
