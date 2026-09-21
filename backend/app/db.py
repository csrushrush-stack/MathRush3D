from collections.abc import Generator

from fastapi import HTTPException, Request, status
from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool


def get_conn(request: Request) -> Generator[Connection, None, None]:
    pool: ConnectionPool | None = getattr(request.app.state, "db_pool", None)
    if pool is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not configured",
        )
    with pool.connection() as conn:
        conn.row_factory = dict_row
        yield conn
