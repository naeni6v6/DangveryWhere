# 전국 16개 시도 단순화 지도 데이터 생성기
# 실행: 프로젝트 루트에서  python assets/korea-maps/build_regions.py   (필요: pip install shapely pillow)
# 결과: src/lib/domain/koreaRegions.ts  +  assets/korea-maps/regions_preview.png
# 원본: https://github.com/swcho/korea-maps  svg/simple/전국_시도_경계.svg  (MIT, LICENSE 참고)
import re, json
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union, polylabel
from PIL import Image, ImageDraw, ImageFont

s = open('assets/korea-maps/전국_시도_경계_simple.svg', encoding='utf-8').read()
ds = re.findall(r'<path[^>]*?d="([^"]+)"', s)
ORDER = ['seoul','busan','daegu','incheon','gwangju','daejeon','ulsan','sejong','gyeonggi','gangwon',
         'chungbuk','chungnam','jeonbuk','jeonnam','gyeongbuk','gyeongnam','jeju']
NAMES = {'seoul':'서울','busan':'부산','daegu':'대구','incheon':'인천','gwangju':'광주','daejeon':'대전','ulsan':'울산',
         'gyeonggi':'경기','gangwon':'강원','chungbuk':'충북','chungnam':'충남','jeonbuk':'전북','jeonnam':'전남',
         'gyeongbuk':'경북','gyeongnam':'경남','jeju':'제주'}
METRO = {'seoul','busan','daegu','incheon','gwangju','daejeon','ulsan'}

def parse(d):
    geom = None
    for part in d.split('M'):
        part = part.replace('Z', '').strip()
        if not part: continue
        nums = list(map(float, re.findall(r'-?\d+\.?\d*', part)))
        pts = list(zip(nums[0::2], nums[1::2]))
        if len(pts) < 3: continue
        ring = Polygon(pts).buffer(0)
        geom = ring if geom is None else geom.symmetric_difference(ring)   # even-odd (holes)
    return geom

raw = {k: parse(d) for k, d in zip(ORDER, ds)}
# 세종 → 충남 (16개 시도)
raw['chungnam'] = unary_union([raw['chungnam'], raw.pop('sejong')]).buffer(0.3).buffer(-0.3)
# 도 영역에서 안쪽 광역시를 파냄 (겹쳐 그려져 있던 부분 정리)
for k in list(raw):
    smaller = [g for j, g in raw.items() if j != k and g.area < raw[k].area and g.intersects(raw[k])]
    if smaller: raw[k] = raw[k].difference(unary_union(smaller))

KEEP_EAST = 600      # 울릉도·독도는 크기와 상관없이 유지
MIN_ISLAND = 60      # 원본 좌표 기준 면적, 이보다 작은 섬은 생략
TOL = 1.1            # 단순화 정도
FAR_WEST = 120       # 백령도 등 서해 먼 섬은 생략(지도가 불필요하게 넓어짐)
EAST_SHIFT = -110    # 울릉도·독도를 본토 쪽으로 당겨 지도를 컴팩트하게 (상대 위치는 유지)
out = {}
for k, g in raw.items():
    parts = [g] if g.geom_type == 'Polygon' else [p for p in g.geoms if p.geom_type == 'Polygon']
    main = max(parts, key=lambda p: p.area)
    kept = [p for p in parts if p.bounds[2] > FAR_WEST and (p is main or p.area >= MIN_ISLAND * (3 if k not in METRO else 2) or p.bounds[0] > KEEP_EAST)]
    simp = []
    for p in kept:
        tol = TOL if p.bounds[0] <= KEEP_EAST else 0.15
        q = Polygon(p.exterior.coords).simplify(tol, preserve_topology=True)   # 내부 구멍은 광역시 자리라 빼고 외곽만
        if p.bounds[0] > KEEP_EAST:
            from shapely.affinity import translate
            q = translate(q, xoff=EAST_SHIFT)
        if q.area > 0: simp.append(q)
    if k == 'gyeongbuk':
        # 원본 데이터에 없는 독도: 울릉도·제주 좌표로 경위도 환산(약 111px/°경도, 139px/°위도) 후 같은 만큼 이동
        from shapely.geometry import Point
        for dx, dy, r in ((797.6, 184.8, 1.6), (795.4, 184.3, 1.2)):
            simp.append(Point(dx + EAST_SHIFT, dy).buffer(r, quad_segs=3))
    out[k] = (simp, main)

allb = unary_union([p for simp, _ in out.values() for p in simp]).bounds
pad = 8
ox, oy = allb[0] - pad, allb[1] - pad
W, H = allb[2] - allb[0] + pad * 2, allb[3] - allb[1] + pad * 2

def fmt(v): return f"{v:.1f}".rstrip('0').rstrip('.')
def path_d(polys):
    segs = []
    for p in polys:
        c = list(p.exterior.coords)[:-1]
        segs.append('M' + ' '.join(f"{fmt(x-ox)},{fmt(y-oy)}" for x, y in c) + 'Z')
    return ''.join(segs)

# 도 → 광역시 순서로 그려야 광역시가 위에 올라와 클릭하기 쉬워요
ids = ['gyeonggi','gangwon','chungbuk','chungnam','jeonbuk','jeonnam','gyeongbuk','gyeongnam','jeju',
       'seoul','incheon','daejeon','daegu','gwangju','ulsan','busan']
LABEL_NUDGE = {'gyeonggi': (6, 16), 'incheon': (-20, 8), 'chungnam': (-4, 0), 'gyeongbuk': (-14, 0), 'jeonnam': (4, 30), 'gyeongnam': (-6, -6)}
regions = []
for k in ids:
    simp, main = out[k]
    lp = polylabel(max(simp, key=lambda p: p.area), tolerance=0.5)
    nx, ny = LABEL_NUDGE.get(k, (0, 0))
    regions.append({'id': k, 'name': NAMES[k], 'metro': k in METRO, 'd': path_d(simp),
                    'labelX': round(lp.x - ox + nx, 1), 'labelY': round(lp.y - oy + ny, 1)})
ul = [p for p in out['gyeongbuk'][0] if p.bounds[0] > KEEP_EAST + EAST_SHIFT and p.area > 20][0]
captions = [{'text': '울릉도', 'x': round(ul.centroid.x - ox, 1), 'y': round(ul.bounds[3] - oy + 11, 1)}, {'text': '독도', 'x': round(797.6 + EAST_SHIFT - ox, 1), 'y': round(184.8 - oy + 11, 1)}]
W = max(W, max(c['x'] for c in captions) + 16)
TS_HEADER = '''/**
 * 전국 16개 시도 경계 (지도 기록 페이지용 단순화 지도)
 *
 * 원본: swcho/korea-maps — svg/simple/전국_시도_경계.svg
 *       https://github.com/swcho/korea-maps  (MIT License, Copyright (c) 2022 StatGarten)
 *       통계청 SGIS 오픈 API 2020년 행정구역 경계
 * 가공: assets/korea-maps/build_regions.py 로 생성했어요. 손으로 고치지 말고 스크립트를 다시 실행하세요.
 *   - 세종을 충남에 합쳐 16개 시도로 구성
 *   - 작은 섬·서해 먼 섬 생략, 경계선 단순화
 *   - 울릉도·독도는 유지하되 본토 쪽으로 당겨 배치 (원본 데이터에 없는 독도는 경위도로 환산해 추가)
 */
export type KoreaRegion = {
  id: string;
  name: string;
  /** 광역시·특별시 (도 위에 작게 그려져요) */
  metro: boolean;
  d: string;
  labelX: number;
  labelY: number;
};
'''
NL = chr(10)
lines = [TS_HEADER, f"export const KOREA_VIEWBOX = '0 0 {round(W, 1):g} {round(H, 1):g}';" + NL, 'export const koreaRegions: KoreaRegion[] = [']
for i, r in enumerate(regions):
    comma = ',' if i < len(regions) - 1 else ''
    lines.append(f"  {{ id: '{r['id']}', name: '{r['name']}', metro: {str(r['metro']).lower()}, labelX: {r['labelX']:g}, labelY: {r['labelY']:g}," + NL + f"    d: '{r['d']}' }}{comma}")
lines.append('];' + NL)
lines.append('/** 섬 이름 (클릭 영역 아님) */')
lines.append('export const koreaCaptions = [' + ', '.join(f"{{ text: '{c['text']}', x: {c['x']:g}, y: {c['y']:g} }}" for c in captions) + '];' + NL)
open('src/lib/domain/koreaRegions.ts', 'w', encoding='utf-8', newline=NL).write(NL.join(lines))
print('viewBox', round(W,1), round(H,1), 'total d chars', sum(len(r['d']) for r in regions))

# 미리보기
S = 1.2
img = Image.new('RGB', (int(W*S), int(H*S)), (252, 245, 234)); dr = ImageDraw.Draw(img)
try: font = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 13); small = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 10)
except Exception: font = small = None
for r in regions:
    for seg in re.findall(r'M([^Z]+)Z', r['d']):
        pts = [tuple(float(v)*S for v in xy.split(',')) for xy in seg.split()]
        dr.polygon(pts, fill=(243, 226, 211) if not r['metro'] else (235, 210, 190), outline=(181, 112, 78))
for r in regions:
    f = small if r['metro'] else font
    dr.text((r['labelX']*S, r['labelY']*S), r['name'], fill=(74, 52, 40), font=f, anchor='mm')
for c in captions: dr.text((c['x']*S, c['y']*S), c['text'], fill=(143,125,112), font=small, anchor='mm')
img.save('assets/korea-maps/regions_preview.png')
