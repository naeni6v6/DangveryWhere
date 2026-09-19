# -*- coding: utf-8 -*-
"""
'미지의 강아지' 실루엣 — 견종을 '기타 / 직접 입력'이나 '믹스 / 잘 모름'으로 둔 아이의 캐릭터.

static/dogs/jindo.webp 의 형태만 빌려, 세부는 지우고 안개 낀 듯한 실루엣으로 만듭니다.
    pip install rembg onnxruntime pillow
    python scripts/mystery-dog.py
→ static/dogs/mystery.webp (640px, 투명) · static/dogs/thumb/mystery.webp (160px, 투명)
"""
import os

from PIL import Image, ImageFilter
from rembg import new_session, remove

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOGS = os.path.join(ROOT, 'static', 'dogs')

src = Image.open(os.path.join(DOGS, 'jindo.webp')).convert('RGB')
alpha = remove(src, session=new_session('u2net'), post_process_mask=True).getchannel('A')
w, h = alpha.size

# 1) 형태를 살짝 뭉개서(안개) 세부를 지웁니다. 위쪽은 연하고 아래쪽으로 갈수록 짙은 색.
mask = alpha.filter(ImageFilter.GaussianBlur(5))
top, bottom = (222, 208, 194), (172, 150, 132)
grad = Image.new('RGB', (w, h))
gp = grad.load()
for y in range(h):
    t = y / (h - 1)
    gp[0, y] = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    for x in range(1, w):
        gp[x, y] = gp[0, y]

# 2) 가운데에 은은한 하이라이트를 올려 종이 오리기가 아니라 부피가 있는 그림자처럼 보이게.
glow = Image.new('L', (w, h), 0)
gl = glow.load()
cx, cy, r = w * 0.52, h * 0.42, w * 0.34
for y in range(h):
    for x in range(w):
        d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / r
        gl[x, y] = round(255 * max(0.0, 1 - d) ** 2 * 0.45)
white = Image.new('RGB', (w, h), (255, 250, 244))
body = Image.composite(white, grad, glow)

out = body.convert('RGBA')
out.putalpha(mask.point(lambda a: round(a * 0.92)))

# 3) 발밑 그림자 한 줌
shadow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
sp = shadow.load()
sy, sw, sh = h * 0.88, w * 0.36, h * 0.045
for y in range(h):
    for x in range(w):
        d = (((x - w * 0.52) / sw) ** 2 + ((y - sy) / sh) ** 2) ** 0.5
        if d < 1:
            sp[x, y] = (110, 90, 75, round(70 * (1 - d) ** 1.5))
shadow = shadow.filter(ImageFilter.GaussianBlur(4))
final = Image.alpha_composite(shadow, out)

box = final.getchannel('A').point(lambda a: 255 if a > 4 else 0).getbbox()
final = final.crop(box)
side = max(final.size) + 40
canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
canvas.alpha_composite(final, ((side - final.width) // 2, side - final.height - 20))

full = canvas.resize((640, 640), Image.LANCZOS)
full.save(os.path.join(DOGS, 'mystery.webp'), 'WEBP', quality=88, method=6)
thumb = canvas.resize((160, 160), Image.LANCZOS)
thumb.save(os.path.join(DOGS, 'thumb', 'mystery.webp'), 'WEBP', quality=88, method=6)
print('saved', full.size, thumb.size)
