from collections.abc import Iterator
from sqlite3 import Connection as SQLiteConnection

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from rwa_guard.config import get_settings


@event.listens_for(Engine, "connect")
def _enable_sqlite_foreign_keys(
    dbapi_connection: object, _connection_record: object
) -> None:
    if isinstance(dbapi_connection, SQLiteConnection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def build_engine(database_url: str | None = None) -> Engine:
    url = database_url or get_settings().database_url
    return create_engine(url, pool_pre_ping=not url.startswith("sqlite"))


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


engine = build_engine()
SessionFactory = create_session_factory(engine)


def get_session() -> Iterator[Session]:
    """Yield a session without committing; application services own transactions."""

    with SessionFactory() as session:
        yield session
