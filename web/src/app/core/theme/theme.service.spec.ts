import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

const KEY = 'nala.theme';

describe('ThemeService', () => {
  const root = document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    root.style.colorScheme = '';
    TestBed.resetTestingModule();
  });

  afterEach(() => vi.restoreAllMocks());

  it('defaults to system when nothing is stored', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.mode()).toBe('system');
    expect(root.style.colorScheme).toBe('light dark');
  });

  it('applies the stored mode at start', () => {
    localStorage.setItem(KEY, 'dark');
    const theme = TestBed.inject(ThemeService);
    expect(theme.mode()).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
  });

  it('setMode("light") applies and stores it', () => {
    const theme = TestBed.inject(ThemeService);
    theme.setMode('light');
    expect(theme.mode()).toBe('light');
    expect(root.style.colorScheme).toBe('light');
    expect(localStorage.getItem(KEY)).toBe('light');
  });

  it('setMode("system") follows the system preference again', () => {
    localStorage.setItem(KEY, 'dark');
    const theme = TestBed.inject(ThemeService);
    theme.setMode('system');
    expect(theme.mode()).toBe('system');
    expect(root.style.colorScheme).toBe('light dark');
    expect(localStorage.getItem(KEY)).toBe('system');
  });

  it('ignores an invalid stored value', () => {
    localStorage.setItem(KEY, 'purple');
    const theme = TestBed.inject(ThemeService);
    expect(theme.mode()).toBe('system');
    expect(root.style.colorScheme).toBe('light dark');
  });

  it('still works when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const theme = TestBed.inject(ThemeService);
    expect(theme.mode()).toBe('system');
    expect(() => theme.setMode('dark')).not.toThrow();
    expect(theme.mode()).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
  });
});
