# backend/app/services/import_cache.py
"""In-memory cache for Excel import preview data with 5-minute TTL."""
import time
import uuid
from threading import Lock


_store: dict[str, dict] = {}
_lock = Lock()
_TTL_SECONDS = 300  # 5 minutes


def store(headers: list[str], rows: list[list]) -> str:
    """Store parsed Excel data and return a unique import_id."""
    import_id = str(uuid.uuid4())
    with _lock:
        _store[import_id] = {
            "headers": headers,
            "rows": rows,
            "created_at": time.time(),
        }
    return import_id


def retrieve(import_id: str) -> dict | None:
    """Retrieve cached data. Returns None if not found or expired."""
    with _lock:
        entry = _store.get(import_id)
        if entry is None:
            return None
        if time.time() - entry["created_at"] > _TTL_SECONDS:
            _store.pop(import_id, None)
            return None
        return entry


def remove(import_id: str) -> None:
    """Remove an entry from the cache."""
    with _lock:
        _store.pop(import_id, None)


def clear() -> None:
    """Clear all entries (for testing)."""
    with _lock:
        _store.clear()
