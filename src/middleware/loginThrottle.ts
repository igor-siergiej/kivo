const WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILED_LOGINS = 5;

interface FailureRecord {
    count: number;
    resetTime: number;
}

const failures = new Map<string, FailureRecord>();

const keyFor = (username: string) => username.toLowerCase();

setInterval(() => {
    const now = Date.now();
    for (const [key, record] of failures.entries()) {
        if (now > record.resetTime) failures.delete(key);
    }
}, 60000).unref();

/** Seconds until the account may try again, or undefined when it is not locked. */
export function getLoginLockout(username: string): number | undefined {
    const record = failures.get(keyFor(username));
    if (!record || Date.now() > record.resetTime || record.count < MAX_FAILED_LOGINS) return undefined;
    return Math.ceil((record.resetTime - Date.now()) / 1000);
}

export function recordFailedLogin(username: string) {
    const key = keyFor(username);
    const now = Date.now();
    const record = failures.get(key);

    if (!record || now > record.resetTime) {
        failures.set(key, { count: 1, resetTime: now + WINDOW_MS });
        return;
    }
    record.count++;
}

export function clearFailedLogins(username: string) {
    failures.delete(keyFor(username));
}
