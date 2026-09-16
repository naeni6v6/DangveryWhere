// 전국 시군구 목록 생성기
// 실행: 프로젝트 루트에서  node assets/korea-maps/build_districts.mjs
// 결과: src/lib/domain/koreaDistricts.ts
//
// 원본: https://github.com/swcho/korea-maps  json/<시도>_시군구_경계.json  (MIT, LICENSE 참고)
//       통계청 SGIS 오픈 API 2020년 행정구역 경계
//
// 경계 좌표는 필요 없고 properties 의 { id, title } 만 씁니다. 파일이 수십 MB 라
// JSON.parse 하지 않고 본문에서 바로 뽑아냅니다.
import { writeFileSync } from 'node:fs';

const API = 'https://api.github.com/repos/swcho/korea-maps/contents/json';
// 지도에서 훑어 내려가는 순서대로 (수도권 → 강원 → 충청 → 호남 → 영남 → 제주)
const ORDER = [
  'seoul', 'gyeonggi', 'incheon', 'gangwon', 'chungbuk', 'chungnam', 'sejong', 'daejeon',
  'jeonbuk', 'jeonnam', 'gwangju', 'gyeongbuk', 'gyeongnam', 'daegu', 'ulsan', 'busan', 'jeju'
];
const FILE_TO_ID = {
  서울특별시: 'seoul', 부산광역시: 'busan', 대구광역시: 'daegu', 인천광역시: 'incheon',
  광주광역시: 'gwangju', 대전광역시: 'daejeon', 울산광역시: 'ulsan', 세종특별자치시: 'sejong',
  경기도: 'gyeonggi', 강원도: 'gangwon', 충청북도: 'chungbuk', 충청남도: 'chungnam',
  전라북도: 'jeonbuk', 전라남도: 'jeonnam', 경상북도: 'gyeongbuk', 경상남도: 'gyeongnam',
  제주특별자치도: 'jeju'
};

const listing = await (await fetch(API, { headers: { 'User-Agent': 'dangverywhere' } })).json();
if (!Array.isArray(listing)) throw new Error('GitHub 목록을 받지 못했어요. 잠시 후 다시 시도해 주세요.');

const byProvince = {};
for (const file of listing) {
  if (file.name.includes('전국')) continue; // 시도 경계 파일은 여기서 필요 없어요
  const id = FILE_TO_ID[file.name.replace('_시군구_경계.json', '')];
  if (!id) throw new Error(`알 수 없는 시도 파일: ${file.name}`);
  const body = await (await fetch(file.download_url)).text();
  const rows = [...body.matchAll(/"id":\s*"(\d+)",\s*"title":\s*"([^"]+)"/g)].map((m) => ({
    code: m[1],
    name: m[2]
  }));
  if (!rows.length) throw new Error(`${file.name} 에서 시군구를 못 찾았어요. 원본 형식이 바뀐 것 같아요.`);
  byProvince[id] = rows;
  console.log(`${id} ${rows.length}건`);
}
const missing = ORDER.filter((id) => !byProvince[id]);
if (missing.length) throw new Error(`빠진 시도: ${missing.join(', ')}`);

const header = `/**
 * 전국 시군구 목록 (지도 기록 페이지의 세부 체크용)
 *
 * 원본: swcho/korea-maps — json/<시도>_시군구_경계.json 의 properties
 *       https://github.com/swcho/korea-maps  (MIT License, Copyright (c) 2022 StatGarten)
 *       통계청 SGIS 오픈 API 2020년 행정구역 경계
 * 생성: assets/korea-maps/build_districts.mjs 로 만들었어요. 손으로 고치지 말고 스크립트를 다시 실행하세요.
 *
 * code 는 통계청 SGIS 가 붙인 2020년 행정구역 코드예요(법정동코드와는 다릅니다).
 * 그 뒤로 바뀐 것(2023년 군위군의 대구 편입 등)은 아직 반영되어 있지 않으니,
 * 원본이 갱신되면 스크립트를 다시 돌려 주세요.
 */
export type KoreaDistrict = {
  /** SGIS 행정구역 코드 (기록 저장 키로 씁니다) */
  code: string;
  name: string;
};

/** 시도 id → 그 안의 시군구 목록 */
export const koreaDistricts: Record<string, KoreaDistrict[]> = {`;

const lines = [header];
for (const id of ORDER) {
  const rows = byProvince[id];
  lines.push(`  ${id}: [`);
  lines.push(rows.map((r) => `    { code: '${r.code}', name: '${r.name}' }`).join(',\n'));
  lines.push(`  ]${id === ORDER.at(-1) ? '' : ','}`);
}
lines.push('};');
lines.push('');
lines.push(
  'export const districtCount = Object.values(koreaDistricts).reduce((sum, list) => sum + list.length, 0);'
);
lines.push('');

writeFileSync('src/lib/domain/koreaDistricts.ts', lines.join('\n').replace(/\n/g, '\r\n'));
console.log(`시도 ${ORDER.length} · 시군구 ${Object.values(byProvince).flat().length}`);
