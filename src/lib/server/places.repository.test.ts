import { beforeEach, describe, expect, it, vi } from 'vitest';

const { env, query } = vi.hoisted(() => ({ env: { DATABASE_URL: '' }, query: vi.fn() }));
vi.mock('$env/dynamic/private', () => ({ env }));
vi.mock('./db', () => ({ database: () => query }));
import { getPlaces } from './places.repository';

beforeEach(() => {
  env.DATABASE_URL = '';
  query.mockReset();
});

describe('place data source', () => {
  it('allows the UI preview without making a database request', async () => {
    const places = await getPlaces();
    expect(places).toHaveLength(176);
    expect(places.every((place) => place.verifiedAt === null)).toBe(true);
    expect(query).not.toHaveBeenCalled();
  });
  it('carries the cafe/restaurant split and the hospital records in the snapshot', async () => {
    const places = await getPlaces();
    const food = places.filter((place) => place.category === 'food');
    expect(food.length).toBeGreaterThan(0);
    // 식음료는 빠짐없이 카페/식당 중 하나로 갈려 있어야 합니다.
    expect(food.every((place) => place.foodKind === 'cafe' || place.foodKind === 'restaurant')).toBe(
      true
    );
    const hospitals = places.filter((place) => place.category === 'hospital');
    expect(hospitals).toHaveLength(12);
    // 좌표 없이 들어오면 지도에서 조용히 사라지므로 여기서 막습니다.
    expect(
      hospitals.every(
        (place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
      )
    ).toBe(true);
    expect(places.filter((place) => place.category !== 'food').every((p) => p.foodKind === null)).toBe(
      true
    );
  });
  it('uses database records when configured, including an intentionally empty result', async () => {
    env.DATABASE_URL = 'configured-for-test';
    query.mockResolvedValue([]);
    expect(await getPlaces()).toEqual([]);
    expect(query).toHaveBeenCalledOnce();
  });
  it('returns a safe service error instead of falling back to stale records on database failure', async () => {
    env.DATABASE_URL = 'configured-for-test';
    query.mockRejectedValue(new Error('private connection details'));
    await expect(getPlaces()).rejects.toMatchObject({
      status: 503,
      body: { message: '장소 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }
    });
  });
});
