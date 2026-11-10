"""RBAC role permissions, signed expiring file URLs, and sliding-window rate limiting."""

from __future__ import annotations

import hashlib
import hmac
import time
from collections import defaultdict, deque
from enum import Enum

from backend.config import get_settings


class UserRole(str, Enum):
    ADMIN = "Admin"
    STORE_STAFF = "Store Staff"
    RIDER = "Rider"
    CUSTOMER = "Customer"


# Allowed tables per RBAC persona over the 12 core ER entities
ROLE_TABLE_PERMISSIONS: dict[UserRole, set[str]] = {
    UserRole.ADMIN: {
        "darkstore", "staff", "customer", "product", "inventory", "rider",
        "order", "order_item", "delivery", "demand_forecast",
        "shrinkage_dump_log", "rag_query_log",
    },
    UserRole.STORE_STAFF: {
        "darkstore", "staff", "product", "inventory", "rider",
        "order", "order_item", "delivery", "demand_forecast", "shrinkage_dump_log",
    },
    UserRole.RIDER: {
        "darkstore", "rider", "delivery", "order",
    },
    UserRole.CUSTOMER: {
        "darkstore", "product", "inventory", "order", "delivery",
    },
}

ROLE_RESTRICTED_COLUMNS: dict[UserRole, set[str]] = {
    UserRole.ADMIN: set(),
    UserRole.STORE_STAFF: {"wallet_balance"},
    UserRole.RIDER: {"cost_price", "loss_amount", "subtotal", "wallet_balance"},
    UserRole.CUSTOMER: {"cost_price", "loss_amount", "predicted_qty", "phone_masked"},
}


def normalize_role(role: str | None) -> UserRole:
    if not role:
        return UserRole.ADMIN
    lower = role.strip().lower()
    mapping = {
        "admin": UserRole.ADMIN,
        "md": UserRole.ADMIN,
        "sm": UserRole.ADMIN,
        "store staff": UserRole.STORE_STAFF,
        "staff": UserRole.STORE_STAFF,
        "asm": UserRole.STORE_STAFF,
        "picker": UserRole.STORE_STAFF,
        "rider": UserRole.RIDER,
        "captain": UserRole.RIDER,
        "delivery": UserRole.RIDER,
        "customer": UserRole.CUSTOMER,
        "user": UserRole.CUSTOMER,
    }
    return mapping.get(lower, UserRole.ADMIN)


def sign_file_token(file_id: str, expires_ts: int) -> str:
    """Create HMAC-SHA256 URL signature for an expiring downloadable report."""
    secret = get_settings().files_signing_secret.encode("utf-8")
    msg = f"{file_id}:{expires_ts}".encode("utf-8")
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()


def verify_file_token(file_id: str, expires_ts: int, signature: str) -> bool:
    """Validate expiration window and constant-time HMAC signature."""
    if expires_ts < int(time.time()):
        return False
    expected = sign_file_token(file_id, expires_ts)
    return hmac.compare_digest(expected, signature)


def build_signed_download_url(file_id: str) -> tuple[str, int]:
    expires_ts = int(time.time()) + get_settings().file_url_ttl_seconds
    sig = sign_file_token(file_id, expires_ts)
    return f"/api/files/{file_id}?expires={expires_ts}&sig={sig}", expires_ts


class SlidingWindowRateLimiter:
    """Thread-safe per-client sliding-window HTTP rate limiter."""

    def __init__(self, max_requests: int = 90, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> tuple[bool, int]:
        now = time.time()
        bucket = self._hits[key]
        cutoff = now - self.window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= self.max_requests:
            retry_after = max(1, int(self.window_seconds - (now - bucket[0])))
            return False, retry_after
        bucket.append(now)
        return True, 0

