import re
from datetime import date, datetime, timezone
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

TITLE_MAX_LENGTH = 100
DESCRIPTION_MAX_LENGTH = 2000
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class TaskStatus(str, Enum):
    TODO = "TODO"
    DOING = "DOING"
    DONE = "DONE"


class TaskPriority(str, Enum):
    HIGH = "HIGH"
    NORMAL = "NORMAL"
    LOW = "LOW"


Title = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=TITLE_MAX_LENGTH)
]
Description = Annotated[str, Field(max_length=DESCRIPTION_MAX_LENGTH)]


def check_due_date(value: object) -> object:
    # YYYY-MM-DD 문자열만 허용한다. 실제 날짜 여부는 date 변환에서 검사한다.
    if value is None:
        return None
    if not isinstance(value, str) or not DATE_PATTERN.match(value):
        raise ValueError("due_date must be a YYYY-MM-DD string or null")
    return value


class TaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Title
    description: Description = ""
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.NORMAL
    due_date: date | None = None

    _check_due_date = field_validator("due_date", mode="before")(check_due_date)


class TaskUpdate(BaseModel):
    """전달한 필드만 수정한다. due_date만 null(마감일 해제)을 허용한다."""

    model_config = ConfigDict(extra="forbid")

    title: Title | None = None
    description: Description | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: date | None = None

    _check_due_date = field_validator("due_date", mode="before")(check_due_date)

    @model_validator(mode="before")
    @classmethod
    def reject_null(cls, data: object) -> object:
        if isinstance(data, dict):
            for name in ("title", "description", "status", "priority"):
                if name in data and data[name] is None:
                    raise ValueError(f"{name} cannot be null")
        return data


class Task(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    status: TaskStatus
    priority: TaskPriority
    due_date: date | None
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def assume_utc(cls, value: datetime) -> datetime:
        # DB의 DATETIME은 시간대 없이 UTC로 저장하므로 응답에서 UTC로 표시한다.
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
