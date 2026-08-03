import time
from collections import defaultdict
from fastapi import HTTPException, status, Request

class SimpleRateLimiter:
    def __init__(self, max_requests: int = 5, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.attempts = defaultdict(list)

    def check_rate_limit(self, client_ip: str):
        now = time.time()
        cutoff = now - self.window_seconds
        # Clean expired timestamps
        self.attempts[client_ip] = [t for t in self.attempts[client_ip] if t > cutoff]

        if len(self.attempts[client_ip]) >= self.max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Příliš mnoho neúspěšných pokusů. Zkuste to za minutu."
            )
        self.attempts[client_ip].append(now)

pin_rate_limiter = SimpleRateLimiter(max_requests=5, window_seconds=60)
