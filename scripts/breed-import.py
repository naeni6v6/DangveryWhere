# -*- coding: utf-8 -*-
"""
새 견종 캐릭터 들이기.

    pip install pillow
    python scripts/breed-import.py split          # assets/breeds/시안/*.png → assets/breeds/<한글>.png
    python scripts/breed-import.py build 보더콜리:border-collie ...   # → static/dogs/<key>.webp + thumb/

시안은 한 장에 세 마리가 세로 줄로 나뉘어 있고 아래에 이름 띠가 붙어 있습니다.
칸마다 잘라 내고, 기존 견종 그림과 같은 틀(1024 정사각 · #F8F8F8 배경 · 발끝이 아래에서 91% 자리)에
다시 앉혀 둡니다. 이 틀이 맞아야 /web/dog 무대의 체급별 확대가 같은 바닥선을 기준으로 움직여요.

배경색을 옮길 때는 '배경에 가까운 픽셀일수록 많이' 옮깁니다.
그냥 곱하면 강아지 털색까지 같이 물드는데, 이러면 그려진 바닥 그림자는 그대로 따라오고
강아지 본체는 손대지 않은 채로 남아요.
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
BREEDS = os.path.join(ASSETS, 'breeds')
SHEET_DIR = os.path.join(BREEDS, '시안')
DOGS = os.path.join(ROOT, 'static', 'dogs')

# 시안 파일 → 칸 순서대로의 견종 이름
SHEETS = {
    '보더콜리, 요크셔테리어, 져먼셰퍼드.png': ['보더콜리', '요크셔테리어', '저먼셰퍼드'],
    '사모예드, 퍼그, 로트와일러.png': ['사모예드', '퍼그', '로트와일러']
}

# 기존 견종 그림에서 잰 틀
SIDE = 1024
TARGET_BG = (248, 248, 248)
FIGURE_TOP = 140
FIGURE_BOTTOM = 930


def ink_box(im, bg, threshold=24):
    """배경과 다른 픽셀이 차지하는 네모. 그려진 바닥 그림자까지 포함합니다."""
    px = im.load()
    w, h = im.size
    left, right, top, bottom = w, -1, h, -1
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > threshold:
                left, right = min(left, x), max(right, x)
                top, bottom = min(top, y), max(bottom, y)
    return left, top, right + 1, bottom + 1


def panels(sheet, count=3):
    """칸 사이 구분선을 찾아 칸 경계를 돌려줍니다.

    구분선은 위에서 아래까지 쭉 이어지는, 배경보다 밝고 얼룩 없는 세로줄입니다.
    강아지 몸에도 밝은 부분이 있어서 '밝다'만으로는 못 가려요. 세로로 고른지(편차)까지 봅니다.
    칸은 고르게 나뉘어 있으니, 예상 자리 언저리에서만 찾습니다.
    """
    w, h = sheet.size
    px = sheet.load()
    body = int(h * 0.8)  # 이름 띠를 뺀 위쪽만 봅니다
    rows = range(0, body, 6)

    def column(x):
        values = [sum(px[x, y]) / 3 for y in rows]
        mean = sum(values) / len(values)
        spread = max(values) - min(values)
        return mean, spread

    cuts = [0]
    for i in range(1, count):
        guess = round(w * i / count)
        window = range(max(0, guess - 40), min(w, guess + 40))
        best, score = guess, None
        for x in window:
            mean, spread = column(x)
            if spread > 12:
                continue  # 강아지가 걸친 열
            if score is None or mean > score:
                best, score = x, mean
        cuts.append(best)
    cuts.append(w)
    return [(cuts[i], cuts[i + 1]) for i in range(count)]


def label_top(sheet, bg):
    """이름 띠가 시작하는 줄. 강아지가 끝난 뒤 한 번 비었다가 다시 글자가 나오는 자리입니다."""
    w, h = sheet.size
    px = sheet.load()
    rows = []
    for y in range(h):
        count = sum(
            1
            for x in range(0, w, 3)
            if abs(px[x, y][0] - bg[0]) + abs(px[x, y][1] - bg[1]) + abs(px[x, y][2] - bg[2]) > 30
        )
        rows.append(count)
    # 강아지가 끝나고 처음으로 길게 비는 자리가 이름 띠 앞의 틈입니다.
    # 이름은 한글 줄·영문 줄로 나뉘어 있어서 그 아래로도 틈이 또 생겨요.
    # 맨 아래에서부터 세면 그 사이 틈을 골라 한글 줄을 끌고 들어옵니다. 위에서부터 셉니다.
    first_ink = next((y for y, count in enumerate(rows) if count > 4), 0)
    start = None
    for y, count in enumerate(rows[first_ink:] + [99], start=first_ink):
        if count <= 4:
            if start is None:
                start = y
        else:
            if start is not None and y - start >= 12:
                return start
            start = None
    return h


def recolor(im, bg):
    """배경을 TARGET_BG 로 옮깁니다. 배경에 가까운 픽셀일수록 많이 옮겨, 강아지는 그대로 둡니다."""
    out = im.copy()
    px = out.load()
    w, h = out.size
    delta = [TARGET_BG[i] - bg[i] for i in range(3)]
    span = 90.0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            far = abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])
            t = max(0.0, 1.0 - far / span)
            if t <= 0:
                continue
            px[x, y] = (
                min(255, max(0, round(r + delta[0] * t))),
                min(255, max(0, round(g + delta[1] * t))),
                min(255, max(0, round(b + delta[2] * t)))
            )
    return out


def split():
    os.makedirs(BREEDS, exist_ok=True)
    for name, breeds in SHEETS.items():
        sheet = Image.open(os.path.join(SHEET_DIR, name)).convert('RGB')
        bg = sheet.getpixel((2, 2))
        body = label_top(sheet, bg)
        bounds = panels(sheet)
        assert len(bounds) == len(breeds), (name, bounds)
        for (x0, x1), breed in zip(bounds, breeds):
            panel = recolor(sheet.crop((x0, 0, x1, body)), bg)
            box = ink_box(panel, TARGET_BG)
            dog = panel.crop(box)
            # 기존 그림과 같은 높이로 맞춰, 가로 가운데·발끝은 같은 바닥선에 둡니다.
            tall = FIGURE_BOTTOM - FIGURE_TOP
            scale = tall / dog.height
            dog = dog.resize((max(1, round(dog.width * scale)), tall), Image.LANCZOS)
            canvas = Image.new('RGB', (SIDE, SIDE), TARGET_BG)
            canvas.paste(dog, ((SIDE - dog.width) // 2, FIGURE_TOP))
            path = os.path.join(BREEDS, f'{breed}.png')
            canvas.save(path)
            print('split', breed, dog.size, os.path.getsize(path) // 1024, 'KB')


def build(pairs):
    """assets/breeds/<한글>.png → static/dogs/<key>.webp (순백 배경) + thumb/<key>.webp"""
    os.makedirs(os.path.join(DOGS, 'thumb'), exist_ok=True)
    for pair in pairs:
        breed, key = pair.split(':')
        src = Image.open(os.path.join(BREEDS, f'{breed}.png')).convert('RGB')
        # 무대용은 순백 배경이어야 multiply 합성에서 네모가 안 비쳐요 (static/dogs/안내.txt)
        white = recolor_to_white(src)
        stage = white.resize((640, 640), Image.LANCZOS)
        stage.save(os.path.join(DOGS, f'{key}.webp'), 'WEBP', quality=90, method=6)
        thumb = white.resize((144, 144), Image.LANCZOS)
        thumb.save(os.path.join(DOGS, 'thumb', f'{key}.webp'), 'WEBP', quality=88, method=6)
        print('build', breed, '->', key)


def recolor_to_white(im):
    global TARGET_BG
    keep, TARGET_BG = TARGET_BG, (255, 255, 255)
    try:
        return recolor(im, keep)
    finally:
        TARGET_BG = keep


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'split'
    if what == 'split':
        split()
    elif what == 'build':
        build(sys.argv[2:])
    else:
        raise SystemExit('split 또는 build 만 됩니다')
