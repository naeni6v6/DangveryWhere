# -*- coding: utf-8 -*-
"""
견종 캐릭터(static/dogs/<key>.webp, 순백 배경 + 바닥 그림자) → static/dogs/cut/<key>.webp 투명 그림.

    pip install rembg onnxruntime pillow
    python scripts/breed-cutout.py            # 전부
    python scripts/breed-cutout.py maltese    # 일부만

무대(/web/dog)는 그려진 바닥 그림자를 그대로 쓰려고 흰 배경 원본에 multiply 를 겁니다.
반대로 튜토리얼 완료 화면처럼 아이보리 카드 위에 얹는 자리에서는 multiply 가
그림자를 얼룩처럼 남기고 흰 털까지 탁하게 만들어요. 그래서 배경을 아예 지운 판을 따로 둡니다.

- 마스코트와 같은 u2net 모델을 씁니다 (scripts/mascot-cutout.py 참고)
- 발끝이 원본과 같은 자리에 오도록, 잘라 낸 그림을 원본 캔버스(640 정사각) 그대로에 다시 얹습니다.
  덕분에 --dog-scale 처럼 바닥선(88%)을 기준으로 잡아 둔 CSS 를 그대로 쓸 수 있어요.
- 확인용으로 파란 배경에 얹은 그림을 scripts/.breed-check/ 에 남깁니다 (git 제외)
"""
import os
import sys

from PIL import Image
from rembg import new_session, remove

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'static', 'dogs')
OUT = os.path.join(SRC, 'cut')
CHECK = os.path.join(ROOT, 'scripts', '.breed-check')
os.makedirs(OUT, exist_ok=True)
os.makedirs(CHECK, exist_ok=True)

session = new_session(os.environ.get('REMBG_MODEL', 'u2net'))


def largest_blob(alpha: Image.Image) -> Image.Image:
    """알파에서 가장 큰 덩어리만 남깁니다. 바닥 그림자 조각이 따로 떨어져 남는 걸 막아요."""
    w, h = alpha.size
    px = alpha.load()
    seen = bytearray(w * h)
    best: list[tuple[int, int]] = []
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or px[sx, sy] <= 40:
                continue
            blob, stack = [], [(sx, sy)]
            seen[sy * w + sx] = 1
            while stack:
                x, y = stack.pop()
                blob.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny] > 40:
                        seen[ny * w + nx] = 1
                        stack.append((nx, ny))
            if len(blob) > len(best):
                best = blob
    keep = Image.new('L', (w, h), 0)
    kp = keep.load()
    for x, y in best:
        kp[x, y] = px[x, y]
    return keep


def cut(key: str):
    src = Image.open(os.path.join(SRC, f'{key}.webp'))
    rgba = remove(src.convert('RGB'), session=session, post_process_mask=True)
    rgba.putalpha(largest_blob(rgba.getchannel('A')))
    # 자리를 그대로 두려고 자르지 않고 원본 크기 그대로 저장합니다.
    path = os.path.join(OUT, f'{key}.webp')
    rgba.save(path, 'WEBP', quality=90, method=6)
    chk = Image.new('RGBA', rgba.size, (60, 120, 200, 255))
    chk.alpha_composite(rgba)
    chk.convert('RGB').save(os.path.join(CHECK, f'{key}.png'))
    print(key, rgba.size, os.path.getsize(path) // 1024, 'KB')


if __name__ == '__main__':
    keys = sys.argv[1:] or [
        name[:-5]
        for name in sorted(os.listdir(SRC))
        # mystery 는 이미 투명 그림이라 건드리지 않습니다.
        if name.endswith('.webp') and name != 'mystery.webp'
    ]
    for key in keys:
        cut(key)
