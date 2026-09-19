# -*- coding: utf-8 -*-
"""
댕브리 마스코트 에셋(assets/댕브리_*.png) → static/mascot/ 투명 webp.

한 번 만들어 두면 되는 도구라 Node 가 아닌 Python 으로 두었어요.
    pip install rembg onnxruntime pillow
    python scripts/mascot-cutout.py            # 전부
    python scripts/mascot-cutout.py run wave   # 일부만 (curious / finish / wave / run)

- 궁금 / 마무리 / 인사: rembg(u2net) 로 배경을 지우고 여백을 잘라 저장
- 달리기: 달리기2 시트(3줄 x 6칸, 18프레임)를 잘라 각각 배경 제거 후,
  18장 공통 배율로 발끝을 같은 바닥선에 맞춘 정사각 캔버스에 담아 저장
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


def pack_run(cutouts: list[Image.Image], side: int, pad_bottom: float = 0.05) -> list[Image.Image]:
    """달리기 프레임들을 같은 정사각 캔버스에 담습니다.

    프레임마다 따로 맞추면(각자 꽉 채우면) 몸을 웅크린 프레임만 크게 담겨 덩치가 들썩여요.
    그래서 배율은 18장 공통으로 하나만 쓰고,
    - 가로: 알파 무게중심 (앞발 하나가 튀어나와도 몸통 자리가 흔들리지 않게)
    - 세로: 발끝을 같은 바닥선에
    에 맞춰 얹습니다. 이러면 그림에 그려진 자세·크기 변화만 남아 달리는 동작이 이어집니다.
    """
    import numpy as np

    inner = side * (1 - pad_bottom - 0.04)
    scale = min(inner / max(c.width for c in cutouts), inner / max(c.height for c in cutouts))
    ground = side - round(side * pad_bottom)
    out = []
    for c in cutouts:
        w, h = round(c.width * scale), round(c.height * scale)
        im = c.resize((w, h), Image.LANCZOS)
        alpha = np.asarray(im.getchannel('A')).astype(float)
        xs = alpha.sum(0)
        mid = float((xs * np.arange(w)).sum() / max(xs.sum(), 1))
        canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        canvas.alpha_composite(im, (round(side / 2 - mid), ground - h))
        out.append(canvas)
    return out


def run_frames(sheet: Image.Image):
    """달리기2 시트(3줄 x 6칸, 18프레임)를 잘라 냅니다. 제목·번호 글씨는 띠 밖이라 자동으로 빠져요."""
    import numpy as np

    a = np.asarray(sheet.convert('RGB')).astype(int)
    h, w = a.shape[:2]
    # 배경은 오른쪽 위 구석 색(크림). 이보다 충분히 다른 픽셀만 그림으로 봅니다.
    bg = a[2, w - 3]
    ink = np.abs(a - bg).sum(2) > 22

    # 그림 몸통이 있는 세 줄(제목·번호 글씨는 이 밖에 있습니다)
    bands = [(82, 352), (392, 656), (680, 982)]
    frames = []
    for y0, y1 in bands:
        cols = ink[y0:y1].sum(0)
        runs, start = [], None
        for x, on in enumerate(list(cols > 0) + [False]):
            if on and start is None:
                start = x
            elif not on and start is not None:
                if x - start > 20:
                    runs.append((start, x))
                start = None
        # 아래 줄은 그림이 커서 옆 칸과 붙어 버려요. 6칸이 될 때까지
        # 가장 넓은 띠를 잉크가 가장 적은 열에서 갈라 냅니다.
        while len(runs) < 6:
            i = max(range(len(runs)), key=lambda k: runs[k][1] - runs[k][0])
            xa, xb = runs[i]
            cut_at = int(np.argmin(cols[xa + 60:xb - 60])) + xa + 60
            runs[i:i + 1] = [(xa, cut_at), (cut_at, xb)]
            runs.sort()
        assert len(runs) == 6, runs
        for xa, xb in runs:
            ys = np.where(ink[y0:y1, xa:xb].any(1))[0]
            ya, yb = y0 + int(ys[0]), y0 + int(ys[-1]) + 1
            m = 10
            frames.append(sheet.crop((max(0, xa - m), max(0, ya - m), min(w, xb + m), min(h, yb + m))))
            print('frame', len(frames), (xa, ya, xb, yb))
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
        sheet = Image.open(os.path.join(ASSETS, '댕브리_달리기2.png'))
        cutouts = []
        for crop in run_frames(sheet):
            # 작은 프레임은 모델이 놓치기 쉬워, 매팅 전에 세로 900px 로 키웠다가
            # 시트에서의 크기 비율 그대로 돌려놓습니다.
            up = 900 / crop.height
            big = crop.resize((round(crop.width * up), 900), Image.LANCZOS)
            back = cut(big, single=True)
            cutouts.append(back.resize((max(1, round(back.width / up)), max(1, round(back.height / up))),
                                       Image.LANCZOS))
        for i, frame in enumerate(pack_run(cutouts, 480)):
            save(frame, f'dangbri-dash-{i + 1}', 480)
        # 확인용 컨택 시트 (3줄 x 6칸)
        sheet_out = Image.new('RGBA', (6 * 200, 3 * 200), (60, 120, 200, 255))
        for i in range(18):
            f = Image.open(os.path.join(OUT, f'dangbri-dash-{i + 1}.webp')).resize((200, 200), Image.LANCZOS)
            sheet_out.alpha_composite(f, (i % 6 * 200, i // 6 * 200))
        sheet_out.convert('RGB').save(os.path.join(CHECK, f'run_contact_{MODEL}.png'))
