/* =====================================================
   꾸리와뚜지 Live Archive – app.js (완전 교체본 v0.3)
   변경 사항:
    • 방송 날짜 표기 → MM/DD/YYYY
    • 방송 시간은 시트 텍스트 그대로
    • 썸네일 사이즈 확대 (160×90)
    • 통계 카드 로직 제거
    • flatpickr 달력 연동
   =====================================================*/
(() => {
  /* ------------------------ 설정 ------------------------ */
  const API_BASE =
    'https://script.google.com/macros/s/AKfycbwm9NiRjBVL1PYVwO2BhF2vdDn3TO0hMgQoeS0WOeuUKoVDMGmFl1fyzAnb7_FflONg/exec';

  /* ------------------------ DOM ------------------------ */
  const $liveTbody        = document.getElementById('liveTbody');
  const $categories       = document.getElementById('categories');
  const $searchForm       = document.getElementById('searchForm');
  const $searchInput      = document.getElementById('searchInput');
  const $yearFilter       = document.getElementById('yearFilter');
  const $monthFilter      = document.getElementById('monthFilter');
  const $tagFilter        = document.getElementById('tagFilter');
  const $filtersReset     = document.getElementById('filtersReset');
  const $resultCount      = document.getElementById('resultCount');

  const $calendarBtn      = document.getElementById('calendarBtn');
  const $calendarModal    = document.getElementById('calendarModal');
  const $modalClose       = document.getElementById('modalClose');
  const $calendarApply    = document.getElementById('calendarApply');
  const $calendarContainer= document.getElementById('calendarContainer');

  /* ------------------------ 상태 ------------------------ */
  let lives = [];              // 전체 라이브
  let view = [];               // 현재 화면에 보여줄 라이브
  let songsCache = {};         // { liveId: [songs] }
  let activeAccordion = null;  // 펼쳐진 아코디언 <tr>
  let pickedDate = null;       // 달력에서 고른 YYYY-MM-DD

  /* =====================================================
     유틸리티
     =====================================================*/
  const escapeHTML = s => s.replace(/[&<>'"`]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;','`':'&#x60;'}[c]));

  function formatDateMDY(dateStr='') {
    if(!dateStr.includes('-')) return dateStr;
    const [y,m,d] = dateStr.split('-');
    return `${m}/${d}/${y}`;
  }

  function makeThumb(live) {
    if (live['Asset ID']) {
      return `https://res.cloudinary.com/soblzuny/image/upload/c_fill,h_90,w_160,g_auto/${live['Asset ID']}.jpg`;
    }
    return 'https://placehold.co/160x90?text=Live';
  }

  function linkHtml(url) {
    return `<a href="${url}" target="_blank" rel="noopener" aria-label="다시보기"><i data-lucide="external-link"></i></a>`;
  }

  function formatTags(str='') {
    return str.split(',').map(t=>t.trim()).filter(Boolean).map(t=>`<span class="tag">${escapeHTML(t)}</span>`).join(' ');
  }

  function updateIcons() {
    if(window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }

  /* =====================================================
     데이터 로드
     =====================================================*/
  async function fetchJSON(url){ const res=await fetch(url); if(!res.ok) throw new Error(res.status); return res.json(); }

  async function loadLives(){
    const data = await fetchJSON(`${API_BASE}?action=lives`);
    lives = data;
  }

  /* =====================================================
     렌더링
     =====================================================*/
  function renderLives(list){
    $liveTbody.innerHTML='';
    list.forEach(live=>{
      const tr=document.createElement('tr');
      tr.className='live-row';
      tr.dataset.liveId=live['Live ID'];
      tr.innerHTML=`
        <td><img src="${makeThumb(live)}" alt="${escapeHTML(live['제목']||'')}" width="160" height="90" /></td>
        <td>${formatDateMDY(live['날짜'])}</td>
        <td>${escapeHTML(live['제목']||'')}</td>
        <td>${live['방송시간']||''}</td>
        <td>${formatTags(live['태그'])}</td>
        <td>${live['다시보기']?linkHtml(live['다시보기']):'-'}</td>`;
      $liveTbody.appendChild(tr);
    });
    $resultCount.textContent=`(${list.length})`;
    updateIcons();
  }

  function buildFilters(){
    const years=new Set(), months=new Set(), tags=new Set();
    lives.forEach(l=>{
      if(l['날짜']){const [yy,mm]=l['날짜'].split('-'); years.add(yy); months.add(mm);}  
      (l['태그']||'').split(',').map(t=>t.trim()).forEach(t=>tags.add(t));
    });
    const fill=(sel,arr)=>{sel.innerHTML='<option value="">전체</option>'+arr.map(v=>`<option value="${v}">${v}</option>`).join('');};
    fill($yearFilter,[...years].sort().reverse());
    fill($monthFilter,[...months].sort());
    fill($tagFilter,[...tags].filter(Boolean).sort());
  }

  function applyFilters(){
    const y=$yearFilter.value, m=$monthFilter.value, t=$tagFilter.value;
    view = lives.filter(l=>{
      const [yy,mm]=(l['날짜']||'').split('-');
      const tagOk=!t||(l['태그']||'').includes(t);
      const dateOk=!pickedDate||l['날짜']===pickedDate;
      return (!y||yy===y)&&(!m||mm===m)&&tagOk&&dateOk;
    });
    renderLives(view);
  }

  /* =====================================================
     아코디언
     =====================================================*/
  const songTemplate=document.getElementById('songAccordionTemplate');

  function createAccordion(liveId,songs){
    const clone=songTemplate.content.firstElementChild.cloneNode(true);
    clone.dataset.liveId=liveId;
    const list=clone.querySelector('.song-list');
    songs.forEach(s=>{
      const li=document.createElement('li');
      li.innerHTML=`<strong>${escapeHTML(s['가수'])}</strong> – ${escapeHTML(s['제목'])}${s['커버']?` <em>(${escapeHTML(s['커버'])})</em>`:''}`;
      list.appendChild(li);
    });
    return clone;
  }

  async function onTableClick(e){
    const row=e.target.closest('.live-row');
    if(!row) return;
    const id=row.dataset.liveId;
    if(activeAccordion){ activeAccordion.remove(); activeAccordion=null; if(activeAccordion?.dataset.liveId===id) return; }

    const songs = songsCache[id] || (songsCache[id]=await fetchJSON(`${API_BASE}?action=songs&liveId=${encodeURIComponent(id)}`));
    const acc=createAccordion(id,songs);
    row.after(acc);
    activeAccordion=acc;
    updateIcons();
  }

  /* =====================================================
     달력
     =====================================================*/
  function initCalendar(){
    if($calendarContainer.childElementCount) return; // already init
    const input=document.createElement('input'); input.id='calendarInput';
    $calendarContainer.appendChild(input);
    import('https://cdn.jsdelivr.net/npm/flatpickr').then(fp=>{
      fp.default('#calendarInput',{inline:true,disableMobile:true,locale:'ko',onChange:(selDates,str)=>{pickedDate=str;}});
    });
  }

  function openCalendar(){
    initCalendar();
    $calendarModal.showModal();
  }

  /* =====================================================
     초기화
     =====================================================*/
  async function init(){
    await loadLives();
    buildFilters();
    view=[...lives];
    renderLives(view);

    /* 이벤트 */
    $liveTbody.addEventListener('click',onTableClick);
    $yearFilter.addEventListener('change',applyFilters);
    $monthFilter.addEventListener('change',applyFilters);
    $tagFilter.addEventListener('change',applyFilters);
    $filtersReset.addEventListener('click',()=>{ $yearFilter.value=$monthFilter.value=$tagFilter.value=''; pickedDate=null; applyFilters(); });

    $calendarBtn.addEventListener('click',openCalendar);
    $modalClose.addEventListener('click',()=>{$calendarModal.close();});
    $calendarApply.addEventListener('click',()=>{$calendarModal.close(); applyFilters();});

    $searchForm.addEventListener('submit',e=>{e.preventDefault(); const q=$searchInput.value.trim().toLowerCase(); if(!q){applyFilters();return;} view=lives.filter(l=>JSON.stringify(l).toLowerCase().includes(q)); renderLives(view);});

    updateIcons();
  }

  document.addEventListener('DOMContentLoaded',init);
})();
