import { describe, expect, it } from 'vitest';
import { parseVisits, prettyDate, stampDate, todayKey } from './visitLog';

const known = (code: string) => ['11140', '32030', '32060'].includes(code);

describe('stamp storage', () => {
  it('keeps records saved before dates existed', () => {
    // 예전 버전은 코드만 배열로 저장했어요. 이게 사라지면 사용자의 기록이 날아갑니다.
    expect(parseVisits(['11140', '32030'], known)).toEqual([
      { code: '11140', date: '', dog: '' },
      { code: '32030', date: '', dog: '' }
    ]);
  });
  it('reads the current shape', () => {
    expect(parseVisits([{ code: '11140', date: '2026-09-16', dog: '두부' }], known)).toEqual([
      { code: '11140', date: '2026-09-16', dog: '두부' }
    ]);
  });
  it('drops codes that no longer exist instead of showing a blank place', () => {
    expect(parseVisits(['99999', { code: '00000', date: '2026-01-01', dog: '' }], known)).toEqual([]);
  });
  it('survives junk without throwing away the good rows', () => {
    expect(
      parseVisits([null, 7, { date: '2026-01-01' }, '11140', { code: '32030', date: 'nope' }], known)
    ).toEqual([
      { code: '11140', date: '', dog: '' },
      { code: '32030', date: '', dog: '' }
    ]);
    expect(parseVisits('not an array', known)).toEqual([]);
  });
  it('keeps one row per district', () => {
    const rows = parseVisits(
      [
        { code: '11140', date: '2026-09-16', dog: '두부' },
        { code: '11140', date: '2020-01-01', dog: '' }
      ],
      known
    );
    expect(rows).toEqual([{ code: '11140', date: '2026-09-16', dog: '두부' }]);
  });
});

describe('date formatting', () => {
  it('reads as a diary entry', () => {
    expect(prettyDate('2026-09-16')).toBe('9월 16일 수요일');
  });
  it('returns nothing for an unusable date', () => {
    expect(prettyDate('')).toBe('');
  });
  it('fits inside a stamp', () => {
    expect(stampDate('2026-09-16')).toBe('2026.09.16');
    expect(stampDate('')).toBe('');
  });
  it('uses the local day, not UTC', () => {
    // 한국 시각 자정 직후를 UTC 로 바꾸면 전날이 됩니다. 그날 기록이 어제로 찍히면 안 돼요.
    expect(todayKey(new Date('2026-09-16T00:30:00+09:00'))).toBe(
      new Date('2026-09-16T00:30:00+09:00').toLocaleDateString('sv-SE')
    );
    expect(todayKey(new Date(2026, 8, 16, 0, 30))).toBe('2026-09-16');
  });
});
