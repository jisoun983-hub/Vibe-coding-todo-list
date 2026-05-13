const API_BASE = "https://port-0-vibe-coding-todo-list-mp1zx8b5ed30517c.sel3.cloudtype.app";

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });

  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.message || `request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

function uuid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // Reasonable fallback for older browsers (non-crypto).
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function toMillis(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" || value instanceof Date) {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function formatRemaining(ms) {
  if (ms <= 0) return "마감됨";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) return `${days}일 ${hours}시간 남음`;
  if (hours > 0) return `${hours}시간 ${minutes}분 남음`;
  return `${minutes}분 ${seconds}초 남음`;
}

function formatKoreanDate(value) {
  const d =
    value && typeof value === "object" && typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function fromApiTodo(todo) {
  return {
    id: String(todo?._id ?? uuid()),
    text: String(todo?.content ?? "").trim(),
    done: Boolean(todo?.completed),
    createdAt: todo?.createdAt ?? nowIso(),
    updatedAt: todo?.updatedAt ?? todo?.createdAt ?? nowIso(),
  };
}

async function fetchTodos() {
  const todos = await api("/todos");
  return (Array.isArray(todos) ? todos : []).map(fromApiTodo);
}

const state = {
  todos: [],
  filter: "all", // all | active | done
  query: "",
  sort: "newest", // newest | oldest | activeFirst
  editingId: null,
};

// countdown pause state (in-memory)
const pausedCountdown = new Map(); // id -> remainingMs

const els = {
  addForm: document.getElementById("addForm"),
  newTodo: document.getElementById("newTodo"),
  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),
  list: document.getElementById("list"),
  countText: document.getElementById("countText"),
  clearDoneBtn: document.getElementById("clearDoneBtn"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  editDialog: document.getElementById("editDialog"),
  editForm: document.getElementById("editForm"),
  editInput: document.getElementById("editInput"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),
  closeDialogBtn: document.getElementById("closeDialogBtn"),
  filterButtons: Array.from(document.querySelectorAll("[data-filter]")),
};

function visibleTodos() {
  let result = state.todos;

  if (state.filter === "active") result = result.filter((t) => !t.done);
  if (state.filter === "done") result = result.filter((t) => t.done);

  const q = state.query.trim().toLowerCase();
  if (q) {
    result = result.filter((t) => t.text.toLowerCase().includes(q));
  }

  if (state.sort === "oldest") {
    result = [...result].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (state.sort === "activeFirst") {
    result = [...result].sort((a, b) => Number(a.done) - Number(b.done));
  } else {
    // newest
    result = [...result].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return result;
}

function setFilter(next) {
  state.filter = next;
  for (const btn of els.filterButtons) {
    btn.classList.toggle("isActive", btn.dataset.filter === next);
  }
  render();
}

function updateCounts() {
  const total = state.todos.length;
  const left = state.todos.filter((t) => !t.done).length;
  els.countText.textContent = `${left}개 남음 / 총 ${total}개`;
}

function render() {
  updateCounts();
  const todos = visibleTodos();

  els.list.innerHTML = "";

  if (todos.length === 0) {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div></div>
      <div class="textWrap">
        <div class="text" style="color: rgba(255,255,255,0.65)">표시할 할 일이 없어요.</div>
        <div class="meta">위 입력창에서 추가해 보세요.</div>
      </div>
      <div></div>
    `;
    els.list.appendChild(li);
    return;
  }

  for (const t of todos) {
    const li = document.createElement("li");
    li.className = `item ${t.done ? "isDone" : ""}`;
    li.dataset.id = t.id;

    const dueAtMs = toMillis(t.dueAt) ?? ((toMillis(t.createdAt) ?? Date.now()) + WEEK_MS);
    const pausedMs = pausedCountdown.get(t.id);
    const remainingText = formatRemaining((pausedMs ?? (dueAtMs - Date.now())));

    const metaText =
      t.updatedAt && t.updatedAt !== t.createdAt
        ? `수정: ${formatKoreanDate(t.updatedAt)}`
        : `생성: ${formatKoreanDate(t.createdAt)}`;

    li.innerHTML = `
      <input class="check" type="checkbox" ${t.done ? "checked" : ""} aria-label="완료 토글" />
      <div class="textWrap">
        <div class="text" title="${escapeHtml(t.text)}">${escapeHtml(t.text)}</div>
        <div class="meta">
          ${escapeHtml(metaText)}
          ${
            t.done
              ? ""
              : `<button class="deadlineBtn ${pausedMs != null ? "isPaused" : ""}"
                   type="button"
                   data-id="${escapeHtml(t.id)}"
                   data-due-at="${dueAtMs}"
                   aria-label="마감 카운트다운 (탭하면 일시정지/재개)">
                   ${escapeHtml(remainingText)}
                 </button>`
          }
        </div>
      </div>
      <div class="actions">
        <button class="iconBtn" type="button" data-action="edit" aria-label="수정">수정</button>
        <button class="iconBtn" type="button" data-action="delete" aria-label="삭제">삭제</button>
      </div>
    `;

    // quick edit
    li.querySelector(".text").addEventListener("dblclick", () => openEdit(t.id));
    // toggle done
    li.querySelector(".check").addEventListener("change", () => toggleDone(t.id));
    // countdown pause/resume
    const deadlineBtn = li.querySelector(".deadlineBtn");
    if (deadlineBtn) {
      deadlineBtn.addEventListener("click", () => toggleCountdownPause(t.id, dueAtMs));
    }
    // buttons
    li.querySelector('[data-action="edit"]').addEventListener("click", () => openEdit(t.id));
    li.querySelector('[data-action="delete"]').addEventListener("click", () => removeTodo(t.id));

    els.list.appendChild(li);
  }
}

function toggleCountdownPause(id, dueAtMs) {
  if (pausedCountdown.has(id)) {
    pausedCountdown.delete(id);
  } else {
    pausedCountdown.set(id, Math.max(0, dueAtMs - Date.now()));
  }
  render();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function addTodoFromInput() {
  const text = els.newTodo.value.trim();
  if (!text) return;

  els.newTodo.value = "";
  els.newTodo.focus();

  api("/todos", { method: "POST", body: JSON.stringify({ content: text }) })
    .then((created) => {
      const mapped = fromApiTodo(created);
      state.todos = [mapped, ...state.todos];
      render();
    })
    .catch((err) => {
      console.error(err);
      alert("할 일 저장에 실패했어요. 백엔드 서버를 확인해 주세요.");
    });
}

function toggleDone(id) {
  const idx = state.todos.findIndex((t) => t.id === id);
  if (idx < 0) return;
  const t = state.todos[idx];
  const nextDone = !t.done;
  state.todos[idx] = { ...t, done: nextDone, updatedAt: nowIso() };
  render();

  // If completed, remove countdown pause state
  if (nextDone) pausedCountdown.delete(id);

  api(`/todos/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ completed: nextDone }),
  }).catch((err) => {
    console.error(err);
    alert("완료 상태 업데이트에 실패했어요.");
  });
}

function removeTodo(id) {
  const t = state.todos.find((x) => x.id === id);
  if (!t) return;
  const ok = confirm(`삭제할까요?\n\n- ${t.text}`);
  if (!ok) return;
  state.todos = state.todos.filter((x) => x.id !== id);
  render();

  api(`/todos/${encodeURIComponent(id)}`, { method: "DELETE" }).catch((err) => {
    console.error(err);
    alert("삭제에 실패했어요.");
  });
}

function clearDone() {
  const doneCount = state.todos.filter((t) => t.done).length;
  if (doneCount === 0) return;
  const ok = confirm(`완료된 ${doneCount}개를 삭제할까요?`);
  if (!ok) return;
  const doneIds = state.todos.filter((t) => t.done).map((t) => t.id);
  state.todos = state.todos.filter((t) => !t.done);
  render();

  Promise.allSettled(doneIds.map((id) => api(`/todos/${encodeURIComponent(id)}`, { method: "DELETE" }))).catch(
    () => {}
  );
}

function clearAll() {
  if (state.todos.length === 0) return;
  const ok = confirm(`전체 ${state.todos.length}개를 삭제할까요?`);
  if (!ok) return;
  const ids = state.todos.map((t) => t.id);
  state.todos = [];
  render();

  Promise.allSettled(ids.map((id) => api(`/todos/${encodeURIComponent(id)}`, { method: "DELETE" }))).catch(() => {});
}

function openEdit(id) {
  const t = state.todos.find((x) => x.id === id);
  if (!t) return;
  state.editingId = id;
  els.editInput.value = t.text;

  if (typeof els.editDialog.showModal === "function") {
    els.editDialog.showModal();
  } else {
    alert("이 브라우저는 dialog를 지원하지 않아요. 최신 브라우저를 사용해 주세요.");
  }

  // focus after open
  setTimeout(() => {
    els.editInput.focus();
    els.editInput.select();
  }, 0);
}

function closeEditDialog() {
  state.editingId = null;
  if (els.editDialog.open) els.editDialog.close();
}

function saveEdit(text) {
  const id = state.editingId;
  if (!id) return;
  const trimmed = text.trim();
  if (!trimmed) return;

  const idx = state.todos.findIndex((t) => t.id === id);
  if (idx < 0) return;

  const old = state.todos[idx];
  state.todos[idx] = { ...old, text: trimmed, updatedAt: nowIso() };
  closeEditDialog();
  render();

  api(`/todos/${encodeURIComponent(old.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ content: trimmed }),
  }).catch((err) => {
    console.error(err);
    alert("수정 저장에 실패했어요.");
  });
}

// Events
els.addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addTodoFromInput();
});

// Initial load (Express + MongoDB)
fetchTodos()
  .then((todos) => {
    state.todos = todos.filter((t) => t.text.length > 0);
    render();
  })
  .catch((err) => {
    console.error(err);
    alert("할 일 목록을 가져오지 못했어요. 백엔드 서버를 확인해 주세요.");
  });

function updateCountdownButtons() {
  const buttons = document.querySelectorAll(".deadlineBtn[data-due-at]");
  const now = Date.now();
  for (const btn of buttons) {
    const dueAt = Number(btn.dataset.dueAt);
    if (!Number.isFinite(dueAt)) continue;
    const id = btn.dataset.id;
    const pausedMs = id ? pausedCountdown.get(id) : null;
    const txt = formatRemaining((pausedMs ?? (dueAt - now)));
    if (btn.textContent !== txt) btn.textContent = txt;
    const isExpired = (pausedMs ?? (dueAt - now)) <= 0;
    btn.classList.toggle("isExpired", isExpired);
    btn.classList.toggle("isPaused", pausedMs != null);
  }
}

setInterval(updateCountdownButtons, 1000);

els.searchInput?.addEventListener("input", () => {
  state.query = els.searchInput.value;
  render();
});

els.sortSelect?.addEventListener("change", () => {
  state.sort = els.sortSelect.value;
  render();
});

els.clearDoneBtn.addEventListener("click", clearDone);
els.clearAllBtn.addEventListener("click", clearAll);

for (const btn of els.filterButtons) {
  btn.addEventListener("click", () => setFilter(btn.dataset.filter));
}

els.editForm.addEventListener("submit", (e) => {
  e.preventDefault();
  saveEdit(els.editInput.value);
});

els.cancelEditBtn.addEventListener("click", closeEditDialog);
els.closeDialogBtn.addEventListener("click", closeEditDialog);

els.editDialog.addEventListener("cancel", () => {
  closeEditDialog();
});

// keyboard shortcut: in dialog, Enter saves automatically (form submit)
// on main input, Enter adds by form submit already

render();
