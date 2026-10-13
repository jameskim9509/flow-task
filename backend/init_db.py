"""tasks 테이블을 만든다. 이미 있는 테이블과 데이터는 변경하거나 삭제하지 않는다.

실행: python -m backend.init_db
"""

from sqlalchemy import inspect
from sqlalchemy.exc import OperationalError

from .database import Base, engine
from . import models  # noqa: F401  (테이블 정의를 Base.metadata에 등록)


def main() -> None:
    try:
        existing = set(inspect(engine).get_table_names())
        Base.metadata.create_all(engine)
    except OperationalError as error:
        raise SystemExit(f"DB 접속 또는 테이블 생성 실패: {error.orig}") from error

    for table in Base.metadata.sorted_tables:
        state = "이미 있음(변경 안 함)" if table.name in existing else "생성함"
        print(f"{table.name}: {state}")


if __name__ == "__main__":
    main()
