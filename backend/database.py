import os
from collections.abc import Iterator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# 프로젝트 루트의 .env를 읽는다. 이미 설정된 환경변수가 있으면 그 값을 우선한다.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

REQUIRED_ENV = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD")


def build_database_url() -> URL:
    missing = [name for name in REQUIRED_ENV if not os.getenv(name)]
    if missing:
        # 값은 출력하지 않고 누락된 변수 이름만 알린다.
        raise RuntimeError(f"DB 환경변수가 없습니다: {', '.join(missing)} (.env.example 참고)")
    return URL.create(
        drivername="mysql+pymysql",
        username=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        database=os.environ["DB_NAME"],
        query={"charset": "utf8mb4"},
    )


engine = create_engine(build_database_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    """요청마다 세션을 열고 응답 후 닫는다."""
    with SessionLocal() as session:
        yield session
