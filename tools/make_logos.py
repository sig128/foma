"""Rebuild logos.json: token logos (96 px WebP data URIs) and wallet logos (SVG data URIs).

Usage: python3 tools/make_logos.py <png_dir> <web3icons_core_pkg_dir> <out.json>
  png_dir                one PNG per token, named by symbol (for example from Trust Wallet assets, by mint)
  web3icons_core_pkg_dir an unpacked @web3icons/core npm package (wallets/branded/*.svg.js)
Needs Pillow.
"""
import sys, os, io, base64, json, re
from PIL import Image
src, pkg, out = sys.argv[1], sys.argv[2], sys.argv[3]
res = {}
for f in sorted(os.listdir(src)):
    if not f.endswith('.png'): continue
    k = f[:-4]
    im = Image.open(os.path.join(src, f)).convert('RGBA')
    im.thumbnail((96, 96), Image.LANCZOS)
    canvas = Image.new('RGBA', (96, 96), (0, 0, 0, 0))
    canvas.paste(im, ((96 - im.width)//2, (96 - im.height)//2), im)
    b = io.BytesIO(); canvas.save(b, 'WEBP', quality=86, method=6)
    res[k] = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
wallets = {}
for w in ['phantom', 'solflare', 'backpack']:
    t = open(os.path.join(pkg, 'wallets', 'branded', w + '.svg.js'), encoding='utf8').read()
    parts = re.findall(r"'((?:[^'\\]|\\.)*)'", t)
    svg = ''.join(parts).replace('\\n', '\n').replace("\\'", "'")
    svg = re.sub(r'\s+class="[^"]*"', '', svg)
    if not svg.strip().startswith('<svg') or '<script' in svg.lower(): raise SystemExit('bad svg ' + w)
    wallets[w] = 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode()).decode()
json.dump({'tokens': res, 'wallets': wallets}, open(out, 'w'))
print({k: len(v) for k, v in res.items()}, {k: len(v) for k, v in wallets.items()})
