"""Simple in-memory rate limiter."""

import time
from collections import defaultdict

from fastapi import HTTPException, Request


class RateLimiter:
    """Token-bucket rate limiter keyed by client IP."""

    def __init__(self, max_requests: int = 30, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._last_sweep = 0.0

    def _sweep(self, cutoff: float) -> None:
        """Drop buckets whose most recent request has expired, bounding memory
        so IPs that stop sending traffic don't accumulate forever."""
        stale = [k for k, ts in self._requests.items() if not ts or ts[-1] <= cutoff]
        for k in stale:
            del self._requests[k]

    def check(self, key: str) -> None:
        now = time.time()
        cutoff = now - self.window
        # Evict stale buckets at most once per window (cheap amortized cleanup).
        if now - self._last_sweep > self.window:
            self._sweep(cutoff)
            self._last_sweep = now
        # Remove expired entries
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]
        if len(self._requests[key]) >= self.max_requests:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again later.",
            )
        self._requests[key].append(now)


# Shared instances
chat_limiter = RateLimiter(max_requests=30, window_seconds=60)


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
