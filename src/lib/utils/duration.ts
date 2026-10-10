const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };

/** Parses jsonwebtoken-style lifetimes ("15m", "7d") or plain seconds. */
export const durationToSeconds = (value: string | number): number => {
    if (typeof value === 'number') return value;

    const match = /^(\d+)\s*([smhdw])?$/i.exec(value.trim());
    if (!match) throw new Error(`Unsupported duration '${value}', use e.g. 15m, 12h, 7d`);

    return Number(match[1]) * UNIT_SECONDS[(match[2] ?? 's').toLowerCase()];
};
