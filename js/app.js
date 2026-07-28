// ============================================
// 시작화면(스플래시) - 1.5초 후 자동으로 사라짐
// ============================================
window.addEventListener('DOMContentLoaded', () => {
  const splash = document.getElementById('splashScreen');
  if (!splash) return;
  setTimeout(() => {
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 400);
  }, 2000);
});

// ============================================
// 서비스 워커 등록 (오프라인 지원)
// ============================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('service-worker.js')
      .catch((error) => console.error('서비스 워커 등록 실패:', error));
  });
}

// ============================================
// localStorage 키 & 공용 저장/불러오기 함수
// ============================================
const K = {
  memos: 'memolife_memos',
  sched: 'memolife_schedules',
  tx: 'memolife_transactions',
  theme: 'memolife_theme',
  pinOrder: 'memolife_pin_order',
  schedPinOrder: 'memolife_sched_pin_order',
  txPinOrder: 'memolife_tx_pin_order',
  budget: 'memolife_budget',
  categories: 'memolife_categories',
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error(`${key} 불러오기 실패:`, error);
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ============================================
// 오늘 날짜 표시
// ============================================
const frameEl = document.getElementById('frame');
const todayDateEl = document.getElementById('todayDate');

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatTodayLabel() {
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${now.getMonth() + 1}월 ${now.getDate()}일 ${days[now.getDay()]}요일`;
}

todayDateEl.textContent = formatTodayLabel();

// ============================================
// 화면 전환 (탭)
// ============================================
const tabs = document.querySelectorAll('.tab');
const screens = document.querySelectorAll('.screen');

function switchTab(name) {
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === name));
  screens.forEach((screen) => screen.classList.toggle('active', screen.id === `screen-${name}`));
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// 카드형 폼 여닫기 공통 처리 (data-toggle 속성이 가리키는 id의 form-card를 토글)
document.querySelectorAll('[data-toggle]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.toggle).classList.toggle('open');
  });
});

// ============================================
// 다크모드 (memolife.html과 동일하게 #frame에 data-theme 적용)
// ============================================
const themeBtn = document.getElementById('themeBtn');

if (load(K.theme, 'light') === 'dark') {
  frameEl.setAttribute('data-theme', 'dark');
}

themeBtn.addEventListener('click', () => {
  const now = frameEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  if (now === 'dark') {
    frameEl.setAttribute('data-theme', 'dark');
  } else {
    frameEl.removeAttribute('data-theme');
  }
  save(K.theme, now);
});

// ============================================
// 토스트 (실행취소 액션 지원)
// ============================================
const toastEl = document.getElementById('toast');
let toastTimer = null;

function toast(message, actionLabel, onAction) {
  clearTimeout(toastTimer);
  toastEl.innerHTML = '';
  toastEl.append(message);

  if (actionLabel && onAction) {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.textContent = actionLabel;
    actionBtn.addEventListener('click', () => {
      toastEl.classList.remove('show');
      onAction();
    });
    toastEl.append(actionBtn);
  }

  toastEl.classList.add('show');
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), actionLabel ? 4000 : 1500);
}

// ============================================
// 공용 유틸: HTML 이스케이프, 소프트 삭제, 고정(pin) 토글
// ============================================
function escapeHtml(text) {
  return (text || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

// 즉시 삭제하지 않고 토스트의 "실행취소"로 복구 가능하게 삭제
function softDelete(storeKey, orderKey, item, label) {
  save(storeKey, load(storeKey, []).filter((x) => x.id !== item.id));
  if (orderKey) save(orderKey, load(orderKey, []).filter((id) => id !== item.id));
  renderAll();
  toast(`${label}를 삭제했어요`, '실행취소', () => {
    const arr = load(storeKey, []);
    arr.push(item);
    save(storeKey, arr);
    if (item.pinned && orderKey) {
      const order = load(orderKey, []);
      order.push(item.id);
      save(orderKey, order);
    }
    renderAll();
    toast('복구했어요');
  });
}

// 텍스트를 클립보드에 복사 (공유 대체 수단으로 사용)
function copyToClipboard(text) {
  if (!navigator.clipboard) {
    toast('클립보드 복사를 지원하지 않는 환경이에요');
    return;
  }
  navigator.clipboard
    .writeText(text)
    .then(() => toast('클립보드에 복사했어요'))
    .catch(() => toast('복사에 실패했어요'));
}

// 메모를 다른 앱으로 공유 (미지원/실패 시 클립보드 복사로 대체)
function shareMemo(memo) {
  const text = `${memo.title || '제목 없음'}\n${memo.body || ''}`;

  if (!navigator.share) {
    copyToClipboard(text);
    return;
  }

  try {
    navigator.share({ title: memo.title || '메모', text: memo.body || '' }).catch((error) => {
      if (error && error.name === 'AbortError') return; // 사용자가 공유를 취소한 경우
      copyToClipboard(text);
    });
  } catch (error) {
    copyToClipboard(text);
  }
}

const MAX_PIN = 3;

// 고정 on/off 토글 (최대 개수 제한, 고정 순서는 orderKey에 별도 저장)
function togglePin(storeKey, orderKey, id) {
  const all = load(storeKey, []);
  const idx = all.findIndex((x) => x.id === id);
  if (idx === -1) return null;

  const willPin = !all[idx].pinned;
  if (willPin && all.filter((x) => x.pinned).length >= MAX_PIN) {
    toast(`고정은 최대 ${MAX_PIN}개까지 가능해요`);
    return null;
  }

  all[idx] = { ...all[idx], pinned: willPin };
  save(storeKey, all);

  let order = load(orderKey, []);
  order = willPin ? [...order, id] : order.filter((x) => x !== id);
  save(orderKey, order);

  toast(willPin ? '고정했어요' : '고정을 해제했어요');
  return willPin;
}

// ============================================
// 메모 탭
// ============================================
let editingMemoId = null;

function memoPinOrder() {
  return load(K.pinOrder, []);
}

function toggleMemoPin(id) {
  togglePin(K.memos, K.pinOrder, id);
  renderAll();
}

// 메모 작성/수정 폼을 "새 메모" 상태로 되돌림
function resetMemoForm() {
  editingMemoId = null;
  document.getElementById('memoTitle').value = '';
  document.getElementById('memoBody').value = '';
  document.getElementById('memoSave').textContent = '저장하기';
  document.getElementById('memoToggleBtn').textContent = '+ 새 메모 추가';
}

function renderMemos() {
  const memos = load(K.memos, []);
  const list = document.getElementById('memoList');
  list.innerHTML = memos.length ? '' : '<div class="empty">아직 작성한 메모가 없어요.</div>';

  const order = memoPinOrder();
  const pinned = memos.filter((m) => m.pinned).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const rest = memos.filter((m) => !m.pinned).sort((a, b) => b.id - a.id);

  [...pinned, ...rest].forEach((m) => {
    const row = document.createElement('div');
    row.className = 'list-item c-memo';
    row.draggable = Boolean(m.pinned);
    row.dataset.id = m.id;
    if (m.pinned) row.style.cursor = 'grab';
    row.innerHTML = `
      <div style="display:flex;gap:6px;">${m.pinned ? '<span style="color:var(--ink-soft);">⠿</span>' : ''}
        <div>
          <div class="title">${m.pinned ? '📌 ' : ''}${escapeHtml(m.title || '제목 없음')}</div>
          <div class="sub">${escapeHtml(m.body || '')}</div>
          <div class="sub">${m.date}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
        <button type="button" class="icon-x" data-action="pin">${m.pinned ? '고정 해제' : '상단 고정'}</button>
        <button type="button" class="icon-x" data-action="share">공유</button>
        <button type="button" class="icon-x" data-action="edit">수정</button>
        <button type="button" class="icon-x" data-action="del">삭제</button>
      </div>
    `;

    row.querySelector('[data-action="del"]').addEventListener('click', () => softDelete(K.memos, K.pinOrder, m, '메모'));
    row.querySelector('[data-action="pin"]').addEventListener('click', () => toggleMemoPin(m.id));
    row.querySelector('[data-action="share"]').addEventListener('click', () => shareMemo(m));
    row.querySelector('[data-action="edit"]').addEventListener('click', () => {
      editingMemoId = m.id;
      document.getElementById('memoTitle').value = m.title || '';
      document.getElementById('memoBody').value = m.body || '';
      document.getElementById('memoForm').classList.add('open');
      document.getElementById('memoSave').textContent = '수정 완료';
      document.getElementById('memoToggleBtn').textContent = '메모 수정 중 (취소하려면 다시 탭)';
      document.getElementById('screen-memo').scrollTop = 0;
    });

    // 고정된 메모끼리는 드래그로 순서 변경 가능
    if (m.pinned) {
      row.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', String(m.id));
        row.style.opacity = '0.5';
      });
      row.addEventListener('dragend', () => {
        row.style.opacity = '1';
      });
      row.addEventListener('dragover', (event) => event.preventDefault());
      row.addEventListener('drop', (event) => {
        event.preventDefault();
        const draggedId = Number(event.dataTransfer.getData('text/plain'));
        if (draggedId === m.id) return;
        let order2 = memoPinOrder().filter((id) => id !== draggedId);
        order2.splice(order2.indexOf(m.id), 0, draggedId);
        save(K.pinOrder, order2);
        renderAll();
      });
    }

    list.append(row);
  });
}

// 폼을 닫을 때(토글 결과 open이 아니게 됐을 때)는 새 메모 상태로 초기화
document.getElementById('memoToggleBtn').addEventListener('click', () => {
  if (!document.getElementById('memoForm').classList.contains('open')) {
    resetMemoForm();
  }
});

document.getElementById('memoSave').addEventListener('click', () => {
  const title = document.getElementById('memoTitle').value.trim();
  const body = document.getElementById('memoBody').value.trim();
  if (!title && !body) return;

  const memos = load(K.memos, []);
  if (editingMemoId) {
    const idx = memos.findIndex((x) => x.id === editingMemoId);
    if (idx > -1) memos[idx] = { ...memos[idx], title, body };
  } else {
    memos.push({ id: Date.now(), title, body, date: todayStr(), pinned: false });
  }
  save(K.memos, memos);

  document.getElementById('memoForm').classList.remove('open');
  resetMemoForm();
  renderAll();
  toast('메모를 저장했어요');
});

// ============================================
// 캘린더 탭
// ============================================
let picked = todayStr(); // 현재 선택된 날짜
let viewMonth = new Date(); // 현재 보여주는 월
let editingSchedId = null;

document.getElementById('calPrevBtn').addEventListener('click', () => {
  viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
  renderCalendar();
});
document.getElementById('calNextBtn').addEventListener('click', () => {
  viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
  renderCalendar();
});

function renderCalendar() {
  const grid = document.getElementById('calGrid');
  const sched = load(K.sched, []);
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  document.getElementById('calMonthLabel').textContent = `${y}년 ${m + 1}월`;
  grid.innerHTML = '';

  ['일', '월', '화', '수', '목', '금', '토'].forEach((d) => {
    const el = document.createElement('div');
    el.className = 'dow';
    el.textContent = d;
    grid.append(el);
  });

  const startOffset = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  for (let i = 0; i < startOffset; i++) grid.append(document.createElement('div'));

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = 'cal-day'
      + (sched.some((s) => s.date === dateStr) ? ' has-item' : '')
      + (dateStr === todayStr() ? ' today' : '')
      + (dateStr === picked && dateStr !== todayStr() ? ' picked' : '');
    cell.textContent = String(d);
    cell.addEventListener('click', () => {
      picked = dateStr;
      renderCalendar();
    });
    grid.append(cell);
  }

  renderCalList();
}

function schedPinOrder() {
  return load(K.schedPinOrder, []);
}

function toggleSchedPin(id) {
  togglePin(K.sched, K.schedPinOrder, id);
  renderAll();
}

function renderCalList() {
  document.getElementById('calDayLabel').textContent = `${picked} 일정`;
  const order = schedPinOrder();
  const dayItems = load(K.sched, []).filter((s) => s.date === picked);
  const pinned = dayItems.filter((s) => s.pinned).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const rest = dayItems.filter((s) => !s.pinned).sort((a, b) => b.id - a.id);
  const list = document.getElementById('calList');
  const sched = [...pinned, ...rest];
  list.innerHTML = sched.length ? '' : '<div class="empty">이 날짜에 등록된 일정이 없어요.</div>';

  sched.forEach((s) => {
    const row = document.createElement('div');
    row.className = 'list-item c-cal';
    row.draggable = Boolean(s.pinned);
    if (s.pinned) row.style.cursor = 'grab';
    row.innerHTML = `
      <div style="display:flex;gap:6px;">${s.pinned ? '<span style="color:var(--ink-soft);">⠿</span>' : ''}
        <div>
          <div class="title">${s.pinned ? '📌 ' : ''}${escapeHtml(s.title)}${s.notify ? ' <span class="tag cal">알림</span>' : ''}</div>
          <div class="sub">${s.time || '시간 미정'}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
        <button type="button" class="icon-x" data-action="pin">${s.pinned ? '고정 해제' : '고정'}</button>
        <button type="button" class="icon-x" data-action="edit">수정</button>
        <button type="button" class="icon-x" data-action="del">삭제</button>
      </div>
    `;

    row.querySelector('[data-action="del"]').addEventListener('click', () => softDelete(K.sched, K.schedPinOrder, s, '일정'));
    row.querySelector('[data-action="pin"]').addEventListener('click', () => toggleSchedPin(s.id));
    row.querySelector('[data-action="edit"]').addEventListener('click', () => {
      editingSchedId = s.id;
      document.getElementById('calTitle').value = s.title || '';
      document.getElementById('calTime').value = s.time || '';
      document.getElementById('calNotify').checked = Boolean(s.notify);
      document.getElementById('calRepeat').value = 'none';
      document.getElementById('calRepeat').disabled = true;
      document.getElementById('calForm').classList.add('open');
      document.getElementById('calSave').textContent = '수정 완료';
      document.getElementById('calToggleBtn').textContent = '일정 수정 중 (취소하려면 다시 탭)';
    });

    if (s.pinned) {
      row.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', String(s.id));
        row.style.opacity = '0.5';
      });
      row.addEventListener('dragend', () => {
        row.style.opacity = '1';
      });
      row.addEventListener('dragover', (event) => event.preventDefault());
      row.addEventListener('drop', (event) => {
        event.preventDefault();
        const draggedId = Number(event.dataTransfer.getData('text/plain'));
        if (draggedId === s.id) return;
        const order2 = schedPinOrder().filter((id) => id !== draggedId);
        order2.splice(order2.indexOf(s.id), 0, draggedId);
        save(K.schedPinOrder, order2);
        renderAll();
      });
    }

    list.append(row);
  });
}

document.getElementById('calToggleBtn').addEventListener('click', () => {
  if (!document.getElementById('calForm').classList.contains('open')) {
    resetCalForm();
  }
});

function resetCalForm() {
  editingSchedId = null;
  document.getElementById('calTitle').value = '';
  document.getElementById('calTime').value = '';
  document.getElementById('calNotify').checked = false;
  document.getElementById('calRepeat').value = 'none';
  document.getElementById('calRepeat').disabled = false;
  document.getElementById('calSave').textContent = '저장하기';
  document.getElementById('calToggleBtn').textContent = '+ 이 날짜에 일정 추가';
}

// 날짜 문자열(YYYY-MM-DD) 연산 (반복 일정 생성용)
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function addWeeks(dateStr, n) {
  return addDays(dateStr, n * 7);
}
function addMonths(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() !== day) d.setDate(0); // 말일 보정 (예: 1/31 + 1개월 → 2/28)
  return d.toISOString().slice(0, 10);
}

document.getElementById('calSave').addEventListener('click', () => {
  const title = document.getElementById('calTitle').value.trim();
  const time = document.getElementById('calTime').value;
  const notify = document.getElementById('calNotify').checked;
  const repeat = document.getElementById('calRepeat').value;
  if (!title) return;
  if (notify && !time) {
    toast('알림을 받으려면 시간을 정해주세요');
    return;
  }
  if (notify && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  const sched = load(K.sched, []);

  if (editingSchedId) {
    const idx = sched.findIndex((x) => x.id === editingSchedId);
    if (idx > -1) sched[idx] = { ...sched[idx], title, time, notify };
    save(K.sched, sched);
    resetCalForm();
    document.getElementById('calForm').classList.remove('open');
    renderAll();
    toast('일정을 수정했어요');
    return;
  }

  const repeatGroup = repeat !== 'none' ? Date.now() : null;
  const dates = [picked];
  if (repeat === 'daily') {
    for (let i = 1; i < 30; i++) dates.push(addDays(picked, i));
  } else if (repeat === 'weekly') {
    for (let i = 1; i < 12; i++) dates.push(addWeeks(picked, i));
  } else if (repeat === 'monthly') {
    for (let i = 1; i < 6; i++) dates.push(addMonths(picked, i));
  }
  dates.forEach((d, i) => {
    sched.push({ id: Date.now() + i, title, time, date: d, notify, notified: false, repeatGroup, pinned: false });
  });
  save(K.sched, sched);
  resetCalForm();
  document.getElementById('calForm').classList.remove('open');
  renderAll();
  toast(dates.length > 1 ? `일정을 ${dates.length}개 등록했어요` : '일정을 등록했어요');
});

// 일정 시간 알림 체크 (20초마다)
function checkScheduleAlerts() {
  const now = new Date();
  const nowStr = now.toTimeString().slice(0, 5);
  const sched = load(K.sched, []);
  let changed = false;
  sched.forEach((s) => {
    if (s.notify && !s.notified && s.date === todayStr() && s.time && s.time <= nowStr) {
      changed = true;
      s.notified = true;
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('메모라이프 일정 알림', { body: `${s.time} · ${s.title}` });
      } else {
        toast(`⏰ ${s.title} (${s.time})`);
      }
    }
  });
  if (changed) save(K.sched, sched);
}
setInterval(checkScheduleAlerts, 20000);
checkScheduleAlerts();

// ============================================
// 가계부 탭
// ============================================
const DEFAULT_CATS = ['식비', '교통', '쇼핑', '생활', '취미', '기타'];
let editingTxId = null;

function loadCategories() {
  return load(K.categories, DEFAULT_CATS);
}

function renderCategorySelect() {
  const sel = document.getElementById('txCategory');
  const cur = sel.value;
  sel.innerHTML = loadCategories().map((c) => `<option>${escapeHtml(c)}</option>`).join('');
  if (loadCategories().includes(cur)) sel.value = cur;
}

document.getElementById('catEditBtn').addEventListener('click', () => {
  document.getElementById('catEditForm').classList.toggle('open');
  renderCategoryEditList();
});

function renderCategoryEditList() {
  const cats = loadCategories();
  const box = document.getElementById('catEditList');
  const usedCats = new Set(load(K.tx, []).map((t) => t.category));
  box.innerHTML = '';
  cats.forEach((c) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);';
    row.innerHTML = `<span style="font-size:13px;">${escapeHtml(c)}</span>
      <button type="button" class="icon-x">삭제</button>`;
    row.querySelector('button').addEventListener('click', () => {
      if (usedCats.has(c)) {
        toast('이미 사용 중인 카테고리는 삭제할 수 없어요');
        return;
      }
      if (cats.length <= 1) {
        toast('카테고리가 최소 1개는 있어야 해요');
        return;
      }
      save(K.categories, cats.filter((x) => x !== c));
      renderCategoryEditList();
      renderCategorySelect();
    });
    box.append(row);
  });
}

document.getElementById('catAddBtn').addEventListener('click', () => {
  const input = document.getElementById('catNewInput');
  const name = input.value.trim();
  if (!name) return;
  const cats = loadCategories();
  if (cats.includes(name)) {
    toast('이미 있는 카테고리예요');
    return;
  }
  save(K.categories, [...cats, name]);
  input.value = '';
  renderCategoryEditList();
  renderCategorySelect();
  toast('카테고리를 추가했어요');
});

document.getElementById('budgetEditBtn').addEventListener('click', () => {
  const form = document.getElementById('budgetSetForm');
  const isOpen = form.style.display === 'block';
  form.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) document.getElementById('budgetInput').value = load(K.budget, 0) || '';
});

document.getElementById('budgetSaveBtn').addEventListener('click', () => {
  const v = Number(document.getElementById('budgetInput').value);
  if (!v || v <= 0) {
    toast('예산 금액을 입력해주세요');
    return;
  }
  save(K.budget, v);
  document.getElementById('budgetSetForm').style.display = 'none';
  renderAll();
  toast('예산을 저장했어요');
});

function txPinOrder() {
  return load(K.txPinOrder, []);
}

function toggleTxPin(id) {
  togglePin(K.tx, K.txPinOrder, id);
  renderAll();
}

function renderBudget() {
  renderCategorySelect();

  const tx = load(K.tx, []);
  const monthKey = todayStr().slice(0, 7);
  const thisMonth = tx.filter((t) => t.date.slice(0, 7) === monthKey);
  const income = thisMonth.filter((t) => t.type === 'income').reduce((a, b) => a + Number(b.amount), 0);
  const expense = thisMonth.filter((t) => t.type === 'expense').reduce((a, b) => a + Number(b.amount), 0);
  document.getElementById('statIn').textContent = `${income.toLocaleString()}원`;
  document.getElementById('statOut').textContent = `${expense.toLocaleString()}원`;

  const budget = load(K.budget, 0);
  const budgetDisplay = document.getElementById('budgetDisplay');
  if (!budget) {
    budgetDisplay.innerHTML = '<div class="empty" style="padding:10px 0;">아직 예산을 설정하지 않았어요.</div>';
  } else {
    const pct = Math.min(100, Math.round((expense / budget) * 100));
    const over = expense > budget;
    budgetDisplay.innerHTML = `
      <div class="bar-row" style="margin-bottom:6px;">
        <div class="top"><span>${expense.toLocaleString()}원 사용</span><span>예산 ${budget.toLocaleString()}원</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;${over ? 'background:var(--red);' : ''}"></div></div>
      </div>
      <div style="font-size:11.5px;color:${over ? 'var(--red)' : 'var(--ink-soft)'};">
        ${over ? `예산을 ${(expense - budget).toLocaleString()}원 초과했어요` : `${(budget - expense).toLocaleString()}원 남았어요`}
      </div>`;
  }

  const cats = {};
  thisMonth.filter((t) => t.type === 'expense').forEach((t) => {
    cats[t.category] = (cats[t.category] || 0) + Number(t.amount);
  });
  const catBars = document.getElementById('catBars');
  const catEntries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  catBars.innerHTML = catEntries.length ? '' : '<div class="empty">이번 달 지출 카테고리가 없어요.</div>';
  const max = catEntries.length ? catEntries[0][1] : 1;
  catEntries.forEach(([cat, amt]) => {
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `<div class="top"><span>${escapeHtml(cat)}</span><span>${amt.toLocaleString()}원</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round((amt / max) * 100)}%"></div></div>`;
    catBars.append(row);
  });

  const order = txPinOrder();
  const pinnedTx = tx.filter((x) => x.pinned).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const restTx = tx.filter((x) => !x.pinned).sort((a, b) => b.id - a.id);
  const list = document.getElementById('txList');
  const allTx = [...pinnedTx, ...restTx];
  list.innerHTML = tx.length ? '' : '<div class="empty">등록된 내역이 없어요.</div>';

  allTx.forEach((t) => {
    const row = document.createElement('div');
    row.className = `list-item ${t.type === 'income' ? 'c-income' : 'c-expense'}`;
    row.draggable = Boolean(t.pinned);
    if (t.pinned) row.style.cursor = 'grab';
    row.innerHTML = `
      <div style="display:flex;gap:6px;">${t.pinned ? '<span style="color:var(--ink-soft);">⠿</span>' : ''}
        <div>
          <div class="title">${t.pinned ? '📌 ' : ''}${escapeHtml(t.category)}${t.memo ? ` · ${escapeHtml(t.memo)}` : ''}</div>
          <div class="sub">${t.date}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="amount ${t.type === 'income' ? 'plus' : 'minus'}">${t.type === 'income' ? '+' : '-'}${Number(t.amount).toLocaleString()}원</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <button type="button" class="icon-x" data-action="pin">${t.pinned ? '고정 해제' : '고정'}</button>
          <button type="button" class="icon-x" data-action="edit">수정</button>
          <button type="button" class="icon-x" data-action="del">삭제</button>
        </div>
      </div>
    `;

    row.querySelector('[data-action="del"]').addEventListener('click', () => softDelete(K.tx, K.txPinOrder, t, '내역'));
    row.querySelector('[data-action="pin"]').addEventListener('click', () => toggleTxPin(t.id));
    row.querySelector('[data-action="edit"]').addEventListener('click', () => {
      editingTxId = t.id;
      document.getElementById('txType').value = t.type;
      document.getElementById('txAmount').value = t.amount;
      renderCategorySelect();
      document.getElementById('txCategory').value = t.category;
      document.getElementById('txMemo').value = t.memo || '';
      document.getElementById('txForm').classList.add('open');
      document.getElementById('txSave').textContent = '수정 완료';
      document.getElementById('txToggleBtn').textContent = '내역 수정 중 (취소하려면 다시 탭)';
    });

    if (t.pinned) {
      row.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', String(t.id));
        row.style.opacity = '0.5';
      });
      row.addEventListener('dragend', () => {
        row.style.opacity = '1';
      });
      row.addEventListener('dragover', (event) => event.preventDefault());
      row.addEventListener('drop', (event) => {
        event.preventDefault();
        const draggedId = Number(event.dataTransfer.getData('text/plain'));
        if (draggedId === t.id) return;
        const order2 = txPinOrder().filter((id) => id !== draggedId);
        order2.splice(order2.indexOf(t.id), 0, draggedId);
        save(K.txPinOrder, order2);
        renderAll();
      });
    }

    list.append(row);
  });
}

document.getElementById('txToggleBtn').addEventListener('click', () => {
  if (!document.getElementById('txForm').classList.contains('open')) {
    editingTxId = null;
    document.getElementById('txAmount').value = '';
    document.getElementById('txMemo').value = '';
    document.getElementById('txSave').textContent = '저장하기';
    document.getElementById('txToggleBtn').textContent = '+ 내역 추가';
  }
});

document.getElementById('txSave').addEventListener('click', () => {
  const amount = document.getElementById('txAmount').value;
  if (!amount) return;
  const type = document.getElementById('txType').value;
  const category = document.getElementById('txCategory').value;
  const memo = document.getElementById('txMemo').value.trim();
  const tx = load(K.tx, []);

  if (editingTxId) {
    const idx = tx.findIndex((x) => x.id === editingTxId);
    if (idx > -1) tx[idx] = { ...tx[idx], type, amount, category, memo };
    save(K.tx, tx);
    editingTxId = null;
    document.getElementById('txAmount').value = '';
    document.getElementById('txMemo').value = '';
    document.getElementById('txForm').classList.remove('open');
    document.getElementById('txSave').textContent = '저장하기';
    document.getElementById('txToggleBtn').textContent = '+ 내역 추가';
    renderAll();
    toast('내역을 수정했어요');
    return;
  }

  tx.push({ id: Date.now(), type, amount, category, memo, date: todayStr(), pinned: false });
  save(K.tx, tx);
  document.getElementById('txAmount').value = '';
  document.getElementById('txMemo').value = '';
  document.getElementById('txForm').classList.remove('open');
  renderAll();

  const budget = load(K.budget, 0);
  const monthKey = todayStr().slice(0, 7);
  const monthExpense = tx
    .filter((t) => t.date.slice(0, 7) === monthKey && t.type === 'expense')
    .reduce((a, b) => a + Number(b.amount), 0);
  if (type === 'expense' && budget && monthExpense > budget) {
    toast('⚠ 이번 달 예산을 초과했어요');
  } else {
    toast('가계부에 기록했어요');
  }
});

// ============================================
// 홈 대시보드
// ============================================
function homeCount() {
  const t = todayStr();
  const memo = load(K.memos, []).filter((m) => m.date === t).length;
  const sched = load(K.sched, []).filter((s) => s.date === t).length;
  const spend = load(K.tx, []).filter((x) => x.date === t && x.type === 'expense').reduce((a, b) => a + Number(b.amount), 0);
  return { memo, sched, spend };
}

// 고정 항목 3열 카드 그리드 렌더링 (메모/일정/가계부 공통 패턴)
function renderPinGrid({ boxId, labelId, items, cls, tag, toGo, onUnpin, cardText }) {
  const box = document.getElementById(boxId);
  const label = document.getElementById(labelId);
  box.style.display = items.length ? 'grid' : 'none';
  label.style.display = items.length ? 'block' : 'none';
  box.innerHTML = '';
  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = `pin-card ${cls}`;
    const { title, sub, subStyle } = cardText(item);
    card.innerHTML = `
      <button type="button" class="pin-x" data-action="unpin">✕</button>
      <div class="pin-tag">${tag}</div>
      <div class="pin-body">
        <div class="pin-title">${title}</div>
        <div class="pin-sub"${subStyle ? ` style="${subStyle}"` : ''}>${sub}</div>
      </div>
    `;
    card.addEventListener('click', () => switchTab(toGo));
    card.querySelector('[data-action="unpin"]').addEventListener('click', (event) => {
      event.stopPropagation();
      onUnpin(item.id);
    });
    box.append(card);
  });
}

function renderHome() {
  const c = homeCount();
  document.getElementById('homeMemoCount').textContent = `${c.memo}건`;
  document.getElementById('homeSchedCount').textContent = `${c.sched}건`;
  document.getElementById('homeSpendCount').textContent = `${c.spend.toLocaleString()}원`;
  document.getElementById('homeGreeting').textContent = c.memo + c.sched + c.spend > 0 ? '오늘도 잘 기록했어요' : '오늘도 잘 기록해봐요';

  const memoOrder = memoPinOrder();
  renderPinGrid({
    boxId: 'pinnedMemos',
    labelId: 'pinnedLabel',
    items: load(K.memos, []).filter((m) => m.pinned).sort((a, b) => memoOrder.indexOf(a.id) - memoOrder.indexOf(b.id)),
    cls: 'c-memo',
    tag: '📝',
    toGo: 'memo',
    onUnpin: toggleMemoPin,
    cardText: (m) => ({ title: escapeHtml(m.title || '제목 없음'), sub: escapeHtml(m.body || '') }),
  });

  const schedOrder = schedPinOrder();
  renderPinGrid({
    boxId: 'pinnedSched',
    labelId: 'pinnedSchedLabel',
    items: load(K.sched, []).filter((s) => s.pinned).sort((a, b) => schedOrder.indexOf(a.id) - schedOrder.indexOf(b.id)),
    cls: 'c-cal',
    tag: '📅',
    toGo: 'calendar',
    onUnpin: toggleSchedPin,
    cardText: (s) => ({ title: escapeHtml(s.title), sub: `${s.date.slice(5)} ${s.time || ''}` }),
  });

  const txOrder = txPinOrder();
  renderPinGrid({
    boxId: 'pinnedTx',
    labelId: 'pinnedTxLabel',
    items: load(K.tx, []).filter((x) => x.pinned).sort((a, b) => txOrder.indexOf(a.id) - txOrder.indexOf(b.id)),
    cls: 'c-tx',
    tag: '💰',
    toGo: 'budget',
    onUnpin: toggleTxPin,
    cardText: (x) => ({
      title: `${escapeHtml(x.category)}${x.memo ? ` · ${escapeHtml(x.memo)}` : ''}`,
      sub: `${x.type === 'income' ? '+' : '-'}${Number(x.amount).toLocaleString()}원`,
      subStyle: `color:${x.type === 'income' ? 'var(--pine)' : 'var(--red)'};`,
    }),
  });

  // 오늘의 타임라인 (오늘 등록된 메모/일정/가계부 전부)
  const t = todayStr();
  const toggleFor = { memo: toggleMemoPin, sched: toggleSchedPin, tx: toggleTxPin };
  const items = [
    ...load(K.sched, []).filter((s) => s.date === t).map((s) => ({ id: s.id, type: 'sched', label: s.title, tag: 'cal', tagText: s.time || '일정', pinned: Boolean(s.pinned) })),
    ...load(K.memos, []).filter((m) => m.date === t).map((m) => ({ id: m.id, type: 'memo', label: m.title || '제목 없음', tag: 'memo', tagText: '메모', pinned: Boolean(m.pinned) })),
    ...load(K.tx, []).filter((x) => x.date === t).map((x) => ({ id: x.id, type: 'tx', label: `${x.category}${x.memo ? ` · ${x.memo}` : ''}`, tag: 'money', tagText: `${Number(x.amount).toLocaleString()}원`, pinned: Boolean(x.pinned) })),
  ];
  const tl = document.getElementById('homeTimeline');
  tl.innerHTML = items.length ? '' : '<div class="empty">오늘 아직 기록이 없어요. 메모나 일정을 남겨보세요.</div>';
  items.forEach((it) => {
    const row = document.createElement('div');
    row.className = `list-item ${it.type === 'memo' ? 'c-memo' : it.type === 'sched' ? 'c-cal' : 'c-expense'}`;
    row.innerHTML = `
      <div><span class="tag ${it.tag}">${it.tag === 'cal' ? '일정' : it.tag === 'memo' ? '메모' : '지출'}</span>
        <span class="title">${it.pinned ? '📌 ' : ''}${escapeHtml(it.label)}</span></div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="sub">${escapeHtml(it.tagText)}</div>
        <button type="button" class="icon-x" data-action="toggle-pin">${it.pinned ? '고정 해제' : '고정'}</button>
      </div>
    `;
    row.querySelector('[data-action="toggle-pin"]').addEventListener('click', () => toggleFor[it.type](it.id));
    tl.append(row);
  });

  // 이번 주 vs 지난 주 지출 비교
  const now = new Date();
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const thisMonStr = addDays(todayStr(), mondayOffset);
  const lastMonStr = addDays(thisMonStr, -7);
  const allTx = load(K.tx, []);
  const sumRange = (startStr, days) => {
    let sum = 0;
    for (let i = 0; i < days; i++) {
      const d = addDays(startStr, i);
      if (d > todayStr()) break;
      sum += allTx.filter((x) => x.date === d && x.type === 'expense').reduce((a, b) => a + Number(b.amount), 0);
    }
    return sum;
  };
  const thisWeekSpend = sumRange(thisMonStr, 7);
  const lastWeekSpend = allTx
    .filter((x) => x.type === 'expense' && x.date >= lastMonStr && x.date < thisMonStr)
    .reduce((a, b) => a + Number(b.amount), 0);
  const diff = thisWeekSpend - lastWeekSpend;
  const weekCard = document.getElementById('weekCompareCard');
  const maxW = Math.max(thisWeekSpend, lastWeekSpend, 1);
  weekCard.innerHTML = `
    <div class="section-label" style="margin:0 0 8px;">이번 주 지출 vs 지난 주</div>
    <div class="bar-row"><div class="top"><span>이번 주</span><span>${thisWeekSpend.toLocaleString()}원</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round((thisWeekSpend / maxW) * 100)}%"></div></div></div>
    <div class="bar-row" style="margin-bottom:2px;"><div class="top"><span>지난 주</span><span>${lastWeekSpend.toLocaleString()}원</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round((lastWeekSpend / maxW) * 100)}%;background:var(--ink-soft);"></div></div></div>
    <div style="font-size:11.5px;color:${diff > 0 ? 'var(--red)' : 'var(--mint-ink)'};margin-top:6px;">
      ${diff === 0 ? '지난 주와 지출이 같아요' : diff > 0 ? `지난 주보다 ${diff.toLocaleString()}원 더 썼어요` : `지난 주보다 ${Math.abs(diff).toLocaleString()}원 덜 썼어요`}
    </div>`;

  // 1년 전 오늘
  const lastYearDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const lyMemos = load(K.memos, []).filter((m) => m.date === lastYearDate);
  const lySched = load(K.sched, []).filter((s) => s.date === lastYearDate);
  const lyTx = load(K.tx, []).filter((x) => x.date === lastYearDate);
  const lyCard = document.getElementById('lastYearCard');
  const lyItems = [
    ...lyMemos.map((m) => ({ cls: 'c-memo', tag: 'memo', tagText: '메모', title: m.title || '제목 없음', sub: m.body || '' })),
    ...lySched.map((s) => ({ cls: 'c-cal', tag: 'cal', tagText: '일정', title: s.title, sub: s.time || '' })),
    ...lyTx.map((x) => ({ cls: x.type === 'income' ? 'c-income' : 'c-expense', tag: 'money', tagText: '가계부', title: `${x.category}${x.memo ? ` · ${x.memo}` : ''}`, sub: `${x.type === 'income' ? '+' : '-'}${Number(x.amount).toLocaleString()}원` })),
  ];
  if (lyItems.length) {
    lyCard.style.display = 'block';
    lyCard.innerHTML = `<div class="section-label" style="margin:0 0 8px;">1년 전 오늘 (${lastYearDate})</div>${lyItems
      .map((it) => `<div class="list-item ${it.cls}" style="margin-bottom:6px;box-shadow:none;">
        <div><span class="tag ${it.tag}">${it.tagText}</span><span class="title">${escapeHtml(it.title)}</span></div>
        <div class="sub">${escapeHtml(it.sub)}</div></div>`)
      .join('')}`;
  } else {
    lyCard.style.display = 'none';
  }
}

// "+ 메모" 등 빠른 기록 버튼: 해당 탭으로 이동
document.querySelectorAll('[data-goto]').forEach((el) => {
  el.addEventListener('click', () => switchTab(el.dataset.goto));
});

// 상단 공유 버튼: 오늘 요약을 공유 (미지원/실패 시 클립보드 복사)
document.getElementById('shareBtn').addEventListener('click', () => {
  const c = homeCount();
  const text = `메모라이프 - 오늘 일정 ${c.sched}건, 메모 ${c.memo}건, 지출 ${c.spend.toLocaleString()}원`;
  if (!navigator.share) {
    copyToClipboard(text);
    return;
  }
  try {
    navigator.share({ title: '메모라이프', text }).catch((error) => {
      if (error && error.name === 'AbortError') return;
      copyToClipboard(text);
    });
  } catch (error) {
    copyToClipboard(text);
  }
});

// ============================================
// 통합 검색
// ============================================
let searchFilter = 'all';

document.getElementById('searchBtn').addEventListener('click', () => {
  switchTab('search');
  document.getElementById('searchInput').focus();
});

document.getElementById('searchInput').addEventListener('input', renderSearch);

document.querySelectorAll('.filter-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    searchFilter = chip.dataset.filter;
    renderSearch();
  });
});

function renderSearch() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const box = document.getElementById('searchResults');
  const results = [];

  if (searchFilter === 'all' || searchFilter === 'memo') {
    results.push(
      ...load(K.memos, [])
        .filter((m) => !q || (m.title || '').toLowerCase().includes(q) || (m.body || '').toLowerCase().includes(q))
        .map((m) => ({ id: m.id, type: 'memo', date: m.date, title: m.title || '제목 없음', sub: m.body || '', cls: 'c-memo', tag: 'memo', tagText: '메모', go: 'memo' }))
    );
  }
  if (searchFilter === 'all' || searchFilter === 'sched') {
    results.push(
      ...load(K.sched, [])
        .filter((s) => !q || s.title.toLowerCase().includes(q))
        .map((s) => ({ id: s.id, type: 'sched', date: s.date, title: s.title, sub: `${s.date} · ${s.time || '시간 미정'}`, cls: 'c-cal', tag: 'cal', tagText: '일정', go: 'calendar' }))
    );
  }
  if (searchFilter === 'all' || searchFilter === 'tx') {
    results.push(
      ...load(K.tx, [])
        .filter((x) => !q || x.category.toLowerCase().includes(q) || (x.memo || '').toLowerCase().includes(q))
        .map((x) => ({ id: x.id, type: 'tx', date: x.date, title: `${x.category}${x.memo ? ` · ${x.memo}` : ''}`, sub: `${x.date} · ${x.type === 'income' ? '+' : '-'}${Number(x.amount).toLocaleString()}원`, cls: x.type === 'income' ? 'c-income' : 'c-expense', tag: 'money', tagText: '가계부', go: 'budget' }))
    );
  }

  results.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  box.innerHTML = results.length ? '' : `<div class="empty">${q ? '검색 결과가 없어요.' : '검색어를 입력하거나 위 필터로 둘러보세요.'}</div>`;
  results.forEach((r) => {
    const row = document.createElement('div');
    row.className = `list-item ${r.cls}`;
    row.style.cursor = 'pointer';
    row.innerHTML = `
      <div><span class="tag ${r.tag}">${r.tagText}</span>
        <span class="title">${escapeHtml(r.title)}</span></div>
      <div class="sub">${escapeHtml(r.sub)}</div>
    `;
    row.addEventListener('click', () => switchTab(r.go));
    box.append(row);
  });
}

// ============================================
// 데이터 백업 (내보내기 / 가져오기)
// ============================================
document.getElementById('backupExportBtn').addEventListener('click', () => {
  const data = {};
  Object.entries(K).forEach(([name, key]) => {
    data[name] = load(key, null);
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `memolife-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('백업 파일을 저장했어요');
});

document.getElementById('backupImportBtn').addEventListener('click', () => {
  document.getElementById('backupFileInput').click();
});

document.getElementById('backupFileInput').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      Object.entries(K).forEach(([name, key]) => {
        if (data[name] !== undefined && data[name] !== null) save(key, data[name]);
      });
      renderAll();
      toast('백업을 불러왔어요');
    } catch (error) {
      toast('파일을 읽을 수 없어요');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
});

// ============================================
// 전체 다시 그리기
// ============================================
function renderAll() {
  renderHome();
  renderMemos();
  renderCalendar();
  renderBudget();
  renderSearch();
}

renderAll();
