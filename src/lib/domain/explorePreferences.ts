import { themeNames, type ThemeFilter } from './place';

export const EXPLORE_PREFERENCES_KEY = 'dangverywhere-explore-v1';
export type ExplorePreferences = {
  query: string;
  category: ThemeFilter;
  mode: 'all' | 'dog';
  weightInfoOnly: boolean;
  hideKnownMismatch: boolean;
};

export function parseExplorePreferences(raw: string | null, hasDogs: boolean): ExplorePreferences {
  let value: Partial<ExplorePreferences> = {};
  try {
    const parsed: unknown = JSON.parse(raw ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) value = parsed;
  } catch {
    /* Invalid or older saved preferences use the defaults. */
  }
  const matching = hasDogs && value.mode === 'dog' && value.hideKnownMismatch === true;
  return {
    query: typeof value.query === 'string' ? value.query : '',
    category:
      typeof value.category === 'string' && Object.hasOwn(themeNames, value.category)
        ? value.category
        : 'all',
    mode: matching ? 'dog' : 'all',
    weightInfoOnly: value.weightInfoOnly === true,
    hideKnownMismatch: matching
  };
}

export function readExplorePreferences(hasDogs: boolean): ExplorePreferences {
  try {
    return parseExplorePreferences(localStorage.getItem(EXPLORE_PREFERENCES_KEY), hasDogs);
  } catch {
    return parseExplorePreferences(null, hasDogs);
  }
}

export function saveExplorePreferences(preferences: ExplorePreferences): void {
  try {
    localStorage.setItem(EXPLORE_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    /* Browsing still works when storage is unavailable. */
  }
}
