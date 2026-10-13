from datetime import date, datetime, timezone

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base
from .schemas import DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH, TaskPriority, TaskStatus


def utc_now() -> datetime:
    # created_at은 UTC 기준으로 초 단위까지 저장한다.
    return datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)


def enum_values(enum_class: type) -> list[str]:
    return [member.value for member in enum_class]


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("CHAR_LENGTH(title) >= 1", name="ck_tasks_title_not_empty"),
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(TITLE_MAX_LENGTH), nullable=False)
    description: Mapped[str] = mapped_column(
        String(DESCRIPTION_MAX_LENGTH), nullable=False, default="", server_default=""
    )
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, name="task_status", values_callable=enum_values),
        nullable=False,
        default=TaskStatus.TODO,
        server_default=TaskStatus.TODO.value,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority, name="task_priority", values_callable=enum_values),
        nullable=False,
        default=TaskPriority.NORMAL,
        server_default=TaskPriority.NORMAL.value,
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)
