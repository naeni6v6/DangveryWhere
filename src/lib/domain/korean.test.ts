import { describe, expect, it } from 'vitest';
import { hasFinalConsonant, josa } from './korean';

describe('한글 조사', () => {
  it('받침 없는 이름 뒤에는 와 / 는 / 가 / 를', () => {
    expect(josa('두부', '와/과')).toBe('와');
    expect(josa('모카', '은/는')).toBe('는');
    expect(josa('코코', '이/가')).toBe('가');
    expect(josa('보리', '을/를')).toBe('를');
  });
  it('받침 있는 이름 뒤에는 과 / 은 / 이 / 을', () => {
    expect(josa('하늘', '와/과')).toBe('과');
    expect(josa('방울', '은/는')).toBe('은');
    expect(josa('초롱', '이/가')).toBe('이');
    expect(josa('havoc', '와/과')).toBe('와'); // 한글이 아니면 받침 없는 쪽으로
  });
  it('받침 판단', () => {
    expect(hasFinalConsonant('두부')).toBe(false);
    expect(hasFinalConsonant('하늘')).toBe(true);
    // 한글 음절이 아니면 판단하지 않습니다.
    expect(hasFinalConsonant('Bori')).toBeNull();
    expect(hasFinalConsonant('')).toBeNull();
    expect(hasFinalConsonant('   ')).toBeNull();
  });
});
