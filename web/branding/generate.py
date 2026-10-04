"""Generates the PWA images in web/public/ from the source artwork in this folder.

Run from web/: python3 branding/generate.py  (needs Pillow: pip install pillow)
"""
from pathlib import Path

from PIL import Image, ImageFilter

SRC = Path(__file__).parent
PUBLIC = SRC.parent / 'public'

# iPhone screens in portrait: CSS width, CSS height, pixel ratio. Matches the
# apple-touch-startup-image links in src/index.html.
IPHONES = [
    (440, 956, 3),  # 16 Pro Max, 17 Pro Max
    (402, 874, 3),  # 16 Pro, 17, 17 Pro
    (420, 912, 3),  # Air
    (430, 932, 3),  # 14 Pro Max, 15 Plus / Pro Max, 16 Plus
    (393, 852, 3),  # 14 Pro, 15, 15 Pro, 16, 16e
    (428, 926, 3),  # 12 / 13 Pro Max, 14 Plus
    (390, 844, 3),  # 12, 12 Pro, 13, 13 Pro, 14
    (375, 812, 3),  # X, XS, 11 Pro, 12 mini, 13 mini
    (414, 896, 3),  # XS Max, 11 Pro Max
    (414, 896, 2),  # XR, 11
    (414, 736, 3),  # 6+ / 7+ / 8 Plus
    (375, 667, 2),  # 6 / 7 / 8, SE 2nd and 3rd gen
]


def cover(image, width, height):
    """Scales and centre-crops the image to fill width × height."""
    scale = max(width / image.width, height / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    left, top = (resized.width - width) // 2, (resized.height - height) // 2
    return resized.crop((left, top, left + width, top + height))


def main():
    icons = PUBLIC / 'icons'
    splash_dir = PUBLIC / 'splash'
    icons.mkdir(exist_ok=True)
    splash_dir.mkdir(exist_ok=True)

    icon = Image.open(SRC / 'icon.png').convert('RGB')
    for size, name in [(180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
        icon.resize((size, size), Image.LANCZOS).save(icons / name, optimize=True)

    # Maskable: Android keeps only the centre circle (80 % of the width). The icon is shrunk
    # into it, over a blurred enlargement of itself so the gradient continues to the edges.
    background = cover(icon, 1400, 1400).resize((512, 512), Image.LANCZOS)
    background = background.filter(ImageFilter.GaussianBlur(24))
    inner = round(512 * 0.78)
    background.paste(icon.resize((inner, inner), Image.LANCZOS), ((512 - inner) // 2,) * 2)
    background.save(icons / 'icon-maskable-512.png', optimize=True)

    # Favicon: the lion's head, the whole artwork is unreadable at tab size.
    lion = Image.open(SRC / 'lion-on-grass.jpeg').convert('RGB')
    head = lion.crop((560, 280, 1500, 1220))
    for size in (16, 32):
        head.resize((size, size), Image.LANCZOS).save(icons / f'favicon-{size}.png', optimize=True)
    head.resize((48, 48), Image.LANCZOS).save(PUBLIC / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])

    splash = Image.open(SRC / 'splash.jpeg').convert('RGB')
    for width, height, ratio in IPHONES:
        w, h = width * ratio, height * ratio
        cover(splash, w, h).save(splash_dir / f'splash-{w}x{h}.jpg', quality=80, optimize=True, progressive=True)


if __name__ == '__main__':
    main()
