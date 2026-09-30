import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgComponentOutlet, AsyncPipe } from '@angular/common';
import { LoadComponentPipe } from './load-component.pipe';
import { ComponentLoader } from './section.models';

@Component({
  selector: 'nala-loaded',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<p data-testid="loaded">loaded</p>',
})
class Loaded {}

@Component({
  imports: [AsyncPipe, LoadComponentPipe, NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-container *ngComponentOutlet="(loader() | nalaLoadComponent | async) ?? null" />`,
})
class Host {
  readonly loader = signal<ComponentLoader>(() => Promise.resolve(Loaded));
}

describe('LoadComponentPipe', () => {
  it('renders the component once it is loaded, loading it once', async () => {
    const loader = vi.fn(() => Promise.resolve(Loaded));
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.loader.set(loader);

    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('[data-testid="loaded"]'),
      ).toBeTruthy();
    });
    fixture.detectChanges();
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
