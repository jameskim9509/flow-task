// T08: 저장 처리를 FastAPI 호출로 교체 (등록·목록·상태 변경·수정·삭제 확인·검색·필터·지연 표시)
const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 2000;
const STATUS_LABELS = { TODO: "할 일", DOING: "진행 중", DONE: "완료" };
const PRIORITY_LABELS = { HIGH: "높음", NORMAL: "보통", LOW: "낮음" };
const FILTER_ALL = "ALL";
const SEARCH_DELAY_MS = 250;

// 개발 단계는 화면(5500)과 API(8000)를 따로 실행하고, Nginx 단계는 같은 주소의 /api를 사용한다.
const API_BASE =
  window.location.port === "5500"
    ? `${window.location.protocol}//${window.location.hostname}:8000/api`
    : "/api";

const MESSAGES = {
  network: "API 서버에 연결할 수 없습니다. 서버 실행 상태를 확인한 뒤 다시 시도하세요.",
  notFound: "이미 삭제되었거나 없는 항목입니다. 목록을 다시 불러왔습니다.",
  invalid: "입력값이 올바르지 않습니다. 다시 확인하세요.",
  server: "서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.",
};

// 화면에 표시 중인 목록 (서버에서 필터를 적용한 결과).
let tasks = [];
// 수정 중인 항목의 id (한 번에 하나만 수정한다).
let editingId = null;
let editError = "";
// 저장에 실패한 수정 입력값 (목록 데이터와 분리해 보관한다).
let editDraft = null;
// 검색·필터 조건 (저장하지 않는다).
const filters = { search: "", status: FILTER_ALL, priority: FILTER_ALL };
// 늦게 도착한 이전 목록 응답이 최신 결과를 덮어쓰지 않도록 요청 순번을 기록한다.
let listRequestSeq = 0;
let searchTimer = null;
let loaded = false;

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const priorityInput = document.getElementById("task-priority");
const dueDateInput = document.getElementById("task-due-date");
const formError = document.getElementById("form-error");
const listError = document.getElementById("list-error");
const serverWarning = document.getElementById("server-warning");
const searchInput = document.getElementById("filter-search");
const statusFilter = document.getElementById("filter-status");
const priorityFilter = document.getElementById("filter-priority");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const emptyMessage = document.getElementById("empty-message");

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function apiRequest(path, { method = "GET", body } = {}) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch (error) {
    throw new ApiError(0, MESSAGES.network);
  }

  if (response.status === 204) {
    return null;
  }
  if (response.ok) {
    return response.json();
  }
  if (response.status === 404) {
    throw new ApiError(404, MESSAGES.notFound);
  }
  if (response.status === 422) {
    throw new ApiError(422, MESSAGES.invalid);
  }
  throw new ApiError(response.status, MESSAGES.server);
}

function showServerWarning(message) {
  serverWarning.textContent = message;
  serverWarning.hidden = false;
}

function hideServerWarning() {
  serverWarning.textContent = "";
  serverWarning.hidden = true;
}

// 요청 실패를 화면에 알린다. 연결 실패는 상단 경고로도 표시한다.
function reportError(error, target) {
  const message = error instanceof ApiError ? error.message : MESSAGES.server;
  target.textContent = message;
  if (error instanceof ApiError && error.status === 0) {
    showServerWarning(MESSAGES.network);
  }
}

function hasKey(labels, value) {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(labels, value);
}

function isValidStatus(status) {
  return hasKey(STATUS_LABELS, status);
}

function isValidPriority(priority) {
  return hasKey(PRIORITY_LABELS, priority);
}

// YYYY-MM-DD 형식이면서 실제 존재하는 날짜인지 확인한다.
function isValidDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function validateTitle(rawTitle) {
  const title = rawTitle.trim();
  if (title.length === 0) {
    return { error: "제목을 입력하세요." };
  }
  if (title.length > TITLE_MAX_LENGTH) {
    return { error: `제목은 ${TITLE_MAX_LENGTH}자 이하로 입력하세요.` };
  }
  return { title };
}

function validateDescription(rawDescription) {
  if (rawDescription.length > DESCRIPTION_MAX_LENGTH) {
    return { error: `설명은 ${DESCRIPTION_MAX_LENGTH}자 이하로 입력하세요.` };
  }
  return { description: rawDescription };
}

// 빈 값은 미지정(null)으로 보낸다.
function validateDueDate(rawDueDate) {
  if (rawDueDate === "") {
    return { dueDate: null };
  }
  if (!isValidDateString(rawDueDate)) {
    return { error: "마감일은 YYYY-MM-DD 형식의 올바른 날짜로 입력하세요." };
  }
  return { dueDate: rawDueDate };
}

function validatePriority(rawPriority) {
  if (!isValidPriority(rawPriority)) {
    return { error: "우선순위를 다시 선택하세요." };
  }
  return { priority: rawPriority };
}

// 로컬 달력 기준 오늘 날짜(YYYY-MM-DD).
function todayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function isOverdue(task, today) {
  return task.due_date !== null && task.due_date < today && task.status !== "DONE";
}

function hasActiveFilters() {
  return (
    filters.search.trim() !== "" || filters.status !== FILTER_ALL || filters.priority !== FILTER_ALL
  );
}

function buildListQuery() {
  const params = new URLSearchParams();
  const keyword = filters.search.trim();
  if (keyword) {
    params.set("q", keyword);
  }
  if (filters.status !== FILTER_ALL) {
    params.set("status", filters.status);
  }
  if (filters.priority !== FILTER_ALL) {
    params.set("priority", filters.priority);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

// 서버에서 현재 검색·필터 조건으로 목록을 다시 불러온다.
async function loadTasks() {
  const seq = ++listRequestSeq;
  try {
    const data = await apiRequest(`/tasks${buildListQuery()}`);
    if (seq !== listRequestSeq) {
      return;
    }
    tasks = data;
    loaded = true;
    if (editingId !== null && !tasks.some((task) => task.id === editingId)) {
      editingId = null;
      editError = "";
      editDraft = null;
    }
    hideServerWarning();
    listError.textContent = "";
  } catch (error) {
    if (seq !== listRequestSeq) {
      return;
    }
    reportError(error, listError);
  }
  render();
}

function findTask(id) {
  return tasks.find((task) => task.id === id);
}

// 변경 요청 후 목록을 다시 불러온다. 성공하면 true.
async function mutate(path, options) {
  try {
    await apiRequest(path, options);
    listError.textContent = "";
    await loadTasks();
    return true;
  } catch (error) {
    reportError(error, listError);
    if (error instanceof ApiError && error.status === 404) {
      await loadTasks();
      listError.textContent = MESSAGES.notFound;
    }
    render();
    return false;
  }
}

function createButton(label, action, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.textContent = label;
  if (className) {
    button.className = className;
  }
  return button;
}

function createSelect(labels, value, ariaLabel, dataset) {
  const select = document.createElement("select");
  Object.assign(select.dataset, dataset);
  select.setAttribute("aria-label", ariaLabel);
  for (const [optionValue, label] of Object.entries(labels)) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = label;
    select.appendChild(option);
  }
  select.value = value;
  return select;
}

function createBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = `badge ${className}`;
  badge.textContent = text;
  return badge;
}

function renderViewItem(item, task, today) {
  const main = document.createElement("div");
  main.className = "task-main";

  const title = document.createElement("span");
  title.className = "task-title";
  // 사용자 입력은 HTML로 해석하지 않고 글자로만 표시한다.
  title.textContent = task.title;
  main.appendChild(title);

  if (task.description) {
    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description;
    main.appendChild(description);
  }

  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.appendChild(
    createBadge(`우선순위 ${PRIORITY_LABELS[task.priority]}`, `priority priority-${task.priority}`)
  );
  if (task.due_date) {
    meta.appendChild(createBadge(`마감 ${task.due_date}`, "due-date"));
  }
  if (isOverdue(task, today)) {
    meta.appendChild(createBadge("지연", "overdue"));
  }
  main.appendChild(meta);

  item.append(
    main,
    createSelect(STATUS_LABELS, task.status, "상태", { action: "status" }),
    createButton("수정", "edit"),
    createButton("삭제", "delete", "danger")
  );
}

function renderEditItem(item, task) {
  const values = editDraft || task;
  const fields = document.createElement("div");
  fields.className = "edit-fields";

  const titleField = document.createElement("input");
  titleField.type = "text";
  titleField.maxLength = TITLE_MAX_LENGTH;
  titleField.value = values.title;
  titleField.dataset.role = "edit-title";
  titleField.setAttribute("aria-label", "제목 수정");

  const descriptionField = document.createElement("textarea");
  descriptionField.maxLength = DESCRIPTION_MAX_LENGTH;
  descriptionField.value = values.description;
  descriptionField.dataset.role = "edit-description";
  descriptionField.placeholder = `설명 (최대 ${DESCRIPTION_MAX_LENGTH}자)`;
  descriptionField.setAttribute("aria-label", "설명 수정");

  const dueDateField = document.createElement("input");
  dueDateField.type = "date";
  dueDateField.value = values.due_date || "";
  dueDateField.dataset.role = "edit-due-date";
  dueDateField.setAttribute("aria-label", "마감일 수정");

  const row = document.createElement("div");
  row.className = "edit-row";
  row.append(
    createSelect(PRIORITY_LABELS, values.priority, "우선순위 수정", { role: "edit-priority" }),
    dueDateField,
    createButton("저장", "save"),
    createButton("취소", "cancel")
  );

  fields.append(titleField, descriptionField, row);
  item.appendChild(fields);

  if (editError) {
    const error = document.createElement("p");
    error.className = "error item-error";
    error.textContent = editError;
    item.appendChild(error);
  }
}

function render() {
  const today = todayString();

  taskList.replaceChildren();
  for (const task of tasks) {
    const item = document.createElement("li");
    item.className = "task-item";
    item.dataset.id = String(task.id);
    if (task.status === "DONE") {
      item.classList.add("is-done");
    }
    if (isOverdue(task, today)) {
      item.classList.add("is-overdue");
    }

    if (task.id === editingId) {
      renderEditItem(item, task);
    } else {
      renderViewItem(item, task, today);
    }
    taskList.appendChild(item);
  }

  const filtered = hasActiveFilters();
  taskCount.textContent = filtered ? `(${tasks.length}, 필터 적용)` : `(${tasks.length})`;
  if (!loaded) {
    emptyMessage.textContent = "목록을 불러오지 못했습니다.";
  } else {
    emptyMessage.textContent = filtered ? "조건에 맞는 할 일이 없습니다." : "등록된 할 일이 없습니다.";
  }
  emptyMessage.hidden = tasks.length > 0;

  if (editingId !== null) {
    const input = taskList.querySelector("[data-role=edit-title]");
    if (input && document.activeElement !== input) {
      input.focus();
    }
  }
}

function setFormBusy(busy) {
  for (const element of form.elements) {
    element.disabled = busy;
  }
}

function startEdit(id) {
  editingId = id;
  editError = "";
  editDraft = null;
  render();
}

function cancelEdit() {
  editingId = null;
  editError = "";
  editDraft = null;
  render();
}

async function saveEdit(id, item) {
  const titleResult = validateTitle(item.querySelector("[data-role=edit-title]").value);
  const descriptionResult = validateDescription(item.querySelector("[data-role=edit-description]").value);
  const priorityResult = validatePriority(item.querySelector("[data-role=edit-priority]").value);
  const dueDateResult = validateDueDate(item.querySelector("[data-role=edit-due-date]").value);
  const error = titleResult.error || descriptionResult.error || priorityResult.error || dueDateResult.error;
  if (error) {
    editError = error;
    editDraft = {
      title: item.querySelector("[data-role=edit-title]").value,
      description: item.querySelector("[data-role=edit-description]").value,
      priority: item.querySelector("[data-role=edit-priority]").value,
      due_date: item.querySelector("[data-role=edit-due-date]").value || null,
    };
    render();
    return;
  }
  const changes = {
    title: titleResult.title,
    description: descriptionResult.description,
    priority: priorityResult.priority,
    due_date: dueDateResult.dueDate,
  };
  editingId = null;
  editError = "";
  editDraft = null;
  if (!(await mutate(`/tasks/${id}`, { method: "PATCH", body: changes }))) {
    // 실패하면 입력한 내용을 유지한 채 다시 수정 상태를 보여준다.
    if (findTask(id)) {
      editingId = id;
      editError = listError.textContent;
      editDraft = changes;
      render();
    }
  }
}

async function confirmDelete(id) {
  const task = findTask(id);
  if (!task) {
    return;
  }
  if (!window.confirm(`"${task.title}" 항목을 삭제할까요?`)) {
    return;
  }
  await mutate(`/tasks/${id}`, { method: "DELETE" });
}

async function changeStatus(id, status) {
  await mutate(`/tasks/${id}`, { method: "PATCH", body: { status } });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (titleInput.disabled) {
    return;
  }
  const titleResult = validateTitle(titleInput.value);
  const priorityResult = validatePriority(priorityInput.value);
  const dueDateResult = validateDueDate(dueDateInput.value);
  const error = titleResult.error || priorityResult.error || dueDateResult.error;
  if (error) {
    formError.textContent = error;
    titleInput.focus();
    return;
  }

  setFormBusy(true);
  try {
    await apiRequest("/tasks", {
      method: "POST",
      body: {
        title: titleResult.title,
        priority: priorityResult.priority,
        due_date: dueDateResult.dueDate,
      },
    });
    formError.textContent = "";
    form.reset();
  } catch (requestError) {
    reportError(requestError, formError);
    return;
  } finally {
    setFormBusy(false);
    titleInput.focus();
  }
  await loadTasks();
});

searchInput.addEventListener("input", () => {
  filters.search = searchInput.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadTasks, SEARCH_DELAY_MS);
});

statusFilter.addEventListener("change", () => {
  filters.status = statusFilter.value;
  loadTasks();
});

priorityFilter.addEventListener("change", () => {
  filters.priority = priorityFilter.value;
  loadTasks();
});

taskList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const item = button.closest("li[data-id]");
  const id = Number(item.dataset.id);

  switch (button.dataset.action) {
    case "edit":
      startEdit(id);
      break;
    case "save":
      saveEdit(id, item);
      break;
    case "cancel":
      cancelEdit();
      break;
    case "delete":
      confirmDelete(id);
      break;
  }
});

taskList.addEventListener("change", (event) => {
  const select = event.target;
  if (select.dataset.action !== "status" || !isValidStatus(select.value)) {
    return;
  }
  const id = Number(select.closest("li[data-id]").dataset.id);
  changeStatus(id, select.value);
});

taskList.addEventListener("keydown", (event) => {
  const role = event.target.dataset.role;
  if (!role || !role.startsWith("edit-")) {
    return;
  }
  const item = event.target.closest("li[data-id]");
  // 설명 입력칸에서는 Enter를 줄바꿈으로 사용한다.
  if (event.key === "Enter" && role !== "edit-description") {
    event.preventDefault();
    saveEdit(Number(item.dataset.id), item);
  } else if (event.key === "Escape") {
    cancelEdit();
  }
});

loadTasks();
