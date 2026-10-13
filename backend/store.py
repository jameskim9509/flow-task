from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Task as TaskRow
from .schemas import Task, TaskCreate, TaskPriority, TaskStatus, TaskUpdate


def list_tasks(
    db: Session,
    q: str | None = None,
    status: TaskStatus | None = None,
    priority: TaskPriority | None = None,
) -> list[Task]:
    # 제목 검색·상태·우선순위 조건을 AND로 적용한다.
    query = select(TaskRow).order_by(TaskRow.id)
    keyword = (q or "").strip()
    if keyword:
        # %, _ 같은 문자도 글자 그대로 검색한다.
        query = query.where(TaskRow.title.icontains(keyword, autoescape=True))
    if status is not None:
        query = query.where(TaskRow.status == status)
    if priority is not None:
        query = query.where(TaskRow.priority == priority)
    return [Task.model_validate(row) for row in db.scalars(query)]


def create_task(db: Session, data: TaskCreate) -> Task:
    row = TaskRow(**data.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return Task.model_validate(row)


def update_task(db: Session, task_id: int, data: TaskUpdate) -> Task | None:
    row = db.get(TaskRow, task_id)
    if row is None:
        return None
    # 전달하지 않은 필드는 유지한다.
    for name, value in data.model_dump(exclude_unset=True).items():
        setattr(row, name, value)
    db.commit()
    db.refresh(row)
    return Task.model_validate(row)


def delete_task(db: Session, task_id: int) -> bool:
    row = db.get(TaskRow, task_id)
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True
