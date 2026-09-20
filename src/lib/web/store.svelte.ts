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

import type { DogCharacter } from '$lib/domain/character';
import { canonicalPlaceId, canonicalPlaceIds } from '$lib/domain/placeIdentity';
import { readExplorePreferences, saveExplorePreferences } from '$lib/domain/explorePreferences';

export type Account = {
  user: App.Locals['user'];
  dogs: Dog[];
  favorites: string[];
  characters?: DogCharacter[];
  accountUnavailable?: boolean;
};
/** 로그인 전에 만든 캐릭터. 그림이 커서 이 브라우저에만 몇 개 남깁니다. */
const LOCAL_CHARACTERS_KEY = 'dangverywhere-characters';
const MAX_LOCAL_CHARACTERS = 4;
/** 어느 아이를 기준으로 볼지는 기기별 취향이라 이 브라우저에만 담아 둡니다. */
const ACTIVE_DOG_KEY = 'dangverywhere-active-dog';
/**
 * 한 번에 기준으로 둘 수 있는 아이 수.
 * 두 마리를 함께 데리고 나가는 날이 있어서 둘까지 나란히 볼 수 있게 했습니다.
 */
export const MAX_ACTIVE_DOGS = 2;
/** 로그인 전에 등록한 아이들. 계정이 없으니 이 브라우저에 담아 새로고침해도 남게 합니다. */
const LOCAL_DOGS_KEY = 'dangverywhere-dogs';
/** 로그인 전에 찜한 곳. 마찬가지로 이 브라우저에 담아 둡니다(장소 id 목록, 최근 찜한 것이 앞). */
const LOCAL_FAVORITES_KEY = 'dangverywhere-favorites';

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
  /** 지금 장소 비교의 기준이 되는 아이들 (최대 MAX_ACTIVE_DOGS 마리) */
  activeDogIds = $state<string[]>([]);
  savedIds = $state<string[]>([]);
  /** 직접 꾸민 캐릭터들. 최근 것이 앞에 옵니다. */
  characters = $state<DogCharacter[]>([]);
  loggedIn = $state(false);
  nickname = $state('');
  toast = $state('');
  /** Set by the layout to open the login dialog. */
  requestLogin: () => void = () => {};
  #saving = false;
  #toastTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(account: Account) {
    this.loggedIn = Boolean(account.user);
    this.nickname = account.user?.nickname ?? '';
    this.savedIds = canonicalPlaceIds(
      this.loggedIn ? [...account.favorites] : readLocalFavorites()
    );
    // 로그인했으면 계정에 저장된 것이, 아니면 이 브라우저에 담아 둔 것이 기준입니다.
    this.dogs = this.loggedIn ? [...account.dogs] : readLocalDogs();
    this.characters = this.loggedIn ? [...(account.characters ?? [])] : readLocalCharacters();
    this.activeDogIds = this.#restoreActiveIds();
    Object.assign(this, readExplorePreferences(this.dogs.length > 0));
    // Both layouts own this effect, so every entry point (including dog profiles) is saved.
    $effect(() => {
      saveExplorePreferences({
        query: this.query,
        category: this.category,
        mode: this.mode,
        weightInfoOnly: this.weightInfoOnly,
        hideKnownMismatch: this.hideKnownMismatch
      });
    });
  }

  completeLogin(account: Account, signup = false) {
    if (!account.user) return;
    // The authentication response contains only this account's personal data. Switching
    // it together avoids showing guest or previous-account records under the new name.
    this.loggedIn = true;
    this.nickname = account.user.nickname;
    this.savedIds = canonicalPlaceIds(account.favorites);
    this.dogs = [...account.dogs];
    this.characters = [...(account.characters ?? [])];
    this.activeDogIds = this.#restoreActiveIds();
    if (!this.dogs.length) this.mode = 'all';
    this.notify(
      account.accountUnavailable
        ? `${this.nickname}님, 로그인했어요. 저장한 정보를 불러오지 못해 다시 확인이 필요해요.`
        : `${this.nickname}님, ${signup ? '회원가입이 완료됐어요!' : '로그인했어요!'}`
    );
    // Refresh SvelteKit's cached layout data without blocking the success feedback,
    // remounting the map, or downloading the whole document and scripts again.
    void invalidateAll().catch(() => {});
  }

  /** 이 아이의 캐릭터 (가장 최근 것). 없으면 null — 그때는 견종 캐릭터를 보여 주면 돼요. */
  characterFor(dogId: string | null | undefined): DogCharacter | null {
    if (!dogId) return null;
    return this.characters.find((character) => character.dogId === dogId) ?? null;
  }

  /**
   * 캐릭터 저장·수정. 로그인 전에는 이 브라우저에, 로그인 후에는 계정에 남깁니다.
   * 저장된(id 가 붙은) 캐릭터를 돌려주고, 실패하면 null.
   */
  async applyCharacter(
    input: Omit<DogCharacter, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string
  ): Promise<DogCharacter | null> {
    const now = new Date().toISOString();
    if (!this.loggedIn) {
      const existing = id ? this.characters.find((character) => character.id === id) : undefined;
      const saved: DogCharacter = {
        ...input,
        id: existing?.id ?? crypto.randomUUID(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      this.#upsertCharacter(saved);
      return saved;
    }
    try {
      const result = await send('PUT', '/api/character', id ? { ...input, id } : input);
      const saved = result.character as DogCharacter;
      this.#upsertCharacter(saved);
      return saved;
    } catch (error) {
      this.notify(error instanceof Error ? error.message : '캐릭터를 저장하지 못했어요.');
      return null;
    }
  }

  async removeCharacter(id: string) {
    if (!this.characters.some((character) => character.id === id)) return;
    if (this.loggedIn) {
      try {
        await send('DELETE', '/api/character', { id });
      } catch (error) {
        this.notify(error instanceof Error ? error.message : '지우지 못했어요.');
        return;
      }
    }
    this.characters = this.characters.filter((character) => character.id !== id);
    this.#saveLocalCharacters();
    this.notify('캐릭터를 지웠어요.');
  }

  #upsertCharacter(character: DogCharacter) {
    const rest = this.characters.filter((row) => row.id !== character.id);
    // 같은 아이의 예전 캐릭터는 하나만 남깁니다 — 화면마다 최근 것을 쓰니까요.
    const others = character.dogId ? rest.filter((row) => row.dogId !== character.dogId) : rest;
    this.characters = [character, ...others];
    this.#saveLocalCharacters();
  }

  #saveLocalCharacters() {
    if (this.loggedIn) return;
    try {
      // 원본 사진·기본 그림까지 넣으면 용량이 커서, 브라우저에는 최종 그림과 값만 남깁니다.
      const slim = this.characters.slice(0, MAX_LOCAL_CHARACTERS).map((character) => ({
        ...character,
        sourceImage: undefined,
        characterImage: undefined
      }));
      localStorage.setItem(LOCAL_CHARACTERS_KEY, JSON.stringify(slim));
    } catch {
      // 용량이 넘치거나 저장이 막혀도 이번 방문에는 그대로 보여요.
    }
  }

  /**
   * 기준이 되는 아이들. 고른 아이가 사라졌으면 첫 번째 아이로 돌아갑니다.
   * 한 마리도 남지 않는 상태는 두지 않습니다 — 기준이 없으면 비교할 게 없어지니까요.
   */
  get activeDogs(): Dog[] {
    const picked = this.activeDogIds
      .map((id) => this.dogs.find((dog) => dog.id === id))
      .filter((dog): dog is Dog => Boolean(dog));
    return picked.length ? picked : this.dogs.slice(0, 1);
  }

  /**
   * 대표 한 마리. 이름 한 번만 쓰면 되는 자리(댕스탬프 등)에서 씁니다.
   * 둘을 고른 상태에서는 먼저 고른 아이입니다.
   */
  get dog(): Dog | null {
    return this.activeDogs[0] ?? null;
  }

  isActive(id: string) {
    return this.activeDogs.some((dog) => dog.id === id);
  }

  /** 고른 아이들 이름을 한 줄로 ('두부·콩이'). 조사는 부르는 쪽에서 붙여 주세요. */
  get dogNames(): string {
    return this.activeDogs.map((dog) => dog.name).join('·');
  }

  /**
   * 고른 아이들 중 이 장소의 제한에 걸리는 첫 아이의 안내. 걸리는 아이가 없으면 null.
   * 카드처럼 한 줄만 보여 주는 자리에서 '누가' 걸리는지까지 알려 주려고 아이를 함께 돌려줍니다.
   */
  restrictedFor(place: Place): { dog: Dog; label: string; detail: string } | null {
    for (const dog of this.activeDogs) {
      const notice = profileNotice(place, dog);
      if (notice.kind === 'restricted') return { dog, label: notice.label, detail: notice.detail };
    }
    return null;
  }

  #firstDogIds(): string[] {
    return this.dogs.slice(0, 1).map((dog) => dog.id);
  }

  #restoreActiveIds(): string[] {
    try {
      const saved = localStorage.getItem(ACTIVE_DOG_KEY);
      if (!saved) return this.#firstDogIds();
      // 예전에는 아이디 하나만 담아 뒀어요. 그때 고른 아이를 잃지 않게 두 형태 모두 읽습니다.
      let ids: string[];
      try {
        const parsed: unknown = JSON.parse(saved);
        ids = Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === 'string')
          : [saved];
      } catch {
        ids = [saved];
      }
      const kept = ids
        .filter((id) => this.dogs.some((dog) => dog.id === id))
        .slice(0, MAX_ACTIVE_DOGS);
      return kept.length ? kept : this.#firstDogIds();
    } catch {
      return this.#firstDogIds();
    }
  }

  #setActive(ids: string[]) {
    this.activeDogIds = ids;
    try {
      localStorage.setItem(ACTIVE_DOG_KEY, JSON.stringify(ids));
    } catch {
      // 저장이 막혀 있어도 이번 방문에는 그대로 적용돼요.
    }
  }

  /** 이 아이 하나만 기준으로 둡니다 (등록·수정 직후처럼 초점을 옮길 때). */
  selectDog(id: string) {
    if (!this.dogs.some((dog) => dog.id === id)) return;
    this.#setActive([id]);
  }

  /**
   * 기준에 넣거나 뺍니다. 둘까지 함께 볼 수 있고, 셋째를 고르면 먼저 고른 아이가 빠집니다.
   * 마지막 한 마리는 빼지 않습니다 — 기준이 없는 상태로 떨어지지 않게요.
   */
  toggleDog(id: string) {
    if (!this.dogs.some((dog) => dog.id === id)) return;
    const current = this.activeDogs.map((dog) => dog.id);
    if (!current.includes(id)) {
      this.#setActive([...current, id].slice(-MAX_ACTIVE_DOGS));
      return;
    }
    if (current.length === 1) return;
    this.#setActive(current.filter((item) => item !== id));
  }

  get filterCount() {
    return Number(this.weightInfoOnly) + Number(this.dogFilterActive);
  }

  get dogFilterActive() {
    return this.mode === 'dog' && this.hideKnownMismatch && this.activeDogs.length > 0;
  }

  get hasFilters() {
    return Boolean(this.query) || this.category !== 'all' || this.filterCount > 0;
  }

  filter(places: Place[]) {
    const dogs = this.activeDogs;
    return searchPlacesByTheme(places, this.query, this.category).filter((place) => {
      if (this.weightInfoOnly && place.sourceWeight === null) return false;
      // 둘을 함께 보고 있으면 한 마리라도 걸리는 곳은 뺍니다. 규정은 느슨한 쪽이 아니라 엄한 쪽으로.
      if (
        this.mode === 'dog' &&
        this.hideKnownMismatch &&
        dogs.some((dog) => profileNotice(place, dog).kind === 'restricted')
      )
        return false;
      return true;
    });
  }

  isSaved(id: string) {
    return this.savedIds.includes(canonicalPlaceId(id));
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
    this.mode = 'all';
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
      this.notify(id ? `${profile.name}의 정보를 수정했어요.` : `${profile.name}를 등록했어요.`);
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
    // 캐릭터는 남기되 주인 표시만 뗍니다 (서버도 ON DELETE SET NULL 로 같게 동작해요).
    if (this.characters.some((character) => character.dogId === id)) {
      this.characters = this.characters.map((character) =>
        character.dogId === id ? { ...character, dogId: null } : character
      );
      this.#saveLocalCharacters();
    }
    if (this.activeDogIds.includes(id)) {
      const rest = this.activeDogIds.filter((item) => item !== id);
      this.#setActive(rest.length ? rest : this.#firstDogIds());
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

  #saveLocalFavorites() {
    if (this.loggedIn) return;
    try {
      localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(this.savedIds));
    } catch {
      // 저장이 막혀 있어도 이번 방문에는 그대로 쓸 수 있어요.
    }
  }

  async toggleSave(place: Place) {
    // 로그인 전에도 찜할 수 있게, 계정 대신 이 브라우저에 담아 둡니다.
    // (강아지 정보와 같은 방식이라, 로그인하면 계정 쪽 기록으로 바뀝니다.)
    if (!this.loggedIn) {
      const saved = !this.isSaved(place.id);
      this.savedIds = saved
        ? [place.id, ...this.savedIds]
        : this.savedIds.filter((id) => id !== place.id);
      this.#saveLocalFavorites();
      this.notify(saved ? '찜한 장소에 저장했어요.' : '찜한 장소에서 지웠어요.');
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
      this.loggedIn = false;
      this.nickname = '';
      // 로그아웃하면 계정 기록 대신 이 브라우저에 담아 둔 기록으로 돌아갑니다.
      this.savedIds = readLocalFavorites();
      this.dogs = readLocalDogs();
      this.characters = readLocalCharacters();
      this.activeDogIds = this.#firstDogIds();
      this.mode = 'all';
      this.notify('로그아웃했어요.');
      void invalidateAll().catch(() => {});
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
function readLocalFavorites(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(LOCAL_FAVORITES_KEY) ?? '[]');
    if (!Array.isArray(saved)) return [];
    return canonicalPlaceIds(saved.filter((id): id is string => typeof id === 'string'));
  } catch {
    // 저장소를 못 쓰는 브라우저(시크릿 모드 등)에서는 이번 방문 동안만 기억합니다.
    return [];
  }
}

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

function readLocalCharacters(): DogCharacter[] {
  try {
    const raw = localStorage.getItem(LOCAL_CHARACTERS_KEY);
    if (!raw) return [];
    const saved: unknown = JSON.parse(raw);
    if (!Array.isArray(saved)) return [];
    return saved.filter(
      (row): row is DogCharacter =>
        Boolean(row) &&
        typeof row === 'object' &&
        typeof (row as DogCharacter).id === 'string' &&
        typeof (row as DogCharacter).finalImage === 'string' &&
        Boolean((row as DogCharacter).layout) &&
        Boolean((row as DogCharacter).params)
    );
  } catch {
    return [];
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
