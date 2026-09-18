<script lang="ts">
  import type { MenuGroup, MenuSource } from '$lib/domain/place';
  let {
    groups,
    notes = [],
    source = null,
    emptyText,
    compact = false
  }: {
    groups: MenuGroup[];
    notes?: string[];
    /** 사진·설명이 있는 메뉴판일 때만. 공공데이터 문구에는 없습니다. */
    source?: MenuSource | null;
    /** 원본에 메뉴 칸이 아예 없을 때 대신 보여 줄 한 줄 */
    emptyText: string;
    /** 모바일 시트(좁은 폭)용. 사진과 글자를 한 단계씩 줄입니다. */
    compact?: boolean;
  } = $props();
  // 사진 주소가 깨진 줄은 사진 칸을 지우고 글자만 남깁니다 (빈 네모를 남기지 않으려고요).
  let broken = $state<string[]>([]);
  const hasMenu = $derived(groups.length > 0 || notes.length > 0);
</script>

<div class="menu-board" class:compact>
  {#each groups as group, i (i)}
    {#if group.title}<strong class="menu-group">{group.title}</strong>{/if}
    <ul class="menu-list">
      {#each group.items as item (item.name)}
        <!-- 이름(과 가격)뿐인 줄은 한 단계 좁게. 공공데이터만 있는 가게는 열 줄이 그냥 이어져요. -->
        <li class="menu-row" class:bare={!item.photo && !item.description}>
          <div class="menu-text">
            {#if item.signature}<span class="menu-badge">대표</span>{/if}
            <strong class="menu-name">{item.name}</strong>
            {#if item.description}<p class="menu-desc">{item.description}</p>{/if}
            {#if item.price}<span class="menu-price">{item.price}</span>{/if}
          </div>
          {#if item.photo && !broken.includes(item.photo)}
            <img
              class="menu-photo"
              src={item.photo}
              alt=""
              loading="lazy"
              onerror={() => (broken = [...broken, item.photo!])}
            />
          {/if}
        </li>
      {/each}
    </ul>
  {/each}
  {#each notes as note (note)}<p class="menu-note">{note}</p>{/each}
  <!-- 원본에 메뉴 칸 자체가 없는 가게가 있습니다. 없는 걸 지어내지 않습니다. -->
  {#if !hasMenu}<p class="menu-note empty">{emptyText}</p>{/if}
  {#if hasMenu}
    <p class="menu-foot">
      {#if source}
        메뉴·사진·가격은 {source.name}에 올라온 가게 메뉴판을 옮긴 것으로, 바뀔 수 있어요.
        {#if source.url}<a href={source.url} target="_blank" rel="noreferrer">가게 메뉴판 보기</a
          >{/if}
      {:else}
        메뉴와 가격은 바뀔 수 있어요. 방문 전에 확인해 주세요.
      {/if}
    </p>
  {/if}
</div>

<style>
  .menu-group {
    display: block;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--muted);
    margin: 14px 0 2px;
  }
  .menu-group:first-child {
    margin-top: 0;
  }
  .menu-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .menu-row {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 13px 0;
    border-top: 1px solid var(--line);
  }
  .menu-list:first-child > .menu-row:first-child,
  .menu-group + .menu-list > .menu-row:first-child {
    border-top: 0;
    padding-top: 2px;
  }
  .menu-row.bare {
    align-items: baseline;
    gap: 10px;
    padding: 8px 0;
  }
  .menu-row.bare .menu-name {
    font-size: 14px;
    font-weight: 500;
  }
  /* 사진도 설명도 없으면 가격을 이름 옆으로 붙여 한 줄로 읽힙니다. */
  .menu-row.bare .menu-price {
    margin: 0 0 0 auto;
    padding-left: 10px;
    font-size: 13.5px;
    white-space: nowrap;
  }
  .menu-row.bare .menu-text {
    display: flex;
    align-items: baseline;
  }
  .menu-text {
    flex: 1;
    min-width: 0;
  }
  .menu-badge {
    display: inline-block;
    margin-bottom: 5px;
    padding: 2px 7px;
    border: 1px solid var(--line);
    border-radius: 5px;
    background: #fff;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--muted);
    line-height: 1.5;
  }
  .menu-name {
    display: block;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.45;
    word-break: keep-all;
  }
  .menu-desc {
    margin: 4px 0 0;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--muted);
    word-break: keep-all;
    /* 설명이 길어도 카드 높이를 사진만큼으로 묶어 둡니다. */
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
  .menu-price {
    display: block;
    margin-top: 7px;
    font-size: 14px;
    font-weight: 700;
  }
  .menu-photo {
    flex: none;
    width: 92px;
    height: 92px;
    border-radius: 8px;
    object-fit: cover;
    background: var(--line);
  }
  .menu-note,
  .menu-foot {
    margin: 10px 0 0;
    font-size: 12.5px;
    line-height: 1.65;
    color: var(--muted);
    word-break: keep-all;
  }
  .menu-note.empty {
    margin: 0;
  }
  .menu-foot {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }
  .menu-foot a {
    /* --brand 는 웹(/web)에만 있어서, 앱 화면에서는 갈색으로 돌아갑니다. */
    color: var(--brand, var(--brown));
    white-space: nowrap;
  }
  .compact .menu-name {
    font-size: 13.5px;
  }
  .compact .menu-desc,
  .compact .menu-note,
  .compact .menu-foot {
    font-size: 11.5px;
  }
  .compact .menu-price {
    font-size: 13px;
  }
  .compact .menu-photo {
    width: 76px;
    height: 76px;
  }
  .compact .menu-row {
    gap: 11px;
    padding: 11px 0;
  }
</style>
