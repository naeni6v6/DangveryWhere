import { readFile } from 'node:fs/promises';

const index = JSON.parse(
  await readFile(new URL('../src/lib/server/data/regions/index.json', import.meta.url), 'utf8')
);
console.log(`준비된 지역 데이터: ${index.collectedAt} 수집 / 화면·DB 미연결`);
console.table(
  Object.values(index.regions).map((region) => ({
    순위: region.rank,
    지역코드: region.id,
    지역: `${region.province} ${region.city}`,
    후보: region.candidateCount,
    상세조건: region.decisionConditionCount
  }))
);
console.log(`전체 ${index.totalCandidates}개 후보. 사용법: docs/REGION_DATA_GUIDE.txt`);
