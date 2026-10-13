import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from . import store
from .database import get_db
from .schemas import Task, TaskCreate, TaskPriority, TaskStatus, TaskUpdate

# 개발 단계에서 화면(http.server 5500)이 API(8000)를 호출할 수 있도록 허용할 주소.
DEFAULT_CORS_ORIGINS = "http://127.0.0.1:5500,http://localhost:5500"
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")
    if origin.strip()
]

app = FastAPI(title="Task Flow API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)

TASK_NOT_FOUND = "Task not found"
# 화면 파일(index.html, styles.css, app.js) 위치.
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


@app.exception_handler(OperationalError)
def database_unavailable(request: Request, error: OperationalError) -> JSONResponse:
    # 접속 정보 등 내부 내용은 응답에 넣지 않는다.
    return JSONResponse(status_code=503, content={"detail": "Database unavailable"})


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks")
def list_tasks(
    q: str | None = None,
    status: TaskStatus | None = None,
    priority: TaskPriority | None = None,
    db: Session = Depends(get_db),
) -> list[Task]:
    return store.list_tasks(db, q=q, status=status, priority=priority)


@app.post("/api/tasks", status_code=201)
def create_task(data: TaskCreate, db: Session = Depends(get_db)) -> Task:
    return store.create_task(db, data)


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)) -> Task:
    task = store.update_task(db, task_id, data)
    if task is None:
        raise HTTPException(status_code=404, detail=TASK_NOT_FOUND)
    return task


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)) -> Response:
    if not store.delete_task(db, task_id):
        raise HTTPException(status_code=404, detail=TASK_NOT_FOUND)
    return Response(status_code=204)


# API 경로를 모두 등록한 뒤 마지막에 연결해야 /api 요청이 화면 파일보다 먼저 처리된다.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
