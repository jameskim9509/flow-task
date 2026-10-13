// T04: 등록·목록·localStorage 저장·상태 변경·수정·삭제 확인
//      + 설명·우선순위·마감일·검색·필터·지연 표시
const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 2000;
const STORAGE_KEY = "task-flow-v1";
const STATUS_LABELS = { TODO: "할 일", DOING: "진행 중", DONE: "완료" };
const PRIORITY_LABELS = { HIGH: "높음", NORMAL: "보통", LOW: "낮음" };
const DEFAULT_STATUS = "TODO";
const DEFAULT_PRIORITY = "NORMAL";
const FILTER_ALL = "ALL";

let tasks = [];
// 저장값이 손상됐거나 저장소를 쓸 수 없으면 false로 두고 저장하지 않는다.
let canSave = true;
// 수정 중인 항목의 id (한 번에 하나만 수정한다).
let editingId = null;
let editError = "";
// 검색·필터 조건 (저장하지 않는다).
const filters = { search: "", status: FILTER_ALL, priority: FILTER_ALL };

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const priorityInput = document.getElementById("task-priority");
const dueDateInput = document.getElementById("task-due-date");
const submitButton = form.querySelector("button[type=submit]");
const formError = document.getElementById("form-error");
const listError = document.getElementById("list-error");
const storageWarning = document.getElementById("storage-warning");
const searchInput = document.getElementById("filter-search");
const statusFilter = document.getElementById("filter-status");
const priorityFilter = document.getElementById("filter-priority");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const emptyMessage = document.getElementById("empty-message");

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

// 빈 값은 미지정(null)으로 저장한다.
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

function isValidTask(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    typeof task.id === "string" &&
    task.id.length > 0 &&
    typeof task.title === "string" &&
    !validateTitle(task.title).error &&
    typeof task.created_at === "string" &&
    // 이전 단계에서 저장한 항목에는 없는 필드가 있으므로 미지정은 기본값으로 처리한다.
    (task.status === undefined || isValidStatus(task.status)) &&
    (task.description === undefined ||
      (typeof task.description === "string" && task.description.length <= DESCRIPTION_MAX_LENGTH)) &&
    (task.priority === undefined || isValidPriority(task.priority)) &&
    (task.due_date === undefined || task.due_date === null || isValidDateString(task.due_date))
  );
}

function normalizeTask(task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description === undefined ? "" : task.description,
    status: task.status === undefined ? DEFAULT_STATUS : task.status,
    priority: task.priority === undefined ? DEFAULT_PRIORITY : task.priority,
    due_date: task.due_date === undefined ? null : task.due_date,
    created_at: task.created_at,
  };
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

function showStorageWarning(message) {
  storageWarning.textContent = message;
  storageWarning.hidden = false;
}

function lockForm() {
  for (const element of form.elements) {
    element.disabled = true;
  }
}

function loadTasks() {
  let raw;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    canSave = false;
    showStorageWarning("브라우저 저장소를 사용할 수 없습니다. 등록한 할 일은 새로고침하면 사라집니다.");
    return [];
  }

  if (raw === null) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    parsed = undefined;
  }

  const ids = new Set();
  const valid =
    Array.isArray(parsed) &&
    parsed.every((task) => {
      if (!isValidTask(task) || ids.has(task.id)) {
        return false;
      }
      ids.add(task.id);
      return true;
    });

  if (!valid) {
    // 손상된 저장값을 덮어쓰지 않도록 저장과 등록을 막는다.
    canSave = false;
    lockForm();
    showStorageWarning(
      `저장된 데이터(${STORAGE_KEY})가 손상되어 불러오지 못했습니다. ` +
        "기존 값을 보존하기 위해 등록을 중지했습니다. 저장값을 확인한 뒤 새로고침하세요."
    );
    return [];
  }

  return parsed.map(normalizeTask);
}

function saveTasks(nextTasks) {
  if (!canSave) {
    return true;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTasks));
    return true;
  } catch (error) {
    return false;
  }
}

// 저장에 성공했을 때만 화면 상태를 바꾼다.
function commit(nextTasks) {
  if (!saveTasks(nextTasks)) {
    listError.textContent = "저장에 실패했습니다. 저장 공간을 확인한 뒤 다시 시도하세요.";
    return false;
  }
  tasks = nextTasks;
  listError.textContent = "";
  return true;
}

function findTask(id) {
  return tasks.find((task) => task.id === id);
}

function updateTask(id, changes) {
  if (!findTask(id)) {
    return false;
  }
  return commit(tasks.map((task) => (task.id === id ? { ...task, ...changes } : task)));
}

function deleteTask(id) {
  if (!findTask(id)) {
    return false;
  }
  return commit(tasks.filter((task) => task.id !== id));
}

// 제목 검색·상태·우선순위 조건을 AND로 적용한다.
function matchesFilters(task) {
  const keyword = filters.search.trim().toLowerCase();
  if (keyword && !task.title.toLowerCase().includes(keyword)) {
    return false;
  }
  if (filters.status !== FILTER_ALL && task.status !== filters.status) {
    return false;
  }
  if (filters.priority !== FILTER_ALL && task.priority !== filters.priority) {
    return false;
  }
  return true;
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
  const fields = document.createElement("div");
  fields.className = "edit-fields";

  const titleField = document.createElement("input");
  titleField.type = "text";
  titleField.maxLength = TITLE_MAX_LENGTH;
  titleField.value = task.title;
  titleField.dataset.role = "edit-title";
  titleField.setAttribute("aria-label", "제목 수정");

  const descriptionField = document.createElement("textarea");
  descriptionField.maxLength = DESCRIPTION_MAX_LENGTH;
  descriptionField.value = task.description;
  descriptionField.dataset.role = "edit-description";
  descriptionField.placeholder = `설명 (최대 ${DESCRIPTION_MAX_LENGTH}자)`;
  descriptionField.setAttribute("aria-label", "설명 수정");

  const dueDateField = document.createElement("input");
  dueDateField.type = "date";
  dueDateField.value = task.due_date || "";
  dueDateField.dataset.role = "edit-due-date";
  dueDateField.setAttribute("aria-label", "마감일 수정");

  const row = document.createElement("div");
  row.className = "edit-row";
  row.append(
    createSelect(PRIORITY_LABELS, task.priority, "우선순위 수정", { role: "edit-priority" }),
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
  const visibleTasks = tasks.filter(matchesFilters);

  taskList.replaceChildren();
  for (const task of visibleTasks) {
    const item = document.createElement("li");
    item.className = "task-item";
    item.dataset.id = task.id;
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

  taskCount.textContent =
    visibleTasks.length === tasks.length ? `(${tasks.length})` : `(${visibleTasks.length}/${tasks.length})`;
  emptyMessage.textContent = tasks.length === 0 ? "등록된 할 일이 없습니다." : "조건에 맞는 할 일이 없습니다.";
  emptyMessage.hidden = visibleTasks.length > 0;

  if (editingId !== null) {
    const input = taskList.querySelector("[data-role=edit-title]");
    if (input) {
      input.focus();
    }
  }
}

function startEdit(id) {
  editingId = id;
  editError = "";
  render();
}

function cancelEdit() {
  editingId = null;
  editError = "";
  render();
}

function saveEdit(id, item) {
  const titleResult = validateTitle(item.querySelector("[data-role=edit-title]").value);
  const descriptionResult = validateDescription(item.querySelector("[data-role=edit-description]").value);
  const priorityResult = validatePriority(item.querySelector("[data-role=edit-priority]").value);
  const dueDateResult = validateDueDate(item.querySelector("[data-role=edit-due-date]").value);
  const error = titleResult.error || descriptionResult.error || priorityResult.error || dueDateResult.error;
  if (error) {
    editError = error;
    render();
    return;
  }
  const changes = {
    title: titleResult.title,
    description: descriptionResult.description,
    priority: priorityResult.priority,
    due_date: dueDateResult.dueDate,
  };
  if (updateTask(id, changes)) {
    editingId = null;
    editError = "";
  }
  render();
}

function confirmDelete(id) {
  const task = findTask(id);
  if (!task) {
    return;
  }
  if (!window.confirm(`"${task.title}" 항목을 삭제할까요?`)) {
    return;
  }
  if (deleteTask(id) && editingId === id) {
    editingId = null;
    editError = "";
  }
  render();
}

form.addEventListener("submit", (event) => {
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

  const nextTasks = [
    ...tasks,
    {
      id: createId(),
      title: titleResult.title,
      description: "",
      status: DEFAULT_STATUS,
      priority: priorityResult.priority,
      due_date: dueDateResult.dueDate,
      created_at: new Date().toISOString(),
    },
  ];

  if (!saveTasks(nextTasks)) {
    formError.textContent = "저장에 실패했습니다. 저장 공간을 확인한 뒤 다시 시도하세요.";
    return;
  }

  tasks = nextTasks;
  formError.textContent = "";
  form.reset();
  titleInput.focus();
  render();
});

searchInput.addEventListener("input", () => {
  filters.search = searchInput.value;
  render();
});

statusFilter.addEventListener("change", () => {
  filters.status = statusFilter.value;
  render();
});

priorityFilter.addEventListener("change", () => {
  filters.priority = priorityFilter.value;
  render();
});

taskList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const item = button.closest("li[data-id]");
  const id = item.dataset.id;

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
  const id = select.closest("li[data-id]").dataset.id;
  updateTask(id, { status: select.value });
  render();
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
    saveEdit(item.dataset.id, item);
  } else if (event.key === "Escape") {
    cancelEdit();
  }
});

tasks = loadTasks();
render();
