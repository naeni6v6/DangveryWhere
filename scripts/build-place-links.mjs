// 장소별 '상세 정보 확인' 링크 만들기
// Usage: node scripts/build-place-links.mjs             # 저장
//        node scripts/build-place-links.mjs --offline   # 살아 있는지 확인 안 하고 후보만 (빠름)
//
// 결과: src/lib/data/placeLinks.json  (placeId → 업소 홈페이지 주소)
//
// 어디서 주소를 모으나요?
//  - 지역 저장본(src/lib/server/data/regions/*.json)의 sources[].raw.homePage(강원 원본),
//    raw['홈페이지'](문화정보원 원본)
//  - 관광공사 저장본(kto-pet-tour.json)의 common.homepage
//  - 강릉 gw-<번호> 장소는 저장본에 홈페이지 칸이 없어 강원 원본 API(detailSeqPart.do)의
//    homePage 를 한 번 더 읽어 옵니다 (fetch-place-images.mjs 와 같은 인증서 예외).
//
// 왜 살아 있는지 확인하나요?
//  - 원본 홈페이지 상당수가 도메인 만료·DNS 실패·'준비중' 페이지입니다. 그대로 걸면
//    '상세 정보 확인'을 눌렀는데 빈 화면이 뜹니다. 접속되고(2xx) 주차 페이지가 아닌 것만 남기고,
//    나머지 장소는 화면에서 네이버 지도 검색(naverPlaceUrl)으로 넘깁니다.
//  - 인스타그램·네이버 블로그는 로그인 없이도 열리므로 그대로 둡니다.
import { readFile, writeFile } from 'node:fs/promises';
import https from 'node:https';

const OUTPUT = new URL('../src/lib/data/placeLinks.json', import.meta.url);
const offline = process.argv.includes('--offline');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36';
const WORKERS = 8;
/** 접속은 되지만 업소 페이지가 아닌 것들. 제목으로 거릅니다. */
const PARKED =
  /for sale|domain|준비중|준비 중|파워볼|page not found|not found|사전예약|expired|만료|호스팅|웹호스팅|가비아|cafe24/i;

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

function firstUrl(value) {
  const text = String(value ?? '').replace(/<[^>]*>/g, ' ');
  const match = /https?:\/\/[^\s"'<>]+|www\.[^\s"'<>]+/i.exec(text);
  if (!match) return '';
  let url = match[0].replace(/[#).,]+$/, '');
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  try {
    const parsed = new URL(url);
    // 네이버 통합검색을 거쳐 가는 주소는 실제 목적지(u=)만 남깁니다.
    if (parsed.hostname === 'search.naver.com' && parsed.searchParams.get('u')) {
      return parsed.searchParams.get('u');
    }
    // 우리 정보 출처 페이지(data.go.kr·visitkorea 상세)는 업소 링크가 아닙니다.
    if (/data\.go\.kr$/.test(parsed.hostname)) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

/** 강원 원본 API. 강릉 gw-<번호> 장소의 homePage 만 필요합니다. */
const partCodes = { food: 'PC01', stay: 'PC02', outdoor: 'PC03', activity: 'PC04' };
const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
function pettravelHomepage(seq, category) {
  const part = partCodes[category];
  if (!part) return Promise.resolve('');
  return new Promise((resolve) => {
    const request = https.get(
      {
        host: 'www.pettravel.kr',
        path: `/api/detailSeqPart.do?partCode=${part}&contentNum=${seq}`,
        agent,
        headers: { 'User-Agent': 'DangveryWhere/0.1 (place links)' }
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            resolve(firstUrl(data?.[0]?.resultList?.homePage));
          } catch {
            resolve('');
          }
        });
      }
    );
    request.setTimeout(20000, () => request.destroy());
    request.on('error', () => resolve(''));
  });
}

async function collectCandidates() {
  const kto = (await read('../src/lib/server/data/kto-pet-tour.json')).records;
  const ktoHomepage = (contentId) => firstUrl(kto[contentId]?.common?.homepage);
  const candidates = new Map();
  const everyPlace = [];

  const gangneung = await read('../src/lib/server/data/gangneung.json');
  everyPlace.push(...gangneung);
  for (const place of gangneung) {
    if (place.id.startsWith('gw-k-')) {
      const url = ktoHomepage(place.id.slice(5));
      if (url) candidates.set(place.id, url);
    } else if (/^gw-\d+$/.test(place.id) && !offline) {
      const url = await pettravelHomepage(place.id.slice(3), place.category);
      if (url) candidates.set(place.id, url);
    }
  }

  const catalog = await readFile(new URL('../src/lib/domain/region.ts', import.meta.url), 'utf8');
  const regionIds = [...catalog.matchAll(/id: '([a-z-]+)'/g)]
    .map(([, id]) => id)
    .filter((id) => id !== 'all' && id !== 'gangneung');
  for (const regionId of regionIds) {
    const { places } = await read(`../src/lib/server/data/regions/${regionId}.json`);
    everyPlace.push(...places);
    for (const place of places) {
      let url = '';
      for (const source of place.sources ?? []) {
        url ||= firstUrl(source.raw?.homePage ?? source.raw?.['홈페이지']);
        if (!url && source.provider === 'kto-pet-tour') {
          url = ktoHomepage(String(source.recordId).replace(/^\D+/, ''));
        }
      }
      if (url) candidates.set(place.id, url);
    }
  }
  const shared = shareBetweenSiblings(candidates, everyPlace);
  if (shared) console.log(`같은 주소의 같은 가게에서 주소를 나눠 받은 곳 ${shared}곳`);
  return candidates;
}

async function isAlive(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000)
    });
    // 403·418 은 봇 차단이지 죽은 사이트가 아닙니다. 브라우저에서는 열려서 남겨 둡니다.
    if (response.status === 403 || response.status === 418) return { ok: true, url };
    if (response.status < 200 || response.status >= 300)
      return { ok: false, why: `HTTP ${response.status}` };
    const type = response.headers.get('content-type') ?? '';
    if (!/html|text|json|image/.test(type)) return { ok: true, url: response.url };
    const html = (await response.text()).slice(0, 20000);
    const title = (/<title[^>]*>([^<]*)</i.exec(html)?.[1] ?? '').replace(/\s+/g, ' ').trim();
    if (PARKED.test(title)) return { ok: false, why: `주차 페이지: ${title.slice(0, 40)}` };
    return { ok: true, url: response.url };
  } catch (error) {
    const code = error.cause?.code ?? error.name;
    // 중간 인증서 누락·만료는 Node 만 까다롭고 브라우저는 경고 뒤에 열어 줍니다. 죽은 게 아니라 남깁니다.
    if (/UNABLE_TO_VERIFY_LEAF_SIGNATURE|CERT_HAS_EXPIRED|SELF_SIGNED|ERR_TLS/.test(code))
      return { ok: true, url };
    return { ok: false, why: code };
  }
}

/**
 * 같은 주소에 같은 가게가 출처별로 두 번 들어온 경우(예: '서프쉑'과 '서프쉑 카페'),
 * 한쪽에만 홈페이지가 있으면 다른 쪽도 그 주소를 씁니다. 주소가 같고 이름이 서로 포함될 때만.
 */
function shareBetweenSiblings(candidates, places) {
  const key = (place) =>
    place.address.replace(/\s+/g, '').replace(/^강원도|^강원특별자치도|^강원/, '');
  const compact = (name) => name.replace(/\s+/g, '').toLowerCase();
  const byAddress = new Map();
  for (const place of places) {
    const list = byAddress.get(key(place)) ?? [];
    list.push(place);
    byAddress.set(key(place), list);
  }
  let shared = 0;
  for (const place of places) {
    if (candidates.has(place.id)) continue;
    const mine = compact(place.name);
    const donor = (byAddress.get(key(place)) ?? []).find((other) => {
      if (other.id === place.id || !candidates.has(other.id)) return false;
      const theirs = compact(other.name);
      return theirs.length >= 2 && (mine.includes(theirs) || theirs.includes(mine));
    });
    if (donor) {
      candidates.set(place.id, candidates.get(donor.id));
      shared += 1;
    }
  }
  return shared;
}

const candidates = await collectCandidates();
console.log(`후보 ${candidates.size}곳`);
const links = {};
const dropped = [];
if (offline) {
  for (const [id, url] of candidates) links[id] = url;
} else {
  const entries = [...candidates];
  let index = 0;
  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      while (index < entries.length) {
        const [id, url] = entries[index++];
        const result = await isAlive(url);
        if (result.ok) links[id] = url;
        else dropped.push(`${id} ${url} (${result.why})`);
      }
    })
  );
}
const sorted = Object.fromEntries(Object.entries(links).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(OUTPUT, JSON.stringify(sorted, null, 1) + '\n');
console.log(`저장 ${Object.keys(sorted).length}곳 · 제외 ${dropped.length}곳 → ${OUTPUT.pathname}`);
for (const line of dropped) console.log(`  - ${line}`);
