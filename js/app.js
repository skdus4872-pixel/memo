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
// 다크모드
// ============================================
const themeToggleBtn = document.getElementById('themeToggleBtn');
const THEME_KEY = 'theme';

// 저장된 테마가 있으면 그것을, 없으면 시스템 설정을 기본값으로 사용
function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// 테마를 화면과 토글 버튼에 반영
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  themeToggleBtn.setAttribute('aria-label', theme === 'dark' ? '라이트모드로 전환' : '다크모드로 전환');
}

let currentTheme = getInitialTheme();
applyTheme(currentTheme);

themeToggleBtn.addEventListener('click', () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, currentTheme);
  applyTheme(currentTheme);
});

// ============================================
// 메모 CRUD 로직
// ============================================
const STORAGE_KEY = 'memos';

const memoListEl = document.getElementById('memoList');
const addMemoBtn = document.getElementById('addMemoBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitleEl = document.getElementById('modalTitle');
const memoForm = document.getElementById('memoForm');
const memoTitleInput = document.getElementById('memoTitleInput');
const memoContentInput = document.getElementById('memoContentInput');
const memoTagsInput = document.getElementById('memoTagsInput');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelBtn');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');

let memos = loadMemos();
let editingId = null; // null이면 새 메모 작성, 값이 있으면 해당 id 메모 수정
let searchQuery = '';
let sortOrder = 'newest'; // 'newest' | 'oldest'

// localStorage에서 메모 목록 불러오기
function loadMemos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('메모 불러오기 실패:', error);
    return [];
  }
}

// localStorage에 메모 목록 저장하기
function saveMemos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
}

// HTML 특수문자 이스케이프 (XSS 방지)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 오늘 날짜를 YYYY-MM-DD 형식으로 반환
function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

// 검색어(제목+내용)로 메모 필터링
function filterMemos(list) {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return list;
  return list.filter(
    (memo) =>
      memo.title.toLowerCase().includes(query) ||
      memo.content.toLowerCase().includes(query) ||
      memo.tags.some((tag) => tag.toLowerCase().includes(query))
  );
}

// 정렬 기준에 따라 메모 정렬 (즐겨찾기가 항상 먼저 오고, 그 안에서 정렬 기준 적용)
function sortMemos(list) {
  const sorted = [...list];
  sorted.sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return sortOrder === 'newest' ? b.id - a.id : a.id - b.id;
  });
  return sorted;
}

// 메모 목록 화면에 그리기
function renderMemos() {
  if (memos.length === 0) {
    memoListEl.innerHTML = '<p class="empty-state" id="emptyState">아직 메모가 없어요. 오른쪽 아래 버튼을 눌러 첫 메모를 남겨보세요.</p>';
    return;
  }

  const visible = sortMemos(filterMemos(memos));

  if (visible.length === 0) {
    memoListEl.innerHTML = '<p class="empty-state">검색 결과가 없어요.</p>';
    return;
  }

  memoListEl.innerHTML = visible
    .map((memo) => `
      <article class="memo-card" data-id="${memo.id}">
        <div class="memo-card-header">
          <button type="button" class="icon-btn favorite-btn" aria-label="${memo.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}">${memo.isFavorite ? '★' : '☆'}</button>
          <h2 class="memo-card-title">${escapeHtml(memo.title)}</h2>
          <div class="memo-card-actions">
            <button type="button" class="icon-btn copy-btn" aria-label="복사">📋</button>
            <button type="button" class="icon-btn share-btn" aria-label="공유">📤</button>
            <button type="button" class="icon-btn edit-btn" aria-label="수정">✎</button>
            <button type="button" class="icon-btn delete-btn" aria-label="삭제">🗑</button>
          </div>
        </div>
        <p class="memo-card-content">${escapeHtml(memo.content)}</p>
        ${
          memo.tags.length
            ? `<div class="memo-card-tags">${memo.tags
                .map((tag) => `<button type="button" class="tag-chip">#${escapeHtml(tag)}</button>`)
                .join('')}</div>`
            : ''
        }
        <time class="memo-card-date">${memo.date}</time>
      </article>
    `)
    .join('');
}

// 모달 열기 (memo가 있으면 수정 모드, 없으면 새 메모 작성 모드)
function openModal(memo) {
  if (memo) {
    editingId = memo.id;
    modalTitleEl.textContent = '메모 수정';
    memoTitleInput.value = memo.title;
    memoContentInput.value = memo.content;
    memoTagsInput.value = memo.tags.join(', ');
  } else {
    editingId = null;
    modalTitleEl.textContent = '새 메모';
    memoTitleInput.value = '';
    memoContentInput.value = '';
    memoTagsInput.value = '';
  }
  modalOverlay.classList.add('open');
  memoTitleInput.focus();
}

// 모달 닫기
function closeModal() {
  modalOverlay.classList.remove('open');
  memoForm.reset();
  editingId = null;
}

// 메모 저장(추가 또는 수정) 처리
function handleFormSubmit(event) {
  event.preventDefault();
  const title = memoTitleInput.value.trim();
  const content = memoContentInput.value.trim();
  if (!title || !content) return;

  const tags = memoTagsInput.value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  if (editingId === null) {
    memos.push({
      id: Date.now(),
      title,
      content,
      date: getTodayString(),
      tags,
      isFavorite: false,
    });
  } else {
    const target = memos.find((memo) => memo.id === editingId);
    if (target) {
      target.title = title;
      target.content = content;
      target.date = getTodayString();
      target.tags = tags;
    }
  }

  saveMemos();
  renderMemos();
  closeModal();
}

// 즐겨찾기 on/off 토글
function handleToggleFavorite(id) {
  const target = memos.find((memo) => memo.id === id);
  if (!target) return;
  target.isFavorite = !target.isFavorite;
  saveMemos();
  renderMemos();
}

// 메모 삭제 처리
function handleDelete(id) {
  const target = memos.find((memo) => memo.id === id);
  if (!target) return;
  const confirmed = confirm(`"${target.title}" 메모를 삭제할까요?`);
  if (!confirmed) return;

  memos = memos.filter((memo) => memo.id !== id);
  saveMemos();
  renderMemos();
}

// 메모 내용을 클립보드에 복사
function handleCopy(id, btnEl) {
  const target = memos.find((memo) => memo.id === id);
  if (!target) return;
  const text = `${target.title}\n${target.content}`;

  if (!navigator.clipboard) {
    showCopyFeedback(btnEl, false);
    return;
  }

  navigator.clipboard
    .writeText(text)
    .then(() => showCopyFeedback(btnEl, true))
    .catch(() => showCopyFeedback(btnEl, false));
}

// 복사 버튼에 성공/실패를 잠깐 아이콘으로 표시
function showCopyFeedback(btnEl, success) {
  const original = btnEl.textContent;
  btnEl.textContent = success ? '✅' : '⚠️';
  btnEl.disabled = true;
  setTimeout(() => {
    btnEl.textContent = original;
    btnEl.disabled = false;
  }, 1500);
}

// 메모를 다른 앱으로 공유 (미지원/실패 환경은 클립보드 복사로 대체)
function handleShare(id, btnEl) {
  const target = memos.find((memo) => memo.id === id);
  if (!target) return;

  if (!navigator.share) {
    handleCopy(id, btnEl);
    return;
  }

  try {
    navigator.share({ title: target.title, text: target.content }).catch((error) => {
      if (error && error.name === 'AbortError') return; // 사용자가 공유를 취소한 경우
      handleCopy(id, btnEl); // 공유 시도는 됐지만 실패한 경우 복사로 대체
    });
  } catch (error) {
    // 브라우저가 navigator.share를 지원한다고 알렸지만 호출 자체가 즉시 실패하는 경우
    handleCopy(id, btnEl);
  }
}

// 메모 카드 위 버튼 클릭 처리 (이벤트 위임)
function handleMemoListClick(event) {
  const card = event.target.closest('.memo-card');
  if (!card) return;
  const id = Number(card.dataset.id);

  const tagChip = event.target.closest('.tag-chip');
  if (tagChip) {
    const tagText = tagChip.textContent.replace(/^#/, '');
    searchInput.value = tagText;
    searchQuery = tagText;
    renderMemos();
    return;
  }

  if (event.target.closest('.favorite-btn')) {
    handleToggleFavorite(id);
  } else if (event.target.closest('.copy-btn')) {
    handleCopy(id, event.target.closest('.copy-btn'));
  } else if (event.target.closest('.share-btn')) {
    handleShare(id, event.target.closest('.share-btn'));
  } else if (event.target.closest('.edit-btn')) {
    const target = memos.find((memo) => memo.id === id);
    if (target) openModal(target);
  } else if (event.target.closest('.delete-btn')) {
    handleDelete(id);
  }
}

addMemoBtn.addEventListener('click', () => openModal());
closeModalBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (event) => {
  if (event.target === modalOverlay) closeModal();
});
memoForm.addEventListener('submit', handleFormSubmit);
memoListEl.addEventListener('click', handleMemoListClick);
searchInput.addEventListener('input', (event) => {
  searchQuery = event.target.value;
  renderMemos();
});
sortSelect.addEventListener('change', (event) => {
  sortOrder = event.target.value;
  renderMemos();
});

renderMemos();
