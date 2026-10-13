import os

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from .schemas import Task, TaskCreate, TaskPriority, TaskStatus, TaskUpdate
from .store import store

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


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks")
def list_tasks(
    q: str | None = None,
    status: TaskStatus | None = None,
    priority: TaskPriority | None = None,
) -> list[Task]:
    return store.list(q=q, status=status, priority=priority)


@app.post("/api/tasks", status_code=201)
def create_task(data: TaskCreate) -> Task:
    return store.create(data)


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, data: TaskUpdate) -> Task:
    task = store.update(task_id, data)
    if task is None:
        raise HTTPException(status_code=404, detail=TASK_NOT_FOUND)
    return task


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int) -> Response:
    if not store.delete(task_id):
        raise HTTPException(status_code=404, detail=TASK_NOT_FOUND)
    return Response(status_code=204)
