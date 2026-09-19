/**
 * 댕스탬프(시군구 스탬프 기록)의 저장 형식.
 *
 * 브라우저에만 저장되는 개인 기록이라, 형식이 바뀌어도 예전 기록을 잃지 않는 것이 제일 중요해요.
 * 지도 기록 시절에 찍어 둔 것도 그대로 스탬프가 되도록, 읽는 쪽을 너그럽게 만들고 그 규칙을
 * 테스트로 묶어 둡니다.
 */

/** 스탬프 하나 (시군구마다 하나뿐이에요) */
export type Visit = {
  /** 시군구 코드 (koreaDistricts 의 code) */
  code: string;
  /** 'YYYY-MM-DD'. 날짜를 모르는 예전 기록은 빈 문자열입니다. */
  date: string;
  /** 기록할 때 함께한 아이 이름. 프로필을 나중에 바꿔도 지난 문장이 흔들리지 않게 박아 둡니다. */
  dog: string;
};

/**
 * 저장된 값을 Visit 목록으로 읽어 냅니다.
 * 날짜를 넣기 전 버전은 코드만 배열로 저장했어서(예: ['11140']) 그 형식도 받아 줍니다.
 */
export function parseVisits(saved: unknown, isKnownCode: (code: string) => boolean): Visit[] {
  if (!Array.isArray(saved)) return [];
  const rows: Visit[] = [];
  for (const row of saved) {
    if (typeof row === 'string') {
      if (isKnownCode(row)) rows.push({ code: row, date: '', dog: '' });
      continue;
    }
    if (!row || typeof row !== 'object') continue;
    const { code, date, dog } = row as Partial<Visit>;
    if (typeof code !== 'string' || !isKnownCode(code)) continue;
    rows.push({
      code,
      date: typeof date === 'string' && isDay(date) ? date : '',
      dog: typeof dog === 'string' ? dog : ''
    });
  }
  // 같은 시군구가 두 번 들어가면 첫 기록을 남깁니다.
  const byCode = new Map<string, Visit>();
  for (const row of rows) if (!byCode.has(row.code)) byCode.set(row.code, row);
  return [...byCode.values()];
}

function isDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** '9월 16일 수요일' */
export function prettyDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getMonth() + 1}월 ${parsed.getDate()}일 ${WEEKDAYS[parsed.getDay()]}요일`;
}

/** 도장 안에 새길 짧은 날짜 '2026.09.16' */
export function stampDate(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.replaceAll('-', '.') : '';
}

/** 오늘 날짜를 현지 시각 기준 'YYYY-MM-DD' 로. (toISOString 은 UTC 라 하루가 밀릴 수 있어요) */
export function todayKey(now: Date = new Date()): string {
  return now.toLocaleDateString('sv-SE');
}
