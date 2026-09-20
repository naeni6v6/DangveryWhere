import { describe, expect, it } from 'vitest';
import { parseExplorePreferences } from './explorePreferences';

describe('saved explore conditions', () => {
  const matching = {
    query: '양양',
    category: 'stay',
    mode: 'dog',
    weightInfoOnly: true,
    hideKnownMismatch: true
  };
  it('restores the full combination shared by web and mobile', () => {
    expect(parseExplorePreferences(JSON.stringify(matching), true)).toEqual(matching);
  });
  it('does not claim dog matching when the saved dog was removed', () => {
    expect(parseExplorePreferences(JSON.stringify(matching), false)).toEqual({
      ...matching,
      mode: 'all',
      hideKnownMismatch: false
    });
  });
  it('safely resets corrupt, wrongly typed and unknown values', () => {
    const defaults = parseExplorePreferences(null, true);
    for (const raw of [
      'broken',
      'null',
      '[]',
      '{"category":"unknown","query":42,"weightInfoOnly":"true"}'
    ]) {
      expect(parseExplorePreferences(raw, true)).toEqual(defaults);
    }
  });
  it('does not revive a condition the user switched off', () => {
    expect(
      parseExplorePreferences(JSON.stringify({ ...matching, hideKnownMismatch: false }), true).mode
    ).toBe('all');
  });
});
