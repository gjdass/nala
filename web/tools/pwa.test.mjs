import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const indexHtml = readFileSync(fileURLToPath(new URL('../src/index.html', import.meta.url)), 'utf8');

const read = (path) => readFileSync(publicDir + path);

function pngSize(path) {
  const png = read(path);
  assert.equal(png.toString('ascii', 1, 4), 'PNG', `${path} is a PNG`);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20), colorType: png[25] };
}

function jpegSize(path) {
  const jpg = read(path);
  assert.equal(jpg.readUInt16BE(0), 0xffd8, `${path} is a JPEG`);
  let offset = 2;
  while (offset < jpg.length) {
    const marker = jpg.readUInt16BE(offset);
    if (marker >= 0xffc0 && marker <= 0xffc3) {
      return { width: jpg.readUInt16BE(offset + 7), height: jpg.readUInt16BE(offset + 5) };
    }
    offset += 2 + jpg.readUInt16BE(offset + 2);
  }
  throw new Error(`${path}: no frame header`);
}

// Every <link> tag of index.html, as attribute maps.
const links = [...indexHtml.matchAll(/<link\s[^>]*>/g)].map(([tag]) =>
  Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v])),
);
const meta = (name) => indexHtml.match(new RegExp(`<meta name="${name}" content="([^"]*)"`))?.[1];

describe('PWA install on iOS (index.html)', () => {
  it('links a 180 × 180 opaque apple-touch-icon', () => {
    const link = links.find((l) => l.rel === 'apple-touch-icon');
    assert.ok(link, 'apple-touch-icon link');
    const { width, height, colorType } = pngSize(link.href);
    assert.deepEqual([width, height], [180, 180]);
    assert.ok(![4, 6].includes(colorType), 'no alpha channel: iOS fills transparency with black');
  });

  it('draws edge to edge, so the app handles the safe areas itself', () => {
    assert.match(meta('viewport') ?? '', /(^|,\s*)viewport-fit=cover(,|$)/);
  });

  it('never zooms: the viewport sets maximum-scale=1 and user-scalable=no (spec 04)', () => {
    const viewport = meta('viewport') ?? '';
    assert.match(viewport, /(^|,\s*)maximum-scale=1(,|$)/);
    assert.match(viewport, /(^|,\s*)user-scalable=no(,|$)/);
    assert.match(viewport, /(^|,\s*)viewport-fit=cover(,|$)/);
  });

  it('opens standalone, titled Nala, with a theme colour', () => {
    assert.equal(meta('apple-mobile-web-app-capable'), 'yes');
    assert.equal(meta('mobile-web-app-capable'), 'yes');
    assert.equal(meta('apple-mobile-web-app-title'), 'Nala');
    assert.ok(meta('apple-mobile-web-app-status-bar-style'));
    assert.match(meta('theme-color') ?? '', /^#[0-9a-f]{6}$/i);
  });

  it('links a launch screen for every iPhone, each the device size in portrait', () => {
    const splashes = links.filter((l) => l.rel === 'apple-touch-startup-image');
    assert.ok(splashes.length >= 10, 'one per iPhone screen size');
    for (const { href, media } of splashes) {
      const [, w, h, dpr] = media.match(
        /\(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: portrait\)/,
      );
      assert.deepEqual(jpegSize(href), { width: w * dpr, height: h * dpr }, href);
    }
  });
});

describe('browser favicon', () => {
  it('links PNG favicons at 16 and 32 px', () => {
    for (const size of [16, 32]) {
      const link = links.find((l) => l.rel === 'icon' && l.sizes === `${size}x${size}`);
      assert.ok(link, `${size}px favicon link`);
      assert.deepEqual(Object.values(pngSize(link.href)).slice(0, 2), [size, size]);
    }
  });

  it('ships a favicon.ico holding 16, 32 and 48 px images', () => {
    const ico = read('favicon.ico');
    assert.equal(ico.readUInt16LE(2), 1, 'icon type');
    const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico[6 + i * 16]);
    assert.deepEqual(sizes.sort((a, b) => a - b), [16, 32, 48]);
  });
});

describe('brand mark (top app bar)', () => {
  it("ships the lion's head at 72 px, sharp at 3× for its 24 px display", () => {
    assert.deepEqual(Object.values(pngSize('icons/brand-mark.png')).slice(0, 2), [72, 72]);
  });
});

describe('web app manifest', () => {
  let manifest;

  before(() => {
    manifest = JSON.parse(read('manifest.webmanifest'));
  });

  it('has an id and the icon colours as theme and background', () => {
    assert.equal(manifest.id, '/');
    assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
    assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
    assert.equal(manifest.theme_color, meta('theme-color'));
  });

  it('lists 192 and 512 px "any" icons and a 512 px maskable one, all files present at their size', () => {
    const declared = manifest.icons.map((i) => `${i.sizes} ${i.purpose}`).sort();
    assert.deepEqual(declared, ['192x192 any', '512x512 any', '512x512 maskable']);
    for (const { src, sizes } of manifest.icons) {
      assert.ok(existsSync(publicDir + src), src);
      const { width, height } = pngSize(src);
      assert.equal(`${width}x${height}`, sizes, src);
    }
  });
});
