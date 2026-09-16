# Landfall — app icons, drawn from the corpus rather than invented.
#
#   python build/make-icons.py
#
# The mark is Hispaniola as Natural Earth actually draws it, taken straight out
# of app/data/maps/caribbean.json, with Puerto Rico as a coral dot beside it.
# Tried the whole Greater Antilles first and it was too thin to read at 48px:
# Cuba is a hairline at icon scale. One chunky island plus one mark survives the
# shrink, and the icon is still made of the thing the app is about.

import json, re, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP = os.path.join(ROOT, 'app', 'data', 'maps', 'caribbean.json')
OUT = os.path.join(ROOT, 'app', 'icons')
os.makedirs(OUT, exist_ok=True)

DEEP = (11, 46, 48)
SAND = (244, 237, 224)
CORAL = (224, 96, 60)

MAIN = ['c:HT', 'c:DO']
ARC = ['c:PR']

data = json.load(open(MAP, encoding='utf-8'))
feats = data['f']


def rings(d):
    """Path strings here are only ever M x y L x y … Z, so a real parser is
    unnecessary — but anything unexpected is skipped rather than guessed at."""
    out = []
    for chunk in d.split('M'):
        chunk = chunk.strip()
        if not chunk:
            continue
        nums = [float(n) for n in re.findall(r'-?\d+(?:\.\d+)?', chunk)]
        pts = list(zip(nums[0::2], nums[1::2]))
        if len(pts) >= 3:
            out.append(pts)
    return out


def collect(ids):
    got = []
    for i in ids:
        f = feats.get(i)
        if not f or not f.get('d'):
            continue
        got.extend(rings(f['d']))
    return got


main = collect(MAIN)
arc = collect(ARC)
if not main:
    raise SystemExit('no geometry found — did build.mjs run?')

xs = [p[0] for r in main for p in r]
ys = [p[1] for r in main for p in r]
bx0, bx1, by0, by1 = min(xs), max(xs), min(ys), max(ys)


def render(size, pad_frac):
    """pad_frac is the share of the canvas kept clear. Maskable icons get a
    generous one because launchers crop to a circle."""
    img = Image.new('RGB', (size * 4, size * 4), DEEP)
    dr = ImageDraw.Draw(img)
    S = size * 4
    pad = S * pad_frac
    w, h = bx1 - bx0, by1 - by0
    k = min((S - 2 * pad) / w, (S - 2 * pad) / h)
    ox = (S - w * k) / 2 - bx0 * k
    oy = (S - h * k) / 2 - by0 * k

    def xy(r):
        return [(p[0] * k + ox, p[1] * k + oy) for p in r]

    for r in arc:
        pts = xy(r)
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        rr = max(S * 0.022, 3)
        dr.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=CORAL)
    for r in sorted(main, key=lambda r: -len(r)):
        dr.polygon(xy(r), fill=SAND)
    return img.resize((size, size), Image.LANCZOS)


for size in (192, 512):
    render(size, 0.09).save(os.path.join(OUT, f'icon-{size}.png'))
render(512, 0.22).save(os.path.join(OUT, 'icon-maskable-512.png'))
render(180, 0.09).save(os.path.join(OUT, 'apple-touch-icon.png'))
print('icons written to app/icons')
