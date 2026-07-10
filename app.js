/* =====================================================
   꾸리와뚜지 Live Archive – Main JS
   v0.1: Load lives list & basic interactions (dummy API fetch)
   =====================================================*/
(() => {
  const API_BASE = 'https://script.google.com/macros/s/AKfycbwm9NiRjBVL1PYVwO2BhF2vdDn3TO0hMgQoeS0WOeuUKoVDMGmFl1fyzAnb7_FflONg/exec';

  // DOM
  const $liveTbody = document.getElementById('liveTbody');
  const $categories = document.getElementById('categories');
  const $searchForm = document.getElementById('searchForm');
  const $searchInput = document.getElementById('searchInput');
  const $calendarBtn = document.getElementById('calendarBtn');
  const $calendarModal = document.getElementById('calendarModal');
  const $modalClose = document.getElementById('modalClose');
  const $calendarApply = document.getElementById('calendarApply');
  const $calendarContainer = document.getElementById('calendarContainer');

  let lives = [];
  let songsCache = {}; // liveId -> songs array
  let activeAccordion = null;

  /* ---------------- Fetch Helpers ---------------- */
  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  /* ---------------- UI Render ---------------- */
  function renderLives(data) {
    $liveTbody.innerHTML = '';
    data.forEach(live => {
      const tr = document.createElement('tr');
      tr.className = 'live-row';
      tr.dataset.liveId = live['Live ID'];

      tr.innerHTML = `
        <td><img src="${makeThumb(live)}" alt="${live['제목']} 썸네일" /></td>
        <td>${live['날짜']}</td>
        <td>${live['제목']}</td>
        <td>${live['방송시간']}</td>
        <td>${formatTags(live['태그'])}</td>
        <td>${live['다시보기'] ? linkHtml(live['다시보기']) : '-'}</td>
      `;
      $liveTbody.appendChild(tr);
    });

    updateIcons();
  }

  function formatTags(tagStr = '') {
    return tagStr
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => `<span class="tag">${t}</span>`)
      .join(' ');
  }

  function makeThumb(live) {
    // If Asset ID present, build Cloudinary thumb else placeholder
    if (live['Asset ID']) {
      return `https://res.cloudinary.com/soblzuny/image/upload/c_fill,h_54,w_96,g_auto/${live['Asset ID']}.jpg`;
    }
    return 'https://placehold.co/96x54?text=Live';
  }

  function linkHtml(url) {
    return `<a href="${url}" target="_blank" rel="noopener" aria-label="다시보기">
              <i data-lucide="external-link"></i>
            </a>`;
  }

  function renderCategories(data) {
    // Count by tag
    const counts = {};
    data.forEach(live => {
      const tags = live['태그'] ? live['태그'].split(',').map(t => t.trim()) : [];
      tags.forEach(tag => {
        if (!tag) return;
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });

    // Remove placeholder cards except the first example
    [...$categories.querySelectorAll('.category-card')].forEach((el, i) => {
      if (i === 0) return; // keep example
      el.remove();
    });

    Object.entries(counts).forEach(([tag, count]) => {
      const btn = document.createElement('button');
      btn.className = 'category-card';
      btn.dataset.tag = tag;
      btn.innerHTML = `
        <span class="category-card__label">${tag}</span>
        <span class="category-card__count">${count}</span>
      `;
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
      li.innerHTML = `<strong>${song['가수']}</strong> – ${song['제목']} ${song['커버'] ? `(${song['커버']})` : ''}`;
      list.appendChild(li);
    });

    return clone;
  }

  /* ---------------- Event Handlers ---------------- */
  function onTableClick(e) {
    const row = e.target.closest('.live-row');
    if (!row) return;

    const liveId = row.dataset.liveId;

    // Remove previous accordion
    if (activeAccordion && activeAccordion.isConnected) {
      const prevId = activeAccordion.dataset.liveId;
      activeAccordion.remove();
      activeAccordion = null;
      if (prevId === liveId) {
        return; // same row collapse
      }
    }

    // Fetch or use cache
    if (songsCache[liveId]) {
      insertAccordion(row, songsCache[liveId]);
    } else {
      fetchJSON(`${API_BASE}?action=songs&liveId=${encodeURIComponent(liveId)}`)
        .then(data => {
          songsCache[liveId] = data;
          insertAccordion(row, data);
        })
        .catch(console.error);
    }
  }

  function insertAccordion(row, songs) {
    const accordion = renderSongAccordion(row.dataset.liveId, songs);
    row.after(accordion);
    activeAccordion = accordion;
    updateIcons();
  }

  function onSearchSubmit(e) {
    e.preventDefault();
    const q = $searchInput.value.trim().toLowerCase();
    const filtered = lives.filter(live =>
      ['제목', '태그'].some(k => (live[k] || '').toLowerCase().includes(q))
    );
    renderLives(filtered);
  }

  function onCategoryClick(e) {
    const btn = e.target.closest('.category-card');
    if (!btn) return;
    const tag = btn.dataset.tag;
    const filtered = lives.filter(live => (live['태그'] || '').includes(tag));
    renderLives(filtered);
  }

  function handleCalendar() {
    $calendarModal.showModal();
  }

  function handleCalendarClose() {
    $calendarModal.close();
  }

  /* ---------------- Icons ---------------- */
  function updateIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  /* ---------------- Init ---------------- */
  async function init() {
    try {
      const data = await fetchJSON(`${API_BASE}?action=lives`);
      lives = Array.isArray(data) ? data : [];
      renderLives(lives);
      renderCategories(lives);
    } catch (err) {
      console.error(err);
      // fallback dummy
      lives = [
        {
          'Live ID': 'dummy1',
          '날짜': '2026-07-01',
          '제목': '테스트 라이브',
          '방송시간': '1:02:34',
          '태그': '노래라방,커플',
          '다시보기': '#',
          'Asset ID': ''
        }
      ];
      renderLives(lives);
      renderCategories(lives);
    }
  }

  /* ---------------- Bind ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    init();
    $liveTbody.addEventListener('click', onTableClick);
    $searchForm.addEventListener('submit', onSearchSubmit);
    $categories.addEventListener('click', onCategoryClick);
    $calendarBtn.addEventListener('click', handleCalendar);
    $modalClose.addEventListener('click', handleCalendarClose);
    $calendarApply.addEventListener('click', handleCalendarClose);
  });
})();
