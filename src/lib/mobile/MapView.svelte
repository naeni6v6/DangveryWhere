<script lang="ts">
  import { onMount } from 'svelte';
  import { env } from '$env/dynamic/public';
  import { loadNaverMaps } from '$lib/maps/naver';
  import {
    MapPin,
    Plus,
    Minus,
    LocateFixed,
    Coffee,
    Trees,
    House,
    Sparkles,
    Landmark,
    ShoppingBag
  } from '@lucide/svelte';
  import { placeArea, placeTheme, type Place } from '$lib/domain/place';
  import { themeIconSvg } from '$lib/components/themeIconPaths';
  import { DEFAULT_REGION_ID, findRegion, type RegionId } from '$lib/domain/region';
  let {
    places,
    selectedId,
    onselect,
    appLayout = false,
    caption = '반려견 동반 정보가 있는 장소',
    padding = { top: 212, right: 8, bottom: 310, left: 8 },
    regionId = DEFAULT_REGION_ID
  }: {
    places: Place[];
    selectedId: string | null;
    onselect: (place: Place) => void;
    appLayout?: boolean;
    /** 지도 위 설명 문구. 동물병원처럼 '동반 장소'가 아닌 목록에서 바꿔 씁니다. */
    caption?: string;
    /** Map viewport padding so overlaid panels do not hide the fitted area. */
    padding?: { top: number; right: number; bottom: number; left: number };
    /** 보고 있는 지역. 지도 중심·확대 단계와 개략도의 지명이 여기서 나옵니다. */
    regionId?: RegionId;
  } = $props();
  const region = $derived(findRegion(regionId) ?? findRegion(DEFAULT_REGION_ID)!);
  let mapElement: HTMLDivElement;
  let ready = $state(false);
  let message = $state('');
  let map: naver.maps.Map;
  let maps: typeof naver.maps;
  let markers: naver.maps.Marker[] = [];
  let mapRevision = $state(0);
  let clusterPlaces = $state<Place[]>([]);
  // 장소가 없는 시군구도 포함해 강원 18개 시군구 전체를 담는 지도 범위입니다.
  const gangwonBounds = { south: 36.95, west: 127.0, north: 38.65, east: 129.45 };
  // 지도를 못 불러왔을 때 보여 주는 대체 지도용 아이콘입니다.
  // hospital 은 웹(PC) 전용 분류지만, 값이 비면 마커가 깨지므로 여기도 채워 둡니다.
  const icons = {
    food: Coffee,
    stay: House,
    outdoor: Trees,
    activity: Sparkles,
    hospital: MapPin,
    culture: Landmark,
    shopping: ShoppingBag
  };

  /**
   * 지도 위 지역 표시. 지역명을 박아 두지 않고 지금 보이는 장소들에서 뽑아 냅니다.
   * 한 시군구에 모여 있을 때만 보여 주고, 여러 지역이 섞이면 숨깁니다.
   */
  const locationLabel = $derived.by(() => {
    const areas = new Set<string>();
    for (const place of places) {
      const { province, city } = placeArea(place);
      if (city) areas.add(`${province}\u0000${city}`);
    }
    if (areas.size !== 1) return null;
    const [province, city] = [...areas][0].split('\u0000');
    return { province, city };
  });
  /**
   * 개략도(실제 지도 연결 전)의 좌표 변환.
   * 지금 보이는 장소들의 범위에 맞춰 늘려, 어느 지역을 골라도 한 덩어리로 뭉치지 않게 합니다.
   */
  const bounds = $derived.by(() => {
    if (!places.length) return { west: 0, east: 1, north: 1, south: 0 };
    const lats = places.map((place) => place.latitude);
    const lngs = places.map((place) => place.longitude);
    // 한 곳만 있을 때 0 으로 나누지 않도록 최소 폭을 둡니다.
    const pad = 0.01;
    return {
      west: Math.min(...lngs) - pad,
      east: Math.max(...lngs) + pad,
      north: Math.max(...lats) + pad,
      south: Math.min(...lats) - pad
    };
  });
  const x = (place: Place) =>
    Math.max(
      7,
      Math.min(91, 9 + ((place.longitude - bounds.west) / (bounds.east - bounds.west)) * 82)
    );
  const y = (place: Place) =>
    Math.max(
      9,
      Math.min(89, 10 + ((bounds.north - place.latitude) / (bounds.north - bounds.south)) * 76)
    );
  const groups = $derived.by(() => {
    const bins = new Map<string, Place[]>();
    for (const place of places) {
      const key = `${Math.floor(x(place) / 8)}-${Math.floor(y(place) / 7)}`;
      bins.set(key, [...(bins.get(key) ?? []), place]);
    }
    return Array.from(bins.entries()).map(([key, items]) => ({
      key,
      items,
      x: items.reduce((sum, p) => sum + x(p), 0) / items.length,
      y: items.reduce((sum, p) => sum + y(p), 0) / items.length
    }));
  });
  const selected = $derived(places.find((place) => place.id === selectedId));
  $effect(() => {
    places;
    clusterPlaces = [];
  });

  /** 이 픽셀 안에 든 장소는 한 뭉치로 묶습니다 (네이버 지도의 묶음 간격과 비슷한 값). */
  const CLUSTER_RADIUS = 54;
  /** 이름표에 남기는 글자 수. 넘치면 CSS 가 … 로 줄입니다. */
  const NAME_MAX = 11;
  /** 이름표 아래 꼬리 높이. 꼬리 끝이 정확히 그 장소를 가리킵니다. */
  const TAIL = 7;
  type Box = { left: number; right: number; top: number; bottom: number };

  /** 묶음 동그라미 지름. 많이 묶일수록 크게 그려 한눈에 무게를 알 수 있게 합니다. */
  const clusterSize = (count: number) => (count < 10 ? 36 : count < 30 ? 44 : 52);

  /**
   * 마커 겉껍데기. 크기가 0 인 상자를 장소 위치에 딱 붙여 두고,
   * 안의 내용만 밀어 올립니다(이름표는 위로, 동그라미는 가운데로).
   * 네이버 지도에 넘기는 anchor 를 (0,0) 으로 두고 자리는 CSS 로 잡는 방식이에요.
   */
  function shell(kind: 'pin' | 'dot' | 'cluster') {
    const wrap = document.createElement('div');
    wrap.className = `live-marker live-marker-${kind}`;
    return wrap;
  }

  /**
   * 흰 바탕 이름표 — 분류 아이콘 + 가게 이름. 지도 위에서 글자가 먼저 읽히도록.
   * 묶인 곳이 있으면 '+3' 을 뒤에 답니다. 숫자만 떠 있는 것보다,
   * 대표 가게 이름이 보이는 편이 '여기 뭐가 있나'를 훨씬 빨리 알려 줘요.
   */
  function labelElement(place: Place, chosen: boolean, extra: number) {
    const wrap = shell('pin');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'live-map-marker' + (chosen ? ' selected' : '');
    button.setAttribute(
      'aria-label',
      extra ? `${place.name} 외 ${extra}곳 목록 보기` : `${place.name} 동반 규정 보기`
    );
    button.innerHTML =
      `<span class="marker-icon" aria-hidden="true">${themeIconSvg(placeTheme(place), 14)}</span>` +
      '<span class="marker-name"></span>' +
      (extra ? `<span class="marker-more">+${extra}</span>` : '') +
      '<span class="marker-tail" aria-hidden="true"></span>';
    // 가게 이름은 외부 자료라 HTML 로 붙이지 않고 글자로만 넣습니다.
    button.querySelector('.marker-name')!.textContent = place.name;
    wrap.appendChild(button);
    return wrap;
  }

  /** 이름표가 들어갈 자리가 없을 때의 작은 점. 확대하면 다시 이름표가 됩니다. */
  function dotElement(place: Place) {
    const wrap = shell('dot');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'live-map-dot';
    button.dataset.name = place.name;
    button.setAttribute('aria-label', `${place.name} 동반 규정 보기`);
    wrap.appendChild(button);
    return wrap;
  }

  /** 가까이 몰린 곳들을 묶은 동그라미. 숫자가 몇 곳인지 알려 줍니다. */
  function clusterElement(count: number) {
    const wrap = shell('cluster');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'live-map-cluster';
    button.style.setProperty('--cluster-size', `${clusterSize(count)}px`);
    button.textContent = String(count);
    button.setAttribute('aria-label', `근처 ${count}곳 목록 보기`);
    wrap.appendChild(button);
    return wrap;
  }

  function clearMarkers() {
    // The SDK can invalidate its internals after a delayed origin/auth failure.
    // Cleanup must never abort Svelte's route update or prevent another tab opening.
    markers.forEach((marker) => {
      try {
        marker.setMap(null);
      } catch {
        /* The SDK has already released it. */
      }
    });
    markers = [];
  }

  function mapFailed() {
    ready = false;
    message = '지도를 연결하지 못했어요. 장소 검색과 목록은 계속 이용할 수 있어요.';
  }

  function useMap(action: () => void) {
    if (!ready) return;
    try {
      action();
    } catch {
      mapFailed();
    }
  }

  onMount(() => {
    if (!env.PUBLIC_NAVER_MAP_CLIENT_ID) return;
    let disposed = false;
    let idleListener: naver.maps.MapEventListener | undefined;
    const resize = new ResizeObserver(() => {
      if (!map || !ready) return;
      const { clientWidth, clientHeight } = mapElement;
      // 지도가 잠깐 감춰지면 0 이 들어오는데, 그대로 넘기면 지도가 0 으로 접힌 채
      // 다시 펴지지 않습니다(펼 크기를 지도 자신에게서 읽어 오기 때문에요).
      if (!clientWidth || !clientHeight) return;
      useMap(() => map.setSize(new maps.Size(clientWidth, clientHeight)));
    });
    loadNaverMaps(env.PUBLIC_NAVER_MAP_CLIENT_ID)
      .then((sdk) => {
        if (disposed) return;
        maps = sdk;
        map = new maps.Map(mapElement, {
          center: new maps.LatLng(region.center.lat, region.center.lng),
          zoom: region.zoom,
          minZoom: 6,
          maxZoom: 20,
          zoomControl: false,
          scaleControl: true,
          logoControlOptions: { position: maps.Position.TOP_RIGHT },
          mapDataControlOptions: { position: maps.Position.TOP_RIGHT },
          padding
        });
        idleListener = maps.Event.addListener(map, 'idle', () => {
          if (!disposed) mapRevision++;
        });
        resize.observe(mapElement);
        ready = true;
      })
      .catch((failure: unknown) => {
        console.error(
          'Map initialization failed:',
          failure instanceof Error ? failure.message : 'Unknown map error'
        );
        if (!disposed) message = '네이버 지도를 불러오지 못했어요. 장소 목록은 이용할 수 있어요.';
      });
    return () => {
      disposed = true;
      resize.disconnect();
      if (maps) {
        clearMarkers();
        try {
          if (idleListener) maps.Event.removeListener(idleListener);
        } catch {
          /* Invalidated SDK. */
        }
        try {
          map?.destroy();
        } catch {
          /* Invalidated SDK. */
        }
      }
    };
  });

  /** 이름표 한 장이 차지하는 자리. 실제로 재지 않고 글자 수로 어림합니다. */
  function labelBox(name: string, extra: number) {
    const letters = Math.min(name.length, NAME_MAX);
    return { width: 54 + letters * 13 + (extra ? 36 : 0), height: 40 };
  }

  const overlaps = (a: Box, b: Box) =>
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

  /**
   * 마커 다시 그리기.
   *
   * 예전에는 보이는 장소를 전부 이름표로 그려서, 해안가처럼 가게가 몰린 곳은
   * 이름표가 서로를 덮어 아무것도 읽히지 않았습니다. 네이버·카카오 지도가 하는 대로
   *   ① 아주 가까운 곳들은 한 뭉치로 묶고 (대표 한 곳 + '+3')
   *   ② 앞에서부터 이름표를 놓되, 이미 놓인 것과 겹치면 동그라미로 낮춥니다.
   *      (묶음은 숫자 동그라미, 한 곳짜리는 작은 점)
   * 확대하면 동그라미가 다시 이름표로 펴집니다.
   * 순서는 목록과 같아서, 사진이 있는 곳이 이름표를 먼저 가져갑니다.
   */
  $effect(() => {
    if (!ready) return;
    try {
      mapRevision;
      clearMarkers();
      const projection = map.getProjection();
      // 화면 좌표로 바꿔 두고, 가까운 것끼리 차례로 묶습니다.
      // 칸(격자)으로 나누면 칸 경계를 사이에 둔 두 곳이 붙어 있는데도 따로 놀고,
      // 묶음 동그라미끼리 서로 겹쳐 버려요. 앞에서부터 반지름 안에 드는 것을 주워 담으면
      // 묶음끼리 최소 간격이 지켜집니다.
      const spots: {
        items: Place[];
        x: number;
        y: number;
        lat: number;
        lng: number;
        solo: boolean;
      }[] = [];
      // 고른 곳이 맨 앞. 나머지는 목록 순서(사진 있는 곳이 앞)를 그대로 따릅니다.
      const ordered = [...places].sort(
        (a, b) => Number(b.id === selectedId) - Number(a.id === selectedId)
      );
      for (const place of ordered) {
        const point = projection.fromCoordToOffset(
          new maps.LatLng(place.latitude, place.longitude)
        );
        // 고른 곳은 뭉치 속에 숨지 않게 언제나 혼자 세웁니다.
        const solo = place.id === selectedId;
        const near = solo
          ? undefined
          : spots.find(
              (spot) =>
                !spot.solo && Math.hypot(spot.x - point.x, spot.y - point.y) < CLUSTER_RADIUS
            );
        if (near) near.items.push(place);
        else
          spots.push({
            items: [place],
            x: point.x,
            y: point.y,
            lat: place.latitude,
            lng: place.longitude,
            solo
          });
      }

      const taken: Box[] = [];
      let rank = 0;
      for (const spot of spots) {
        const position = new maps.LatLng(spot.lat, spot.lng);
        const extra = spot.items.length - 1;
        const place = spot.items[0];
        const chosen = spot.solo && place.id === selectedId;
        // 이름표를 놓을 자리가 있는지 먼저 봅니다. 없으면 동그라미로 낮춰요.
        const { width, height } = labelBox(place.name, extra);
        const box = {
          left: spot.x - width / 2,
          right: spot.x + width / 2,
          top: spot.y - height - TAIL,
          bottom: spot.y
        };
        // 고른 곳은 겹치더라도 이름표를 내주지 않습니다.
        const fits = chosen || !taken.some((other) => overlaps(box, other));
        const element = fits
          ? labelElement(place, chosen, extra)
          : extra
            ? clusterElement(spot.items.length)
            : dotElement(place);
        const radius = extra ? clusterSize(spot.items.length) / 2 : 11;
        taken.push(
          fits
            ? box
            : {
                left: spot.x - radius,
                right: spot.x + radius,
                top: spot.y - radius,
                bottom: spot.y + radius
              }
        );
        const zIndex = chosen ? 400 : fits ? 200 - Math.min(rank, 120) : extra ? 120 : 60;
        const button = element.firstElementChild as HTMLButtonElement;
        const marker = new maps.Marker({
          map,
          position,
          icon: { content: element, anchor: new maps.Point(0, 0) },
          zIndex
        });
        const choose = () => {
          if (!extra) onselect(place);
          else {
            clusterPlaces = spot.items;
            useMap(() => map.panTo(position));
          }
        };
        // Native buttons provide touch, mouse and keyboard activation consistently.
        // Do not retain SDK listener handles across marker redraws.
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          choose();
        });
        markers.push(marker);
        rank++;
      }
    } catch {
      mapFailed();
    }
  });

  function showRegion() {
    useMap(() => {
      if (region.id === 'all') {
        map.fitBounds(
          new maps.LatLngBounds(
            new maps.LatLng(gangwonBounds.south, gangwonBounds.west),
            new maps.LatLng(gangwonBounds.north, gangwonBounds.east)
          ),
          // MapOptions.padding already reserves space for the bottom results sheet.
          { maxZoom: 9 }
        );
      } else {
        map.setCenter(new maps.LatLng(region.center.lat, region.center.lng));
        map.setZoom(region.zoom, true);
      }
    });
  }

  // 지역을 바꾸면 그 지역으로 옮겨 갑니다. 같은 지역 안에서 지도를 움직인 것은 되돌리지 않아요.
  // 화면에 그리는 값이 아니라 '이미 옮겨 갔는지' 표시라, 반응형으로 두지 않습니다.
  let shownRegion: RegionId | null = null;
  $effect(() => {
    if (!ready || shownRegion === region.id) return;
    shownRegion = region.id;
    showRegion();
  });

  $effect(() => {
    if (ready && selected)
      useMap(() => map.panTo(new maps.LatLng(selected.latitude, selected.longitude)));
  });

  function locate() {
    if (!ready) {
      message = '현재 위치는 실제 지도가 연결되면 사용할 수 있어요.';
      return;
    }
    if (!navigator.geolocation) {
      message = '이 브라우저는 현재 위치를 지원하지 않아요.';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        useMap(() => {
          map.panTo(new maps.LatLng(position.coords.latitude, position.coords.longitude));
          message = '현재 위치로 이동했어요.';
        });
      },
      () => {
        message = '위치 권한을 확인해 주세요. 지도는 계속 이용할 수 있어요.';
      },
      { timeout: 10000 }
    );
  }
</script>

<div class="map-shell" class:app-map={appLayout}>
  <div bind:this={mapElement} class="live-map" class:visible={ready}></div>
  {#if !ready}
    <div class="preview-map" aria-label={`${region.label} 장소의 개략적인 위치 미리보기`}>
      <!--
        실제 지도를 못 불러왔을 때의 개략도.
        마커 자리는 '지금 보이는 장소들의 좌표 범위'를 이 상자에 늘려 맞춘 값이라, 여기 그려진
        그림과는 아무 관계가 없습니다. 예전에는 강릉 해안선을 본떠 바다까지 그려 두었는데,
        그러니 바닷물 위에 가게 동그라미가 둥둥 떠 있었어요. 그래서 배경은 어느 지역에나
        맞는 무늬와 길만 남기고, 지형이라고 읽힐 만한 것(바다·호수·해안도로)은 그리지 않습니다.
      -->
      <svg class="map-art" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
        <defs
          ><pattern
            id="blocks"
            width="75"
            height="80"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-21)"
            ><rect width="75" height="80" fill="#f1f0e9" /><rect
              x="9"
              y="10"
              width="52"
              height="55"
              rx="5"
              fill="#e9e9e0"
            /><path d="M0 0H75M0 0V80" stroke="#fff" stroke-width="8" /></pattern
          ></defs
        >
        <rect width="1000" height="1000" fill="url(#blocks)" />
        <path d="M0 0H250L170 160 210 300 120 500 150 700 0 910Z" fill="#e0e6d5" />
        <path
          d="M175 0 280 180 235 310 335 485 290 620 395 800 430 1000M0 565 300 535 520 625 785 680M0 280 280 250 590 250M140 1000 240 800 445 745 735 770"
          fill="none"
          stroke="#fff"
          stroke-width="18"
        />
      </svg>
      <!-- 위쪽은 지역 뱃지·설명 알약이 쓰고 있어서, 지명은 왼쪽 아래에 둡니다 -->
      <span class="area-label">{region.label}</span>
      {#each groups as group (group.key)}
        {#if group.items.length === 1}
          {@const place = group.items[0]}
          {@const Icon = icons[place.category]}
          <button
            class="preview-marker"
            class:active={place.id === selectedId}
            style={`left:${group.x}%;top:${group.y}%`}
            onclick={() => onselect(place)}
            aria-label={`${place.name} 동반 규정 보기`}
            title={place.name}><Icon size={16} strokeWidth={1.8} /><span>{place.name}</span></button
          >
        {:else}
          <button
            class="preview-marker cluster"
            style={`left:${group.x}%;top:${group.y}%`}
            onclick={() => (clusterPlaces = group.items)}
            aria-label={`근처 ${group.items.length}곳 목록 보기`}>{group.items.length}</button
          >
        {/if}
      {/each}
      {#if selected}<div class="selected-label" style={`left:${x(selected)}%;top:${y(selected)}%`}>
          {selected.name}
        </div>{/if}
    </div>
  {/if}
  {#if locationLabel}
    <div class="map-location">
      <MapPin size={15} /><span>{locationLabel.province} <strong>{locationLabel.city}</strong></span
      ><span class="live-dot"></span>
    </div>
  {/if}
  <div class="map-caption">
    <span class="legend-dot"></span>{caption} <strong>{places.length}</strong>
  </div>
  <div class="map-controls">
    <button
      aria-label="지도 확대"
      disabled={!ready}
      onclick={() => useMap(() => map.setZoom(map.getZoom() + 1, true))}><Plus size={20} /></button
    >
    <button
      aria-label="지도 축소"
      disabled={!ready}
      onclick={() => useMap(() => map.setZoom(map.getZoom() - 1, true))}><Minus size={20} /></button
    >
    <button aria-label="현재 위치로 이동" onclick={locate}><LocateFixed size={20} /></button>
  </div>
  {#if !ready}<div class="preview-label">위치 개략도 · 실제 지도 연결 전 미리보기</div>{/if}
  {#if clusterPlaces.length}<div class="cluster-list">
      <div>
        <strong>이 근처 {clusterPlaces.length}곳</strong><button
          onclick={() => (clusterPlaces = [])}>닫기</button
        >
      </div>
      {#each clusterPlaces as place}<button
          onclick={() => {
            onselect(place);
            clusterPlaces = [];
          }}><MapPin size={13} />{place.name}</button
        >{/each}
    </div>{/if}
  {#if message}<button
      class="map-message"
      onclick={() => (message = '')}
      aria-label="지도 안내 닫기">{message}</button
    >{/if}
</div>

<style>
  .map-shell {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 400px;
    overflow: hidden;
    background: #f0f0e8;
  }
  .live-map {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    visibility: hidden;
  }
  .live-map.visible {
    visibility: visible;
  }
  .preview-map {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .map-art {
    width: 100%;
    height: 100%;
    position: absolute;
    inset: 0;
  }
  .map-location {
    position: absolute;
    top: 26px;
    left: 26px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 13px 17px;
    border: 1px solid #eee9e1;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 20px #5445340a;
    font-size: 11px;
    color: var(--muted);
    z-index: 2;
  }
  .map-location strong {
    color: var(--ink);
    margin-left: 4px;
  }
  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #829379;
    margin-left: 8px;
  }
  .map-caption {
    position: absolute;
    bottom: 25px;
    left: 25px;
    display: flex;
    align-items: center;
    gap: 8px;
    background: #ffffffed;
    padding: 12px 15px;
    border-radius: 9px;
    font-size: 11px;
    z-index: 2;
  }
  .legend-dot {
    height: 7px;
    width: 7px;
    border-radius: 50%;
    background: var(--brown);
  }
  .area-label {
    position: absolute;
    left: 16px;
    bottom: 14px;
    color: #909586;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 2px;
  }
  .preview-marker {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 33px;
    height: 33px;
    border: 2px solid white;
    border-radius: 50% 50% 50% 9px;
    background: var(--brown);
    color: white;
    display: grid;
    place-items: center;
    box-shadow: 0 2px 6px #59453433;
    cursor: pointer;
    z-index: 1;
  }
  .preview-marker:hover,
  .preview-marker.active {
    z-index: 5;
    background: #493323;
    transform: translate(-50%, -50%) scale(1.12);
  }
  .preview-marker span {
    display: none;
    position: absolute;
    bottom: 43px;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    color: var(--ink);
    font-size: 11px;
    font-weight: 600;
    border-radius: 8px;
    padding: 9px 12px;
    white-space: nowrap;
    box-shadow: 0 4px 15px #0001;
  }
  .preview-marker:hover span,
  .preview-marker.active span {
    display: block;
  }
  .map-controls {
    position: absolute;
    right: 25px;
    bottom: 90px;
    z-index: 2;
    display: grid;
    gap: 1px;
    border: 1px solid var(--line);
    background: var(--line);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 16px #0001;
  }
  .map-controls button {
    display: grid;
    place-items: center;
    background: white;
    border: 0;
    width: 42px;
    height: 42px;
    color: var(--brown);
    cursor: pointer;
  }
  .map-controls button:disabled {
    color: #c6c0b6;
    cursor: default;
  }
  .preview-label {
    position: absolute;
    bottom: 6px;
    right: 10px;
    font-size: 9px;
    color: #777d73;
    background: #fffc;
    padding: 3px 6px;
    z-index: 2;
  }
  .map-message {
    position: absolute;
    bottom: 84px;
    left: 50%;
    transform: translateX(-50%);
    border: 0;
    background: #3c352fea;
    color: white;
    font-size: 12px;
    line-height: 1.5;
    padding: 14px;
    border-radius: 10px;
    z-index: 10;
    max-width: 85%;
    width: 330px;
  }
  .map-message:hover {
    background: #3c352f;
  }
  .map-location {
    top: 18px;
    left: 16px;
    padding: 11px 13px;
  }
  .map-caption {
    bottom: auto;
    top: 70px;
    left: 16px;
    font-size: 10px;
    padding: 11px;
  }
  .map-controls {
    right: 16px;
    bottom: 65px;
  }

  .preview-marker.cluster {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 13px;
    font-weight: 600;
  }
  .selected-label {
    position: absolute;
    z-index: 6;
    transform: translate(-50%, -150%);
    background: white;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 9px 12px;
    box-shadow: 0 3px 14px #0001;
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
  }
  .cluster-list {
    position: absolute;
    z-index: 12;
    right: 20px;
    top: 83px;
    max-height: 300px;
    width: 245px;
    background: white;
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: auto;
    padding: 12px;
    box-shadow: 0 8px 35px #3b2a241a;
  }
  .cluster-list > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 5px 10px;
    font-size: 12px;
  }
  .cluster-list > div button {
    border: 0;
    background: none;
    font-size: 10px;
    color: var(--muted);
  }
  .cluster-list > button {
    border: 0;
    border-top: 1px solid var(--line);
    display: flex;
    align-items: center;
    gap: 7px;
    background: white;
    width: 100%;
    padding: 12px 5px;
    text-align: left;
    font-size: 11px;
  }
  .cluster-list > button:hover {
    background: var(--cream);
  }
  .app-map .map-location,
  .app-map .map-caption {
    display: none;
  }
  .app-map .map-controls {
    top: 15px;
    bottom: auto;
    right: 12px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .app-map .preview-label {
    bottom: calc(var(--app-nav-height, 64px) + 238px);
    left: 12px;
    right: auto;
    font-size: 9px;
    border-radius: 5px;
  }
  .app-map .cluster-list {
    top: 218px;
    right: 16px;
    max-height: min(250px, 30dvh);
  }
  .app-map .map-message {
    bottom: calc(var(--app-nav-height, 64px) + 248px);
  }

  @container app-shell (max-height: 680px) {
    .app-map .map-controls button:disabled {
      display: none;
    }
    .app-map .map-message {
      bottom: calc(var(--app-nav-height, 64px) + 210px);
    }
    .app-map .preview-label {
      bottom: calc(var(--app-nav-height, 64px) + 206px);
    }
  }
</style>
