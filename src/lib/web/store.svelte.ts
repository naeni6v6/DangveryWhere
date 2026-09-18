import { getContext, setContext } from 'svelte';
import { invalidateAll } from '$app/navigation';
import {
  profileNotice,
  searchPlacesByTheme,
  type Dog,
  type DogProfile,
  type Place,
  type ThemeFilter
} from '$lib/domain/place';

type Account = { user: { id: string } | null; dogs: Dog[]; favorites: string[] };
/** 어느 아이를 기준으로 볼지는 기기별 취향이라 이 브라우저에만 담아 둡니다. */
const ACTIVE_DOG_KEY = 'dangverywhere-active-dog';
/** 로그인 전에 등록한 아이들. 계정이 없으니 이 브라우저에 담아 새로고침해도 남게 합니다. */
const LOCAL_DOGS_KEY = 'dangverywhere-dogs';

/**
 * 처음 들어온 브라우저에 넣어 주는 예시 강아지.
 * 예전에는 빈 화면이 낯설어 '두부'를 미리 넣어 뒀지만, 이제 첫 방문 튜토리얼(/web/start)에서
 * 직접 한 마리를 만들기 때문에 비워 둡니다. 예시가 다시 필요하면 아래처럼 한 마리를 넣으면 돼요.
 * (지우면 다시 생기지 않아요 — 아래 readLocalDogs 참고)
 *   { id: '00000000-0000-4000-8000-000000000001', name: '두부', breed: '비숑 프리제', size: 'small', weight: 4 }
 */
const SAMPLE_DOG: Dog | null = null;
const KEY = Symbol('dangverywhere-web');

/**
 * State shared by every web(PC) page. It lives in the /web layout, so the dog profile,
 * search and favorites survive moving between 메인 · 탐색 · 찜한 장소 · 우리 강아지.
 */
export class WebStore {
  query = $state('');
  category = $state<ThemeFilter>('all');
  mode = $state<'all' | 'dog'>('all');
  weightInfoOnly = $state(false);
  hideKnownMismatch = $state(false);
  /** 등록된 아이들. 로그인 전에는 이 브라우저 세션에만 남습니다. */
  dogs = $state<Dog[]>([]);
  /** 지금 장소 비교의 기준이 되는 아이 */
  activeDogId = $state<string | null>(null);
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
    // 로그인했으면 계정에 저장된 것이, 아니면 이 브라우저에 담아 둔 것이 기준입니다.
    this.dogs = this.loggedIn ? [...account.dogs] : readLocalDogs();
    this.activeDogId = this.#restoreActiveId();
  }

  /**
   * 기준이 되는 아이. 화면 대부분은 한 마리만 보면 되므로 이 값을 씁니다.
   * 고른 아이가 사라졌으면 첫 번째 아이로 돌아갑니다.
   */
  get dog(): Dog | null {
    return this.dogs.find((dog) => dog.id === this.activeDogId) ?? this.dogs[0] ?? null;
  }

  #restoreActiveId(): string | null {
    try {
      const saved = localStorage.getItem(ACTIVE_DOG_KEY);
      return saved && this.dogs.some((dog) => dog.id === saved) ? saved : (this.dogs[0]?.id ?? null);
    } catch {
      return this.dogs[0]?.id ?? null;
    }
  }

  selectDog(id: string) {
    if (!this.dogs.some((dog) => dog.id === id)) return;
    this.activeDogId = id;
    try {
      localStorage.setItem(ACTIVE_DOG_KEY, id);
    } catch {
      // 저장이 막혀 있어도 이번 방문에는 그대로 적용돼요.
    }
  }

  get filterCount() {
    return Number(this.weightInfoOnly) + Number(this.hideKnownMismatch && this.mode === 'dog');
  }

  get hasFilters() {
    return Boolean(this.query) || this.category !== 'all' || this.filterCount > 0;
  }

  filter(places: Place[]) {
    const dog = this.dog;
    return searchPlacesByTheme(places, this.query, this.category).filter((place) => {
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

  /**
   * 등록·수정. id 를 주면 그 아이를 고치고, 없으면 새로 더합니다.
   * 로그인 전에는 서버에 보내지 않고 이 브라우저에 담아 둡니다.
   */
  async applyDog(profile: DogProfile, id?: string) {
    if (!this.loggedIn) {
      const localId = id ?? crypto.randomUUID();
      this.#upsert({ ...profile, id: localId });
      this.selectDog(localId);
      this.mode = 'dog';
      this.hideKnownMismatch = true;
      this.notify(
        id
          ? `${profile.name}의 정보를 수정했어요.`
          : `${profile.name}를 등록했어요.`
      );
      return;
    }
    try {
      const saved = await send('PUT', '/api/profile', id ? { ...profile, id } : profile);
      const dog = saved.dog as Dog;
      this.#upsert(dog);
      this.selectDog(dog.id);
      this.mode = 'dog';
      this.hideKnownMismatch = true;
      this.notify(id ? `${dog.name}의 정보를 수정했어요.` : `${dog.name}를 등록했어요.`);
    } catch (error) {
      this.notify(error instanceof Error ? error.message : '프로필을 저장하지 못했어요.');
    }
  }

  async removeDog(id: string) {
    const dog = this.dogs.find((row) => row.id === id);
    if (!dog) return;
    if (this.loggedIn) {
      try {
        await send('DELETE', '/api/profile', { id });
      } catch (error) {
        this.notify(error instanceof Error ? error.message : '지우지 못했어요.');
        return;
      }
    }
    this.dogs = this.dogs.filter((row) => row.id !== id);
    this.#saveLocalDogs();
    if (this.activeDogId === id) {
      const next = this.dogs[0]?.id ?? null;
      this.activeDogId = next;
      if (next) this.selectDog(next);
    }
    if (!this.dogs.length) this.mode = 'all';
    this.notify(`${dog.name}의 정보를 지웠어요.`);
  }

  #upsert(dog: Dog) {
    const index = this.dogs.findIndex((row) => row.id === dog.id);
    if (index === -1) this.dogs = [...this.dogs, dog];
    else this.dogs = this.dogs.map((row) => (row.id === dog.id ? dog : row));
    this.#saveLocalDogs();
  }

  /** 로그인 전 기록만 이 브라우저에 담습니다. 로그인 상태는 계정이 원본이라 건드리지 않아요. */
  #saveLocalDogs() {
    if (this.loggedIn) return;
    try {
      localStorage.setItem(LOCAL_DOGS_KEY, JSON.stringify(this.dogs));
    } catch {
      // 저장이 막혀 있어도 이번 방문에는 그대로 쓸 수 있어요.
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
      await send('PUT', '/api/favorites', { placeId: place.id, saved });
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
      // 로그아웃하면 계정 기록 대신 이 브라우저에 담아 둔 기록으로 돌아갑니다.
      this.dogs = readLocalDogs();
      this.activeDogId = this.dogs[0]?.id ?? null;
      this.mode = 'all';
      this.notify('로그아웃했어요.');
    } catch {
      this.notify('로그아웃을 완료하지 못했어요. 다시 시도해 주세요.');
    }
  }
}

/**
 * 이 브라우저에 담아 둔 아이들을 읽습니다.
 * 저장된 적이 한 번도 없을 때만 예시 강아지를 넣어 주고 바로 저장해서,
 * 사용자가 예시를 지우면 다시 살아나지 않게 합니다.
 */
function readLocalDogs(): Dog[] {
  try {
    const raw = localStorage.getItem(LOCAL_DOGS_KEY);
    if (raw === null) {
      const seeded = SAMPLE_DOG ? [SAMPLE_DOG] : [];
      localStorage.setItem(LOCAL_DOGS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const saved: unknown = JSON.parse(raw);
    if (!Array.isArray(saved)) return [];
    return saved.filter(
      (row): row is Dog =>
        Boolean(row) &&
        typeof row === 'object' &&
        typeof (row as Dog).id === 'string' &&
        typeof (row as Dog).name === 'string' &&
        typeof (row as Dog).breed === 'string' &&
        ['small', 'medium', 'large'].includes((row as Dog).size) &&
        Number.isFinite((row as Dog).weight)
    );
  } catch {
    // 저장소를 못 쓰는 브라우저(시크릿 모드 등)에서는 이번 방문에만 예시를 보여 줍니다.
    return SAMPLE_DOG ? [SAMPLE_DOG] : [];
  }
}

async function send(method: 'PUT' | 'DELETE', url: string, value: unknown) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(result.message || '저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
  return result;
}

export function setWebStore(store: WebStore) {
  setContext(KEY, store);
  return store;
}

export function getWebStore() {
  return getContext<WebStore>(KEY);
}
