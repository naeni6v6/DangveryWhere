import { getContext, setContext } from 'svelte';
import { invalidateAll } from '$app/navigation';
import {
  profileNotice,
  searchPlaces,
  type Category,
  type DogProfile,
  type Place
} from '$lib/domain/place';

type Account = { user: { id: string } | null; profile: DogProfile | null; favorites: string[] };
const KEY = Symbol('dangverywhere-web');

/**
 * State shared by every web(PC) page. It lives in the /web layout, so the dog profile,
 * search and favorites survive moving between 메인 · 탐색 · 찜한 장소 · 우리 강아지.
 */
export class WebStore {
  query = $state('');
  category = $state<Category>('all');
  mode = $state<'all' | 'dog'>('all');
  weightInfoOnly = $state(false);
  hideKnownMismatch = $state(false);
  dog = $state<DogProfile | null>(null);
  savedIds = $state<string[]>([]);
  loggedIn = $state(false);
  toast = $state('');
  /** Set by the layout to open the login dialog. */
  requestLogin: () => void = () => {};
  #saving = false;
  #toastTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(account: Account) {
    this.loggedIn = Boolean(account.user);
    this.savedIds = [...account.favorites];
    this.dog = account.profile;
  }

  get filterCount() {
    return Number(this.weightInfoOnly) + Number(this.hideKnownMismatch && this.mode === 'dog');
  }

  get hasFilters() {
    return Boolean(this.query) || this.category !== 'all' || this.filterCount > 0;
  }

  filter(places: Place[]) {
    const dog = this.dog;
    return searchPlaces(places, this.query, this.category).filter((place) => {
      if (this.weightInfoOnly && place.sourceWeight === null) return false;
      if (
        this.mode === 'dog' &&
        dog &&
        this.hideKnownMismatch &&
        profileNotice(place, dog).kind === 'restricted'
      )
        return false;
      return true;
    });
  }

  isSaved(id: string) {
    return this.savedIds.includes(id);
  }

  notify(text: string) {
    this.toast = text;
    clearTimeout(this.#toastTimer);
    this.#toastTimer = setTimeout(() => (this.toast = ''), 4500);
  }

  resetFilters() {
    this.query = '';
    this.category = 'all';
    this.weightInfoOnly = false;
    this.hideKnownMismatch = false;
  }

  async applyDog(profile: DogProfile) {
    this.dog = profile;
    this.mode = 'dog';
    this.hideKnownMismatch = true;
    if (!this.loggedIn) {
      this.notify(`${profile.name}의 정보를 이번 탐색에 적용했어요.`);
      return;
    }
    try {
      await put('/api/profile', profile);
      this.notify(`${profile.name}의 프로필을 저장했어요.`);
    } catch (error) {
      this.notify(error instanceof Error ? error.message : '프로필을 저장하지 못했어요.');
    }
  }

  async toggleSave(place: Place) {
    if (!this.loggedIn) {
      this.requestLogin();
      return;
    }
    if (this.#saving) return;
    this.#saving = true;
    const saved = !this.isSaved(place.id);
    try {
      await put('/api/favorites', { placeId: place.id, saved });
      this.savedIds = saved
        ? [place.id, ...this.savedIds]
        : this.savedIds.filter((id) => id !== place.id);
      this.notify(saved ? '찜한 장소에 저장했어요.' : '찜한 장소에서 지웠어요.');
    } catch (error) {
      this.notify(error instanceof Error ? error.message : '저장하지 못했어요.');
    } finally {
      this.#saving = false;
    }
  }

  async logout() {
    try {
      const response = await fetch('/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      await invalidateAll();
      this.loggedIn = false;
      this.savedIds = [];
      this.dog = null;
      this.mode = 'all';
      this.notify('로그아웃했어요.');
    } catch {
      this.notify('로그아웃을 완료하지 못했어요. 다시 시도해 주세요.');
    }
  }
}

async function put(url: string, value: unknown) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || '저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}

export function setWebStore(store: WebStore) {
  setContext(KEY, store);
  return store;
}

export function getWebStore() {
  return getContext<WebStore>(KEY);
}
