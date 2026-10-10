interface Entry {
    count: number;
    resetTime: number;
}

export interface RateLimitResult {
    allowed: boolean;
    retryAfter?: number;
}

/** In-memory fixed window limiter with a bounded key count so key churn cannot exhaust memory. */
export class FixedWindowLimiter {
    private readonly entries = new Map<string, Entry>();

    constructor(
        private readonly windowMs: number,
        private readonly maxKeys = 50_000
    ) {
        setInterval(() => this.purgeExpired(), windowMs).unref();
    }

    check(key: string, maxRequests: number): RateLimitResult {
        const now = Date.now();
        const entry = this.entries.get(key);

        if (!entry || now > entry.resetTime) {
            this.ensureCapacity(now);
            this.entries.set(key, { count: 1, resetTime: now + this.windowMs });
            return { allowed: true };
        }

        if (entry.count >= maxRequests) {
            return { allowed: false, retryAfter: Math.ceil((entry.resetTime - now) / 1000) };
        }

        entry.count++;
        return { allowed: true };
    }

    private purgeExpired(now = Date.now()) {
        for (const [key, entry] of this.entries) {
            if (now > entry.resetTime) this.entries.delete(key);
        }
    }

    private ensureCapacity(now: number) {
        if (this.entries.size < this.maxKeys) return;

        this.purgeExpired(now);
        // Still full of live keys: evict the oldest insertions
        for (const key of this.entries.keys()) {
            if (this.entries.size < this.maxKeys) break;
            this.entries.delete(key);
        }
    }

    get size() {
        return this.entries.size;
    }
}
