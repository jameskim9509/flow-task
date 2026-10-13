from datetime import datetime, timezone
from threading import Lock

from .schemas import Task, TaskCreate, TaskPriority, TaskStatus, TaskUpdate


class MemoryTaskStore:
    """API 프로세스 메모리에 할 일을 보관한다. 재시작하면 사라진다."""

    def __init__(self) -> None:
        self._tasks: dict[int, Task] = {}
        self._next_id = 1
        self._lock = Lock()

    def list(
        self,
        q: str | None = None,
        status: TaskStatus | None = None,
        priority: TaskPriority | None = None,
    ) -> list[Task]:
        keyword = (q or "").strip().casefold()
        with self._lock:
            tasks = sorted(self._tasks.values(), key=lambda task: task.id)
        # 제목 검색·상태·우선순위 조건을 AND로 적용한다.
        return [
            task
            for task in tasks
            if (not keyword or keyword in task.title.casefold())
            and (status is None or task.status == status)
            and (priority is None or task.priority == priority)
        ]

    def create(self, data: TaskCreate) -> Task:
        with self._lock:
            task = Task(
                id=self._next_id,
                created_at=datetime.now(timezone.utc).replace(microsecond=0),
                **data.model_dump(),
            )
            self._tasks[task.id] = task
            self._next_id += 1
            return task

    def update(self, task_id: int, data: TaskUpdate) -> Task | None:
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                return None
            # 전달하지 않은 필드는 유지한다.
            updated = task.model_copy(update=data.model_dump(exclude_unset=True))
            self._tasks[task_id] = updated
            return updated

    def delete(self, task_id: int) -> bool:
        with self._lock:
            return self._tasks.pop(task_id, None) is not None


store = MemoryTaskStore()
