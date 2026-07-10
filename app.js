/* =====================================================
   꾸리와뚜지 Live Archive – app.js (완전 교체본 v0.1)
   모바일‑우선 구현: 라이브 목록 로드 · 검색 · 필터 · 아코디언 · 통계
   =====================================================*/
(() => {
  /* ------------------------ 설정 ------------------------ */
  const API_BASE =
    'https://script.google.com/macros/s/AKfycbwm9NiRjBVL1PYVwO2BhF2vdDn3TO0hMgQoeS0WOeuUKoVDMGmFl1fyzAnb7_FflONg/exec';

  /* ------------------------ DOM ------------------------ */
  const $liveTbody     = document.getElementById('liveTbody');
  const $categories    = document.getElementById('categories');
  const $searchForm    = document.getElementById('searchForm');
  const $searchInput   = document.getElementById('searchInput');
  const $yearFilter    = document.getElementById('yearFilter');
  const $monthFilter   = document.getElementById('monthFilter');
  const $tagFilter     = document.getElementById('tagFilter');
  const $filtersReset  = document.getElementById('filtersReset');
  const $resultCount   = document.getElementById('resultCount');
  const $statLives     = document.getElementById('statLives');
  const $statSongs     = document.getElementById('statSongs');
  const $statViews     = document.getElementById('statViews');
  const $statTime      = document.getElementById('statTime');

  const $calendarBtn   = document.getElementById('calendarBtn');
  const $calendarModal = document.getElementById('calendarModal');
  const $modalClose    = document.getElementById('modalClose');
  const $calendarApply = document.getElementById('calendarApply');
  const $calendarContainer = document.getElementById('calendarContainer');

  /* ------------------------ 상태 ------------------------ */
  let lives = [];              // 전체 라이브 원본
  let filteredLives = [];      // 필터·검색 결과
  let songsCache = {};         // { liveId: [songs] }
  let activeAccordion = null;  // 현재 펼쳐진 아코디언 <tr>

  /* =====================================================
     데이터 통신 헬퍼
     =====================================================*/
  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  /* =====================================================
     렌더링
     =====================================================*/
  function renderLives(data) {
    $liveTbody.innerHTML = '';

    data.forEach(live => {
      const tr = document.createElement('tr');
      tr.className = 'live-row';
      tr.dataset.liveId = live['Live ID'];

      tr.innerHTML = `
        <td><img src="${makeThumb(live)}" alt="${live['제목']} 썸네일" /></td>
        <td>${live['날짜'] || ''}</td>
        <td>${escapeHTML(live['제목'] || '')}</td>
        <td>${live['방송시간'] || ''}</td>
        <td>${formatTags(live['태그'])}</td>
        <td>${live['다시보기'] ? linkHtml(live['다시보기']) : '-'}</td>`;

      $liveTbody.appendChild(tr);
    });

    // 결과 개수 표시
    $resultCount.textContent = `(${data.length})`;

    updateIcons();
  }

  function renderCategories(data) {
    // 기존 카드(템플릿 1개) 외 모두 삭제 후 새로 그리기
    [...$categories.querySelectorAll('.category-card')].forEach((el, i) => {
      if (i === 0) return; // 템플릿용 첫 카드는 유지
      el.remove();
    });

    const counts = {};
    data.forEach(live => {
      (live['태그'] || '').split(',').map(t => t.trim()).forEach(tag => {
        if (!tag) return;
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });

    Object.entries(counts).forEach(([tag, cnt]) => {
      const btn = document.createElement('button');
      btn.className = 'category-card';
      btn.dataset.tag = tag;
      btn.innerHTML = `
        <i data-lucide="hash" class="category-card__icon"></i>
        <span class="category-card__label">${escapeHTML(tag)} 모아보기</span>
        <span class="category-card__count">${cnt}</span>`;
      $categories.appendChild(btn);
    });
  }

  function renderSongAccordion(liveId, songs) {
    const template = document.getElementById('songAccordionTemplate');
    const clone = template.content.firstElementChild.cloneNode(true);
    clone.dataset.liveId = liveId;

    const list = clone.querySelector('.song-list');
    songs.forEach(song => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${escapeHTML(song['가수'])}</strong> – ${escapeHTML(song['제목'])} ${song['커버'] ? `<em>(${escapeHTML(song['커버'])})</em>` : ''}`;
      list.appendChild(li);
    });

    return clone;
  }

  function updateStats() {
    $statLives.textContent = lives.length;
    $statSongs.textContent = lives.reduce((sum, l) => sum + (+l['노래 수'] || 0), 0);
    // 뷰·시간 컬럼이 없다면 0 표시
    $statViews.textContent = lives.reduce((sum, l) => sum + (+l['뷰'] || 0), 0);
    $statTime.textContent  = formatDuration(lives.reduce((sum, l) => sum + hhmmssToSec(l['방송시간']), 0));
  }

  /* =====================================================
     유틸리티
     =====================================================*/
  function makeThumb(live) {
    if (live['Asset ID']) {
      return `https://res.cloudinary.com/soblzuny/image/upload/c_fill,h_54,w_96,g_auto/${live['Asset ID']}.jpg`;
    }
    return 'https://placehold.co/96x54?text=Live';
  }

  function formatTags(tagStr = '') {
    return tagStr
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => `<span class="tag">${escapeHTML(t)}</span>`)
      .join(' ');
  }

  function linkHtml(url) {
    return `<a href="${url}" target="_blank" rel="noopener" aria-label="다시보기"><i data-lucide="external-link"></i></a>`;
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"`]/g, s => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;','`':'&#x60;'
    }[s]));
  }

  function hhmmssToSec(hms = '') {
    const parts = hms.split(':').map(Number);
    let sec = 0;
    if (parts.length === 3) sec = parts[0]*3600 + parts[1]*60 + parts[2];
    else if (parts.length === 2) sec = parts[0]*60 + parts[1];
    return sec;
  }
  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h ? `${h}시간 ${m}분` : `${m}분`;
  }

  function fillSelect(sel, opts) {
    sel.innerHTML = '<option value="">전체</option>' +
      opts.map(v => `<option value="${v}">${v}</option>`).join('');
  }

  function updateIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  /* =====================================================
     필터 구축 & 적용
     =====================================================*/
  function buildFilters() {
    const years = new Set();
    const months = new Set();
    const tags = new Set();

    lives.forEach(l => {
      if (l['날짜']) {
        const [yy, mm] = l['날짜'].split('-');
        years.add(yy);
        months.add(mm);
      }
      (l['태그'] || '').split(',').map(t => t.trim()).forEach(t => tags.add(t));
    });

    fillSelect($yearFilter, [...years].sort().reverse());
    fillSelect($monthFilter, [...months].sort());
    fillSelect($tagFilter, [...tags].filter(Boolean).sort());
  }

  function applyFilters() {
    const y = $yearFilter.value;
    const m = $monthFilter.value;
    const t = $tagFilter.value;

    filteredLives = lives.filter(l => {
      const [yy, mm] = (l['날짜'] || '').split('-');
      const tagMatch = !t || (l['태그'] || '').includes(t);
      return (!y || yy === y) && (!m || mm === m) && tagMatch;
    });
    renderLives(filteredLives);
  }

  /* =====================================================
     이벤트 핸들러
     =====================================================*/
  function onTableClick(e) {
    const row = e.target.closest('.live-row');
    if (!row) return;

    const liveId = row.dataset.liveId;

    // 기존 아코디언 제거
    if (activeAccordion && activeAccordion.isConnected) {
      const prevId = activeAccordion.dataset.liveId;
      activeAccordion.remove();
      activeAccordion = null;
      if (prevId === liveId) return; // 동일행 토글 → 접기만
    }

    // 캐시 확인 후 없으면 API 호출
    (songsCache[liveId]
      ? Promise.resolve(songsCache[liveId])
      : fetchJSON(`${API_BASE}?action=songs&liveId=${encodeURIComponent(liveId)}`).then(arr => (songsCache[liveId] = arr))
    )
      .then(songs => {
        const acc = renderSongAccordion(liveId, songs);
        row.after(acc);
        activeAccordion = acc;
        updateIcons();
      })
      .catch(console.error);
  }

  function onSearchSubmit(e) {
    e.preventDefault();
    const q = $searchInput.value.trim().toLowerCase();
    if (!q) {
      renderLives(filteredLives.length ? filteredLives : lives);
      return;
    }
    const base = filteredLives.length ? filteredLives : lives;
    const searched = base.filter(l =>
      ['제목', '태그', '가수'] // 가수 컬럼이 lives에 없다면 제외
        .some(k => (l[k] || '').toLowerCase().includes(q))
    );
    renderLives(searched);
  }

  function onCategoryClick(e) {
    const btn = e.target.closest('.category-card');
    if (!btn) return;
    $tagFilter.value = btn.dataset.tag;
    applyFilters();
    window.scrollTo({ top: $yearFilter.offsetTop - 60, behavior: 'smooth' });
  }

  function openCalendar() {
    $calendarModal.showModal();
    /* 달력 라이브러리를 로드하거나 직접 렌더링할 수 있습니다.
       예시를 단순화하기 위해 여기서는 생략합니다. */
  }
  function closeCalendar() { $calendarModal.close(); }

  /* =====================================================
     초기화
     =====================================================*/
  async function init() {
    try {
      const data = await fetchJSON(`${API_BASE}?action=lives`);
      lives = Array.isArray(data) ? data : [];
    } catch (err) {
      console.error(err);
      // 오류 시 더미 한 건
      lives = [{
        'Live ID':'dummy1','날짜':'2026-07-01','제목':'테스트 라이브','방송시간':'1:02:34','태그':'노래 라방,커플','다시보기':'#','Asset ID':''
      }];
    }

    filteredLives = [...lives];
    renderLives(lives);
    renderCategories(lives);
    buildFilters();
    updateStats();
  }

  /* =====================================================
     바인딩
     =====================================================*/
  document.addEventListener('DOMContentLoaded', () => {
    init();

    $liveTbody.addEventListener('click', onTableClick);
    $categories.addEventListener('click', onCategoryClick);
    $searchForm.addEventListener('submit', onSearchSubmit);

    [$yearFilter, $monthFilter, $tagFilter].forEach(sel => sel.addEventListener('change', applyFilters));
    $filtersReset.addEventListener('click', () => {
      $yearFilter.value = $monthFilter.value = $tagFilter.value = '';
      applyFilters();
    });

    // 달력 모달
    if ($calendarBtn)  $calendarBtn.addEventListener('click', openCalendar);
    if ($modalClose)   $modalClose.addEventListener('click', closeCalendar);
    if ($calendarApply) $calendarApply.addEventListener('click', closeCalendar);
  });
})();
