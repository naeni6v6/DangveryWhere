# -*- coding: utf-8 -*-
"""
댕브리 마스코트 에셋(assets/댕브리_*.png) → static/mascot/ 투명 webp.

한 번 만들어 두면 되는 도구라 Node 가 아닌 Python 으로 두었어요.
    pip install rembg onnxruntime pillow
    python scripts/mascot-cutout.py            # 전부
    python scripts/mascot-cutout.py run wave   # 일부만 (curious / finish / wave / run)

- 궁금 / 마무리 / 인사: rembg(u2net) 로 배경을 지우고 여백을 잘라 저장
- 달리기: 시트 위 줄의 8프레임을 잘라 각각 배경 제거 후, 발끝을 같은 바닥선에 맞춘 정사각 캔버스에 담아 저장
  (isnet-anime 모델은 작은 프레임을 놓치거나 귀·다리를 잘라 먹어 u2net 을 씁니다)
- 확인용으로 파란 배경에 얹은 그림을 scripts/.mascot-check/ 에 함께 남깁니다 (git 제외)
"""
import os
import sys

from PIL import Image
from rembg import new_session, remove

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
OUT = os.path.join(ROOT, 'static', 'mascot')
CHECK = os.path.join(ROOT, 'scripts', '.mascot-check')
os.makedirs(OUT, exist_ok=True)
os.makedirs(CHECK, exist_ok=True)

MODEL = os.environ.get('REMBG_MODEL', 'u2net')
session = new_session(MODEL)


def largest_blob(alpha: Image.Image) -> Image.Image:
    """알파에서 가장 큰 덩어리만 남깁니다. 옆 프레임의 귀·앞발 조각이 딸려 들어오는 걸 막아요."""
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


def cut(im: Image.Image, single: bool = False) -> Image.Image:
    """배경을 지우고(RGBA) 알파 기준으로 여백을 잘라냅니다. single 이면 가장 큰 덩어리만 남겨요."""
    rgba = remove(im.convert('RGB'), session=session, post_process_mask=True)
    if single:
        rgba.putalpha(largest_blob(rgba.getchannel('A')))
    box = rgba.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    return rgba.crop(box)


def save(rgba: Image.Image, name: str, width: int):
    im = rgba if rgba.width <= width else rgba.resize(
        (width, round(rgba.height * width / rgba.width)), Image.LANCZOS)
    path = os.path.join(OUT, f'{name}.webp')
    im.save(path, 'WEBP', quality=88, method=6)
    # 확인용: 진한 배경에 얹어 저장
    chk = Image.new('RGBA', im.size, (60, 120, 200, 255))
    chk.alpha_composite(im)
    chk.convert('RGB').save(os.path.join(CHECK, f'{name}_check.png'))
    print(name, im.size, os.path.getsize(path) // 1024, 'KB')


def square(rgba: Image.Image, side: int, pad_bottom: float = 0.06) -> Image.Image:
    """정사각 캔버스에 가로 가운데, 발끝은 아래에서 pad_bottom 만큼 띄워 담습니다."""
    inner = side * (1 - pad_bottom - 0.04)
    scale = min(inner / rgba.width, inner / rgba.height)
    w, h = round(rgba.width * scale), round(rgba.height * scale)
    im = rgba.resize((w, h), Image.LANCZOS)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((side - w) // 2, side - round(side * pad_bottom) - h))
    return canvas


def run_frames(sheet: Image.Image):
    """시트 위 줄(달리기 8프레임)을 세로 띠 단위로 나눕니다. 라벨 글씨는 아래에서 잘라 냅니다."""
    rgb = sheet.convert('RGB')
    w, h = rgb.size
    px = rgb.load()

    # 배경과 다른 픽셀 판정(느슨하게) — 프레임 위치만 찾는 용도
    def ink(x, y):
        r, g, b = px[x, y]
        return abs(r - 251) > 10 or abs(g - 248) > 10 or abs(b - 246) > 10

    y0, y1 = 130, 400  # 프레임 몸통이 있는 띠(제목·번호 글씨 제외)
    counts = [sum(1 for y in range(y0, y1, 2) if ink(x, y)) for x in range(w)]
    runs, start = [], None
    for x, on in enumerate([c > 0 for c in counts] + [False]):
        if on and start is None:
            start = x
        elif not on and start is not None:
            if x - start > 30:
                runs.append((start, x))
            start = None
    # 프레임끼리 가로로 살짝 겹치면(앞발·귀) 띠가 붙어 버려요.
    # 8개가 안 나오면 가장 넓은 띠를 잉크가 가장 적은 열에서 갈라 8개를 맞춥니다.
    while len(runs) < 8:
        i = max(range(len(runs)), key=lambda k: runs[k][1] - runs[k][0])
        xa, xb = runs[i]
        cut_at = min(range(xa + 40, xb - 40), key=lambda x: counts[x])
        runs[i:i + 1] = [(xa, cut_at), (cut_at, xb)]
        runs.sort()
    assert len(runs) == 8, runs
    frames = []
    for i, (xa, xb) in enumerate(runs):
        # 이 띠 안에서 세로로 가장 긴 잉크 구간 = 강아지 (번호 글씨는 아래에 떨어져 있음)
        rows = [any(ink(x, y) for x in range(xa, xb, 2)) for y in range(80, 460)]
        best, cur = None, None
        for j, on in enumerate(rows + [False]):
            if on and cur is None:
                cur = j
            elif not on and cur is not None:
                if best is None or j - cur > best[1] - best[0]:
                    best = (cur, j)
                cur = None
        ya, yb = best[0] + 80, best[1] + 80
        # 가로는 띠 경계 그대로(옆 프레임 조각이 안 들어오게), 세로만 여유를 둡니다.
        m = 14
        crop = sheet.crop((xa, max(0, ya - m), xb, min(h, yb + m)))
        frames.append(crop)
        print('frame', i + 1, (xa, ya, xb, yb))
    return frames


if __name__ == '__main__':
    what = sys.argv[1:] or ['curious', 'finish', 'wave', 'run']
    if 'curious' in what:
        save(cut(Image.open(os.path.join(ASSETS, '댕브리_궁금.png'))), 'dangbri-curious', 640)
    if 'finish' in what:
        save(cut(Image.open(os.path.join(ASSETS, '댕브리_마무리.png'))), 'dangbri-finish', 640)
    if 'wave' in what:
        save(square(cut(Image.open(os.path.join(ASSETS, '댕브리_인사.png'))), 720, 0.04), 'dangbri-wave', 720)
    if 'run' in what:
        sheet = Image.open(os.path.join(ASSETS, '댕브리_달리기.png'))
        for i, crop in enumerate(run_frames(sheet)):
            # 작은 프레임은 모델이 놓치기 쉬워, 매팅 전에 세로 900px 로 키웁니다.
            up = 900 / crop.height
            big = crop.resize((round(crop.width * up), 900), Image.LANCZOS)
            save(square(cut(big, single=True), 480, 0.05), f'dangbri-run-{i + 1}', 480)
        # 확인용 컨택 시트
        sheet_out = Image.new('RGBA', (8 * 240, 240), (60, 120, 200, 255))
        for i in range(8):
            f = Image.open(os.path.join(OUT, f'dangbri-run-{i + 1}.webp')).resize((240, 240), Image.LANCZOS)
            sheet_out.alpha_composite(f, (i * 240, 0))
        sheet_out.convert('RGB').save(os.path.join(CHECK, f'run_contact_{MODEL}.png'))
