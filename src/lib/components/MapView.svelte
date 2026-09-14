<script lang="ts">
  import { onMount } from 'svelte';
  import { env } from '$env/dynamic/public';
  import { loadNaverMaps } from '$lib/maps/naver';
  import { MapPin, Plus, Minus, LocateFixed, Coffee, Trees, House, Sparkles } from '@lucide/svelte';
  import type { Place } from '$lib/domain/place';
  let {
    places,
    selectedId,
    onselect,
    appLayout = false
  }: {
    places: Place[];
    selectedId: string | null;
    onselect: (place: Place) => void;
    appLayout?: boolean;
  } = $props();
  let mapElement: HTMLDivElement;
  let ready = $state(false);
  let message = $state('');
  let map: naver.maps.Map;
  let maps: typeof naver.maps;
  let markers: naver.maps.Marker[] = [];
  let markerListeners: naver.maps.MapEventListener[] = [];
  let mapRevision = $state(0);
  let clusterPlaces = $state<Place[]>([]);
  const icons = { food: Coffee, stay: House, outdoor: Trees, activity: Sparkles };
  const x = (place: Place) =>
    Math.max(7, Math.min(91, 12 + ((place.longitude - 128.76) / 0.32) * 76));
  const y = (place: Place) => Math.max(9, Math.min(89, 8 + ((37.95 - place.latitude) / 0.4) * 78));
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

  function clearMarkers() {
    markerListeners.forEach((listener) => maps.Event.removeListener(listener));
    markerListeners = [];
    markers.forEach((marker) => marker.setMap(null));
    markers = [];
  }

  onMount(() => {
    if (!env.PUBLIC_NAVER_MAP_CLIENT_ID) return;
    let disposed = false;
    let idleListener: naver.maps.MapEventListener | undefined;
    const resize = new ResizeObserver(() => {
      if (map) map.setSize(new maps.Size(mapElement.clientWidth, mapElement.clientHeight));
    });
    loadNaverMaps(env.PUBLIC_NAVER_MAP_CLIENT_ID)
      .then((sdk) => {
        if (disposed) return;
        maps = sdk;
        map = new maps.Map(mapElement, {
          center: new maps.LatLng(37.79, 128.9),
          zoom: 12,
          minZoom: 7,
          maxZoom: 20,
          zoomControl: false,
          scaleControl: true,
          logoControlOptions: { position: maps.Position.TOP_RIGHT },
          mapDataControlOptions: { position: maps.Position.TOP_RIGHT },
          padding: { top: 212, right: 8, bottom: 310, left: 8 }
        });
        idleListener = maps.Event.addListener(map, 'idle', () => mapRevision++);
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
        if (idleListener) maps.Event.removeListener(idleListener);
        map?.destroy();
      }
    };
  });

  $effect(() => {
    if (!ready) return;
    mapRevision;
    clearMarkers();
    const bins = new Map<string, Place[]>();
    for (const place of places) {
      const point = map
        .getProjection()
        .fromCoordToOffset(new maps.LatLng(place.latitude, place.longitude));
      const key =
        place.id === selectedId
          ? place.id
          : `${Math.floor(point.x / 52)}:${Math.floor(point.y / 52)}`;
      bins.set(key, [...(bins.get(key) ?? []), place]);
    }
    for (const items of bins.values()) {
      const lat = items.reduce((sum, p) => sum + p.latitude, 0) / items.length;
      const lng = items.reduce((sum, p) => sum + p.longitude, 0) / items.length;
      const position = new maps.LatLng(lat, lng);
      const button = document.createElement('button');
      const single = items.length === 1;
      button.className =
        'live-map-marker' + (single && items[0].id === selectedId ? ' selected' : '');
      button.textContent = single ? items[0].name : String(items.length);
      button.setAttribute(
        'aria-label',
        single ? `${items[0].name} 동반 규정 보기` : `근처 ${items.length}곳 목록 보기`
      );
      const marker = new maps.Marker({
        map,
        position,
        icon: { content: button, anchor: new maps.Point(single ? 45 : 18, 20) },
        zIndex: single && items[0].id === selectedId ? 100 : 1
      });
      const choose = () => {
        if (single) onselect(items[0]);
        else {
          clusterPlaces = items;
          map.panTo(position);
        }
      };
      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          choose();
        }
      });
      markerListeners.push(maps.Event.addListener(marker, 'click', choose));
      markers.push(marker);
    }
  });

  $effect(() => {
    if (ready && selected) map.panTo(new maps.LatLng(selected.latitude, selected.longitude));
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
        map.panTo(new maps.LatLng(position.coords.latitude, position.coords.longitude));
        message = '현재 위치로 이동했어요.';
      },
      () => {
        message = '위치 권한을 확인해 주세요. 강릉 지도는 계속 이용할 수 있어요.';
      },
      { timeout: 10000 }
    );
  }
</script>

<div class="map-shell" class:app-map={appLayout}>
  <div bind:this={mapElement} class="live-map" class:visible={ready}></div>
  {#if !ready}
    <div class="preview-map" aria-label="강릉 장소의 개략적인 위치 미리보기">
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
          d="M640 0 575 125 590 250 625 360 695 460 720 570 785 680 800 780 930 1000H1000V0Z"
          fill="#dcecef"
        />
        <path
          d="M640 0 575 125 590 250 625 360 695 460 720 570 785 680 800 780 930 1000"
          fill="none"
          stroke="#faf8ef"
          stroke-width="17"
        />
        <path
          d="M175 0 280 180 235 310 335 485 290 620 395 800 430 1000M0 565 300 535 520 625 785 680M0 280 280 250 590 250M140 1000 240 800 445 745 735 770"
          fill="none"
          stroke="#fff"
          stroke-width="18"
        />
        <path
          d="M170 0 275 180 230 310 330 485 285 620 390 800 425 1000"
          fill="none"
          stroke="#e9d9b8"
          stroke-width="5"
        />
        <path
          d="M0 620Q200 570 330 645T710 695L790 710"
          fill="none"
          stroke="#dcecef"
          stroke-width="24"
        />
        <ellipse cx="515" cy="365" rx="58" ry="43" fill="#dcecef" />
        <path d="M495 307Q560 300 578 354" fill="none" stroke="#dce4cf" stroke-width="22" />
      </svg>
      <span class="area-label" style="left:28%;top:28%">사천면</span>
      <span class="area-label" style="left:39%;top:59%">강릉시</span>
      <span class="sea-label" style="left:82%;top:35%">동 해</span>
      <span class="area-label small" style="left:49%;top:35%">경포호</span>
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
  <div class="map-location">
    <MapPin size={15} /><span>강원특별자치도 <strong>강릉시</strong></span><span class="live-dot"
    ></span>
  </div>
  <div class="map-caption">
    <span class="legend-dot"></span>반려견 동반 정보가 있는 장소 <strong>{places.length}</strong>
  </div>
  <div class="map-controls">
    <button
      aria-label="지도 확대"
      disabled={!ready}
      onclick={() => map.setZoom(map.getZoom() + 1, true)}><Plus size={20} /></button
    >
    <button
      aria-label="지도 축소"
      disabled={!ready}
      onclick={() => map.setZoom(map.getZoom() - 1, true)}><Minus size={20} /></button
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
    color: #909586;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 2px;
  }
  .area-label.small {
    font-size: 11px;
    font-weight: 400;
    color: #92a6a7;
    letter-spacing: 0;
  }
  .sea-label {
    position: absolute;
    color: #9bb6bd;
    letter-spacing: 9px;
    font-size: 16px;
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
    bottom: 30px;
  }
  .app-map .map-controls {
    bottom: calc(var(--app-nav-height, 64px) + 248px);
    right: 16px;
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
    .app-map .map-controls,
    .app-map .map-message {
      bottom: calc(var(--app-nav-height, 64px) + 210px);
    }
    .app-map .preview-label {
      bottom: calc(var(--app-nav-height, 64px) + 206px);
    }
  }
</style>
